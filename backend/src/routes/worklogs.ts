import { FastifyInstance } from 'fastify';
import {
  ensureProjectForImport,
  existsProjectId,
  getAllWorklogsForBackup,
  getChildProjectWorklogsByMonth,
  getDailyTotal,
  getMonthlyOverallTotal,
  getMonthlyProjectSummary,
  getProjectDailyTotal,
  getProjectTotal,
  getWorklogsByDate,
  upsertWorklog,
  getParentProjectTotals,
  getParentBracketTotals,
} from '../services/worklogService';

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  const escaped = text.replace(/"/g, '""');

  if (
    escaped.includes(',') ||
    escaped.includes('\n') ||
    escaped.includes('\r') ||
    escaped.includes('"')
  ) {
    return `"${escaped}"`;
  }

  return escaped;
}

function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentValue += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }

      currentRow.push(currentValue);

      if (currentRow.some((value) => value.trim() !== '')) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);

  if (currentRow.some((value) => value.trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

function getOptionalValue(
  row: string[],
  index: number
): string | null {
  if (index < 0) {
    return null;
  }

  const value = row[index]?.trim();

  return value ? value : null;
}

function getOptionalNumber(
  row: string[],
  index: number
): number | null {
  const value = getOptionalValue(row, index);

  if (value === null) {
    return null;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return null;
  }

  return numberValue;
}

export async function worklogRoutes(fastify: FastifyInstance) {
  /**
   * 工数を登録・更新します。
   *
   * 同じ work_date + project_id が既に存在する場合は、
   * backend 側の upsertWorklog で更新します。
   */
  fastify.post('/worklogs', async (request, reply) => {
    try {
      const body = request.body as {
        work_date?: string;
        project_id?: number;
        hours?: number;
        comment?: string | null;
      };

      if (!body.work_date || !body.project_id || body.hours === undefined) {
        return reply.status(400).send({
          message: 'work_date, project_id and hours are required',
        });
      }

      const hours = Number(body.hours);

      if (Number.isNaN(hours) || hours < 0 || hours > 24) {
        return reply.status(400).send({
          message: 'hours must be between 0 and 24',
        });
      }

      const saved = await upsertWorklog({
        work_date: body.work_date,
        project_id: Number(body.project_id),
        hours,
        comment: body.comment ?? null,
      });

      return reply.status(201).send(saved);
    } catch (error: any) {
      console.error('POST /api/worklogs failed:', error);

      return reply.status(500).send({
        error: 'failed to save worklog',
        detail: error?.message ?? String(error),
      });
    }
  });

  /**
   * 指定日の工数一覧を取得します。
   */
  fastify.get('/worklogs', async (request, reply) => {
    try {
      const query = request.query as {
        work_date?: string;
      };

      if (!query.work_date) {
        return reply.status(400).send({
          message: 'work_date is required',
        });
      }

      const rows = await getWorklogsByDate(query.work_date);

      return reply.send(rows);
    } catch (error: any) {
      console.error('GET /api/worklogs failed:', error);

      return reply.status(500).send({
        error: 'failed to fetch worklogs',
        detail: error?.message ?? String(error),
      });
    }
  });

  /**
   * 指定日の全体工数合計を取得します。
   */
  fastify.get('/summary/daily', async (request, reply) => {
    try {
      const query = request.query as {
        work_date?: string;
      };

      if (!query.work_date) {
        return reply.status(400).send({
          message: 'work_date is required',
        });
      }

      const total = await getDailyTotal(query.work_date);

      return reply.send({
        work_date: query.work_date,
        total,
      });
    } catch (error: any) {
      console.error('GET /api/summary/daily failed:', error);

      return reply.status(500).send({
        error: 'failed to fetch daily total',
        detail: error?.message ?? String(error),
      });
    }
  });

  /**
   * 指定月のプロジェクト別工数合計を取得します。
   */
  fastify.get('/summary/monthly-project', async (request, reply) => {
    try {
      const query = request.query as {
        year_month?: string;
      };

      if (!query.year_month) {
        return reply.status(400).send({
          message: 'year_month is required',
        });
      }

      const summary = await getMonthlyProjectSummary(query.year_month);

      return reply.send(summary);
    } catch (error: any) {
      console.error('GET /api/summary/monthly-project failed:', error);

      return reply.status(500).send({
        error: 'failed to fetch monthly project summary',
        detail: error?.message ?? String(error),
      });
    }
  });

  /**
   * 指定月の全体工数合計を取得します。
   */
  fastify.get('/summary/monthly-total', async (request, reply) => {
    try {
      const query = request.query as {
        year_month?: string;
      };

      if (!query.year_month) {
        return reply.status(400).send({
          message: 'year_month is required',
        });
      }

      const total = await getMonthlyOverallTotal(query.year_month);

      return reply.send({
        year_month: query.year_month,
        total,
      });
    } catch (error: any) {
      console.error('GET /api/summary/monthly-total failed:', error);

      return reply.status(500).send({
        error: 'failed to fetch monthly total',
        detail: error?.message ?? String(error),
      });
    }
  });

  /**
   * 親プロジェクトの日別合計を取得します。
   *
   * 親自身の工数 + 直接の子プロジェクトの工数を合計します。
   */
  fastify.get('/summary/project-daily', async (request, reply) => {
    try {
      const query = request.query as {
        project_id?: string;
        work_date?: string;
      };

      if (!query.project_id || !query.work_date) {
        return reply.status(400).send({
          message: 'project_id and work_date are required',
        });
      }

      const projectId = Number(query.project_id);

      if (Number.isNaN(projectId)) {
        return reply.status(400).send({
          message: 'invalid project_id',
        });
      }

      const total = await getProjectDailyTotal(projectId, query.work_date);

      return reply.send({
        project_id: projectId,
        work_date: query.work_date,
        total,
      });
    } catch (error: any) {
      console.error('GET /api/summary/project-daily failed:', error);

      return reply.status(500).send({
        error: 'failed to fetch project daily total',
        detail: error?.message ?? String(error),
      });
    }
  });

  /**
   * プロジェクトの全体、または月ごとの合計工数を取得します。
   *
   * 例:
   * /api/summary/project-total?project_id=1&scope=all
   * /api/summary/project-total?project_id=1&scope=month&year_month=2026-05
   */
  fastify.get('/summary/project-total', async (request, reply) => {
  try {
    const query = request.query as {
      project_id?: string;
      scope?: string;
      work_date?: string;
      year_month?: string;
    };

    if (!query.project_id) {
      return reply.status(400).send({
        message: 'project_id is required',
      });
    }

    const projectId = Number(query.project_id);

    if (Number.isNaN(projectId)) {
      return reply.status(400).send({
        message: 'invalid project_id',
      });
    }

    const scope =
      query.scope === 'day' ||
      query.scope === 'month' ||
      query.scope === 'all'
        ? query.scope
        : 'month';

    if (scope === 'day' && !query.work_date) {
      return reply.status(400).send({
        message: 'work_date is required when scope is day',
      });
    }

    if (scope === 'month' && !query.year_month) {
      return reply.status(400).send({
        message: 'year_month is required when scope is month',
      });
    }

    const total = await getProjectTotal(projectId, scope, {
      workDate: query.work_date,
      yearMonth: query.year_month,
    });

    return reply.send({
      project_id: projectId,
      scope,
      work_date: query.work_date ?? null,
      year_month: query.year_month ?? null,
      total,
    });
  } catch (error: any) {
    console.error('GET /api/summary/project-total failed:', error);

    return reply.status(500).send({
      error: 'failed to fetch project total',
      detail: error?.message ?? String(error),
    });
  }
});

  /**
   * 親プロジェクト配下の子プロジェクト工数を月単位で取得します。
   *
   * 例:
   * GET /api/worklogs/child-month?parent_project_id=1&year_month=2026-05
   */
  fastify.get('/worklogs/child-month', async (request, reply) => {
    try {
      const query = request.query as {
        parent_project_id?: string;
        year_month?: string;
      };

      if (!query.parent_project_id || !query.year_month) {
        return reply.status(400).send({
          message: 'parent_project_id and year_month are required',
        });
      }

      const parentProjectId = Number(query.parent_project_id);

      if (Number.isNaN(parentProjectId)) {
        return reply.status(400).send({
          message: 'invalid parent_project_id',
        });
      }

      const rows = await getChildProjectWorklogsByMonth(
        parentProjectId,
        query.year_month
      );

      return reply.send(rows);
    } catch (error: any) {
      console.error('GET /api/worklogs/child-month failed:', error);

      return reply.status(500).send({
        error: 'failed to fetch child project worklogs by month',
        detail: error?.message ?? String(error),
      });
    }
  });

  /**
   * 工数データをCSV形式でバックアップします。
   *
   * 親子プロジェクト構造も復元できるように、
   * parent_project_id / parent_project_name / status も出力します。
   *
   * GET /api/worklogs/backup.csv
   */
  fastify.get('/worklogs/backup.csv', async (_request, reply) => {
    try {
      const rows = await getAllWorklogsForBackup();

      const headers = [
        'work_date',
        'project_id',
        'project_name',
        'parent_project_id',
        'parent_project_name',
        'status',
        'hours',
        'comment',
      ];

      const csvLines = [
        headers.join(','),
        ...rows.map((row) =>
          [
            row.work_date,
            row.project_id,
            row.project_name,
            row.parent_project_id ?? '',
            row.parent_project_name ?? '',
            row.status ?? 'todo',
            row.hours,
            row.comment ?? '',
          ]
            .map(escapeCsvValue)
            .join(',')
        ),
      ];

      /**
       * Excelで日本語が文字化けしにくいようにBOMを付けます。
       */
      const csvText = `\uFEFF${csvLines.join('\n')}`;

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header(
          'Content-Disposition',
          'attachment; filename="worklogs-backup.csv"'
        )
        .send(csvText);
    } catch (error: any) {
      console.error('GET /api/worklogs/backup.csv failed:', error);

      return reply.status(500).send({
        error: 'failed to backup worklogs',
        detail: error?.message ?? String(error),
      });
    }
  });

  /**
   * CSV形式の工数データを読み込みます。
   *
   * 新形式:
   * work_date,project_id,project_name,parent_project_id,parent_project_name,status,hours,comment
   *
   * 旧形式も最低限対応:
   * work_date,project_id,project_name,hours,comment
   *
   * 仕様:
   * - CSVの project_id が現在DBに存在する場合は、その project_id に工数登録
   * - project_id が存在しない場合、project_name から探す
   * - project_name も存在しない場合、親情報をもとにプロジェクトを作成
   * - 同じ work_date + project_id は upsert で更新
   */
  fastify.post('/worklogs/import-csv', async (request, reply) => {
    try {
      const body = request.body as {
        csvText?: string;
      };

      if (!body.csvText) {
        return reply.status(400).send({
          message: 'csvText is required',
        });
      }

      const rows = parseCsv(body.csvText.replace(/^\uFEFF/, ''));

      if (rows.length <= 1) {
        return reply.status(400).send({
          message: 'CSV has no data rows',
        });
      }

      const headers = rows[0].map((header) => header.trim());

      const workDateIndex = headers.indexOf('work_date');
      const projectIdIndex = headers.indexOf('project_id');
      const projectNameIndex = headers.indexOf('project_name');
      const parentProjectIdIndex = headers.indexOf('parent_project_id');
      const parentProjectNameIndex = headers.indexOf('parent_project_name');
      const statusIndex = headers.indexOf('status');
      const hoursIndex = headers.indexOf('hours');
      const commentIndex = headers.indexOf('comment');

      if (workDateIndex === -1) {
        return reply.status(400).send({
          message: 'CSV must include work_date column',
        });
      }

      if (hoursIndex === -1) {
        return reply.status(400).send({
          message: 'CSV must include hours column',
        });
      }

      if (projectIdIndex === -1 && projectNameIndex === -1) {
        return reply.status(400).send({
          message: 'CSV must include project_id or project_name column',
        });
      }

      let importedCount = 0;

      const skippedRows: {
        rowNumber: number;
        reason: string;
        row?: string[];
      }[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 1;

        const workDate = getOptionalValue(row, workDateIndex);
        const hoursText = getOptionalValue(row, hoursIndex);
        const comment = getOptionalValue(row, commentIndex);

        if (!workDate) {
          skippedRows.push({
            rowNumber,
            reason: 'work_date is empty',
            row,
          });
          continue;
        }

        if (!hoursText) {
          skippedRows.push({
            rowNumber,
            reason: 'hours is empty',
            row,
          });
          continue;
        }

        const hours = Number(hoursText);

        if (Number.isNaN(hours)) {
          skippedRows.push({
            rowNumber,
            reason: 'hours is invalid',
            row,
          });
          continue;
        }

        if (hours < 0 || hours > 24) {
          skippedRows.push({
            rowNumber,
            reason: 'hours must be between 0 and 24',
            row,
          });
          continue;
        }

        const projectName = getOptionalValue(row, projectNameIndex);
        const csvProjectId = getOptionalNumber(row, projectIdIndex);
        const csvParentProjectId = getOptionalNumber(row, parentProjectIdIndex);
        const parentProjectName = getOptionalValue(row, parentProjectNameIndex);
        const status = getOptionalValue(row, statusIndex) ?? 'todo';

        let resolvedProjectId: number | null = null;

        /**
         * 1. CSVの project_id が現在DBに存在する場合は、それを使います。
         */
        if (csvProjectId !== null) {
          const exists = await existsProjectId(csvProjectId);

          if (exists) {
            resolvedProjectId = csvProjectId;
          }
        }

        /**
         * 2. project_id が使えない場合は、project_name / parent情報から
         *    プロジェクトを探す、または作成します。
         */
        if (resolvedProjectId === null) {
          if (!projectName) {
            skippedRows.push({
              rowNumber,
              reason: 'project_id does not exist and project_name is empty',
              row,
            });
            continue;
          }

          resolvedProjectId = await ensureProjectForImport({
            projectId: csvProjectId,
            projectName,
            status,
            parentProjectId: csvParentProjectId,
            parentProjectName,
          });
        }

        await upsertWorklog({
          work_date: workDate,
          project_id: resolvedProjectId,
          hours,
          comment,
        });

        importedCount++;
      }

      return reply.send({
        importedCount,
        skippedCount: skippedRows.length,
        skippedRows,
      });
    } catch (error: any) {
      console.error('POST /api/worklogs/import-csv failed:', error);

      return reply.status(500).send({
        error: 'failed to import worklogs csv',
        detail: error?.message ?? String(error),
      });
    }
  });

  fastify.get('/summary/parent-project-totals', async (request, reply) => {
  try {
    const query = request.query as {
      scope?: string;
      work_date?: string;
      year_month?: string;
    };

    const scope =
      query.scope === 'day' || query.scope === 'month' || query.scope === 'all'
        ? query.scope
        : 'month';

    const rows = await getParentProjectTotals(scope, {
      workDate: query.work_date,
      yearMonth: query.year_month,
    });

    return reply.send(rows);
  } catch (error: any) {
    console.error('GET /api/summary/parent-project-totals failed:', error);

    return reply.status(500).send({
      error: 'failed to fetch parent project totals',
      detail: error?.message ?? String(error),
    });
  }
});

 fastify.get('/summary/parent-bracket-totals', async (request, reply) => {
  try {
    const query = request.query as {
      scope?: string;
      work_date?: string;
      year_month?: string;
    };

    const scope =
      query.scope === 'day' || query.scope === 'month' || query.scope === 'all'
        ? query.scope
        : 'month';

    const rows = await getParentBracketTotals(scope, {
      workDate: query.work_date,
      yearMonth: query.year_month,
    });

    return reply.send(rows);
  } catch (error: any) {
    console.error('GET /api/summary/parent-bracket-totals failed:', error);

    return reply.status(500).send({
      error: 'failed to fetch parent bracket totals',
      detail: error?.message ?? String(error),
    });
  }
});

}