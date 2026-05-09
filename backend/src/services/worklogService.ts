import { pool } from '../db';
import { Worklog, UpsertWorklogInput } from '../types/worklog';

/**
 * Save or update worklog.
 */
export async function upsertWorklog(input: UpsertWorklogInput): Promise<Worklog> {
  const result = await pool.query<Worklog>(
    `
    INSERT INTO worklogs (work_date, project_id, hours, comment, created_at, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (work_date, project_id)
    DO UPDATE SET
      hours = EXCLUDED.hours,
      comment = EXCLUDED.comment,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, work_date, project_id, hours, comment, created_at, updated_at
    `,
    [input.work_date, input.project_id, input.hours, input.comment ?? null]
  );

  return result.rows[0];
}

/**
 * Get saved worklogs for a specific date.
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
    INNER JOIN projects p ON p.id = w.project_id
    WHERE w.work_date = $1
    ORDER BY p.archived ASC, p.id ASC
    `,
    [workDate]
  );

  return result.rows;
}

/**
 * Get total work hours for one day.
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
 * Monthly total by root project.
 * Child project hours are included in parent project total.
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
    GROUP BY p.id, p.name, p.status, p.archived
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
 * Get overall monthly total.
 */
export async function getMonthlyOverallTotal(yearMonth: string): Promise<number> {
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
 * Get daily total for one parent project.
 * This includes:
 * - parent project own worklogs
 * - direct child project worklogs
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
 * Get total hours for a project.
 *
 * scope:
 * - all   : all worklogs
 * - month : only selected month
 *
 * This includes:
 * - the selected project itself
 * - direct child projects
 */
export async function getProjectTotal(
  projectId: number,
  scope: 'all' | 'month',
  yearMonth?: string
): Promise<number> {
  const params: any[] = [projectId];

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
 * Get child project worklogs for a parent project and month.
 *
 * Example:
 * parentProjectId = 1
 * yearMonth = '2026-05'
 *
 * This returns worklogs for projects whose parent_project_id = 1.
 */
export async function getChildProjectWorklogsByMonth(
  parentProjectId: number,
  yearMonth: string
) {
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