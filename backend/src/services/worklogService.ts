import { pool } from '../db';
import { Worklog, UpsertWorklogInput } from '../types/worklog';

/**
 * 工数を登録・更新します。
 *
 * 同じ work_date + project_id が既に存在する場合は更新します。
 */
export async function upsertWorklog(
  input: UpsertWorklogInput
): Promise<Worklog> {
  const result = await pool.query<Worklog>(
    `
    INSERT INTO worklogs (
      work_date,
      project_id,
      hours,
      comment,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (work_date, project_id)
    DO UPDATE SET
      hours = EXCLUDED.hours,
      comment = EXCLUDED.comment,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      id,
      work_date,
      project_id,
      hours,
      comment,
      created_at,
      updated_at
    `,
    [
      input.work_date,
      input.project_id,
      input.hours,
      input.comment ?? null,
    ]
  );

  return result.rows[0];
}

/**
 * 指定日の工数一覧を取得します。
 */
export async function getWorklogsByDate(workDate: string) {
  const result = await pool.query(
    `
    SELECT
      w.id,
      w.work_date,
      w.project_id,
      w.hours,
      w.comment,
      w.created_at,
      w.updated_at,
      p.name AS project_name,
      p.status AS project_status,
      p.archived AS project_archived
    FROM worklogs w
    INNER JOIN projects p
      ON p.id = w.project_id
    WHERE w.work_date = $1
    ORDER BY p.archived ASC, p.id ASC
    `,
    [workDate]
  );

  return result.rows.map((row) => ({
    ...row,
    hours: Number(row.hours),
  }));
}

/**
 * 指定日の全体工数合計を取得します。
 */
export async function getDailyTotal(workDate: string): Promise<number> {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(hours), 0) AS total
    FROM worklogs
    WHERE work_date = $1
    `,
    [workDate]
  );

  return Number(result.rows[0].total);
}

/**
 * 月ごとの親プロジェクト別合計を取得します。
 *
 * 親プロジェクトの合計には以下を含めます。
 * - 親プロジェクト自身の工数
 * - 直接の子プロジェクトの工数
 */
export async function getMonthlyProjectSummary(yearMonth: string) {
  const result = await pool.query(
    `
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      p.status AS project_status,
      p.archived AS project_archived,
      COALESCE(SUM(w.hours), 0) AS total_hours
    FROM projects p
    LEFT JOIN projects child
      ON child.parent_project_id = p.id
    LEFT JOIN worklogs w
      ON (
        w.project_id = p.id
        OR w.project_id = child.id
      )
      AND TO_CHAR(w.work_date, 'YYYY-MM') = $1
    WHERE p.parent_project_id IS NULL
    GROUP BY
      p.id,
      p.name,
      p.status,
      p.archived
    ORDER BY p.archived ASC, p.id ASC
    `,
    [yearMonth]
  );

  return result.rows.map((row) => ({
    ...row,
    total_hours: Number(row.total_hours),
  }));
}

/**
 * 指定月の全体工数合計を取得します。
 */
export async function getMonthlyOverallTotal(
  yearMonth: string
): Promise<number> {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(hours), 0) AS total
    FROM worklogs
    WHERE TO_CHAR(work_date, 'YYYY-MM') = $1
    `,
    [yearMonth]
  );

  return Number(result.rows[0].total);
}

/**
 * 親プロジェクトの日別合計を取得します。
 *
 * 以下を合計します。
 * - 親プロジェクト自身の工数
 * - 直接の子プロジェクトの工数
 */
