/**
 * Monthly total by project.
 *
 * Root project total includes:
 * - its own worklogs
 * - direct child project worklogs
 *
 * This version supports one parent-child level.
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
 * Daily total by project.
 *
 * Used for showing parent project total on the project page.
 */
export async function getProjectDailyTotal(projectId: number, workDate: string) {
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