export async function getProjectDailyTotal(
  projectId: number,
  workDate: string
): Promise<number> {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(w.hours), 0) AS total
    FROM worklogs w
    WHERE w.work_date = $1
      AND (
        w.project_id = $2
        OR w.project_id IN (
          SELECT id
          FROM projects
          WHERE parent_project_id = $2
        )
      )
    `,
    [workDate, projectId]
  );

  return Number(result.rows[0].total);
}

/**
 * プロジェクトの合計工数を取得します。
 *
 * scope:
 * - all   : 全期間
 * - month : 指定月
 *
 * 親プロジェクトの場合、以下を合計します。
 * - 親プロジェクト自身の工数
 * - 直接の子プロジェクトの工数
 */
export async function getProjectTotal(
  projectId: number,
  scope: 'all' | 'month',
  yearMonth?: string
): Promise<number> {
  const params: Array<number | string> = [projectId];

  let monthCondition = '';

  if (scope === 'month') {
    if (!yearMonth) {
      throw new Error('yearMonth is required when scope is month');
    }

    params.push(yearMonth);
    monthCondition = `AND TO_CHAR(w.work_date, 'YYYY-MM') = $2`;
  }

  const result = await pool.query(
    `
    SELECT COALESCE(SUM(w.hours), 0) AS total
    FROM worklogs w
    WHERE
      (
        w.project_id = $1
        OR w.project_id IN (
          SELECT id
          FROM projects
          WHERE parent_project_id = $1
        )
      )
      ${monthCondition}
    `,
    params
  );

  return Number(result.rows[0].total);
}

/**
 * 親プロジェクト配下の子プロジェクト工数を、月単位で取得します。
 *
 * 一覧入力画面で使用します。
 */
export async function getChildProjectWorklogsByMonth(
  parentProjectId: number,
  yearMonth: string
) {
  const result = await pool.query(
    `
    SELECT
      w.id,
      TO_CHAR(w.work_date, 'YYYY-MM-DD') AS work_date,
      w.project_id,
      w.hours,
      w.comment,
      w.created_at,
      w.updated_at,
      p.name AS project_name,
      p.status AS project_status,
      p.archived AS project_archived
    FROM worklogs w
    INNER JOIN projects p
      ON p.id = w.project_id
    WHERE p.parent_project_id = $1
      AND TO_CHAR(w.work_date, 'YYYY-MM') = $2
    ORDER BY w.work_date ASC, p.id ASC
    `,
    [parentProjectId, yearMonth]
  );

  return result.rows.map((row) => ({
    ...row,
    hours: Number(row.hours),
  }));
}

/**
 * CSVバックアップ用に、全工数データを取得します。
 *
 * 親子プロジェクト構造を復元できるように、
 * parent_project_id / parent_project_name / status も出力します。
 */
export async function getAllWorklogsForBackup() {
  const result = await pool.query(
    `
    SELECT
      TO_CHAR(w.work_date, 'YYYY-MM-DD') AS work_date,
      w.project_id,
      p.name AS project_name,
      p.parent_project_id,
      parent.name AS parent_project_name,
      p.status,
      w.hours,
      w.comment
    FROM worklogs w
    INNER JOIN projects p
      ON p.id = w.project_id
    LEFT JOIN projects parent
      ON parent.id = p.parent_project_id
    ORDER BY
      w.work_date ASC,
      p.parent_project_id ASC NULLS FIRST,
      w.project_id ASC
    `
  );

  return result.rows.map((row) => ({
    ...row,
    hours: Number(row.hours),
  }));
}

/**
 * project_id が現在のDBに存在するか確認します。
 */
export async function existsProjectId(projectId: number): Promise<boolean> {
  const result = await pool.query(
    `
    SELECT id
    FROM projects
    WHERE id = $1
    `,
    [projectId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * project_id でプロジェクトを取得します。
 *
 * CSV読み込み時に、CSV上の project_id が現在DBに存在するか確認するために使います。
 */
export async function getProjectByIdForImport(projectId: number) {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      status,
      archived,
      parent_project_id
    FROM projects
    WHERE id = $1
    `,
    [projectId]
  );

  return result.rows[0] ?? null;
}

/**
 * プロジェクト名から project_id を取得します。
 *
 * 現在のDBでは projects.name に UNIQUE 制約がある想定です。
 */
export async function findProjectIdByName(
  projectName: string
): Promise<number | null> {
  const result = await pool.query(
    `
    SELECT id
    FROM projects
    WHERE name = $1
    ORDER BY id ASC
    LIMIT 1
    `,
    [projectName]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return Number(result.rows[0].id);
}

/**
 * CSV読み込み時に、プロジェクトが存在しなければ作成します。
 *
 * CSV上の project_id は、別DBでは一致しない可能性があります。
 * そのため最終的には、現在DB上の project_id を返します。
 *
 * 処理順:
 * 1. CSVの project_id が現在DBに存在するなら、それを使う
 * 2. project_name が現在DBに存在するなら、それを使う
 * 3. parent_project_name があれば、親プロジェクトを探す・なければ作る
 * 4. 対象プロジェクトを作る
 */
export async function ensureProjectForImport(input: {
  projectId?: number | null;
  projectName: string;
  status?: string | null;
  parentProjectId?: number | null;
  parentProjectName?: string | null;
}): Promise<number> {
  if (input.projectId != null) {
    const existingById = await getProjectByIdForImport(input.projectId);

    if (existingById) {
      return Number(existingById.id);
    }
  }

  const projectName = input.projectName.trim();

  if (!projectName) {
    throw new Error('projectName is required');
  }

  const existingByName = await findProjectIdByName(projectName);

  if (existingByName !== null) {
    return existingByName;
  }

  let resolvedParentProjectId: number | null = null;

  if (input.parentProjectId != null) {
    const parentById = await getProjectByIdForImport(input.parentProjectId);

    if (parentById) {
      resolvedParentProjectId = Number(parentById.id);
    }
  }

  if (
    resolvedParentProjectId === null &&
    input.parentProjectName &&
    input.parentProjectName.trim() !== ''
  ) {
    const parentProjectName = input.parentProjectName.trim();

    const parentByName = await findProjectIdByName(parentProjectName);

    if (parentByName !== null) {
      resolvedParentProjectId = parentByName;
    } else {
      const createdParent = await pool.query(
        `
        INSERT INTO projects (
          name,
          status,
          archived,
          parent_project_id,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
        `,
        [
          parentProjectName,
          'todo',
          false,
        ]
      );

      resolvedParentProjectId = Number(createdParent.rows[0].id);
    }
  }

  const status =
    input.status === 'todo' ||
    input.status === 'doing' ||
    input.status === 'not_required' ||
    input.status === 'done'
      ? input.status
      : 'todo';

  const archived = status === 'done';

  const created = await pool.query(
    `
    INSERT INTO projects (
      name,
      status,
      archived,
      parent_project_id,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id
    `,
    [
      projectName,
      status,
      archived,
      resolvedParentProjectId,
    ]
  );

  return Number(created.rows[0].id);
}