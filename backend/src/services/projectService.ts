import { pool } from '../db';
import {
  CreateProjectInput,
  Project,
  ProjectStatus,
  UpdateProjectInput,
} from '../types/project';

const ALLOWED_STATUS: ProjectStatus[] = ['todo', 'doing', 'not_required', 'done'];

function toArchived(status: ProjectStatus): boolean {
  return status === 'done';
}

function isValidStatus(status: unknown): status is ProjectStatus {
  return typeof status === 'string' && ALLOWED_STATUS.includes(status as ProjectStatus);
}

/**
 * Get projects under a parent.
 * parentProjectId = null means root projects.
 */
export async function getProjectsByParent(parentProjectId: number | null): Promise<Project[]> {
  const result = await pool.query<Project>(
    `
    SELECT
      id,
      name,
      status,
      archived,
      parent_project_id,
      created_at,
      updated_at
    FROM projects
    WHERE
      (
        $1::INTEGER IS NULL
        AND parent_project_id IS NULL
      )
      OR parent_project_id = $1
    ORDER BY archived ASC, id ASC
    `,
    [parentProjectId]
  );

  return result.rows;
}

/**
 * Get one project.
 */
export async function getProjectById(id: number): Promise<Project | null> {
  const result = await pool.query<Project>(
    `
    SELECT
      id,
      name,
      status,
      archived,
      parent_project_id,
      created_at,
      updated_at
    FROM projects
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Create root project or child project.
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const status: ProjectStatus =
    input.status && isValidStatus(input.status) ? input.status : 'todo';

  const archived = toArchived(status);

  const result = await pool.query<Project>(
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
    RETURNING
      id,
      name,
      status,
      archived,
      parent_project_id,
      created_at,
      updated_at
    `,
    [
      input.name,
      status,
      archived,
      input.parent_project_id ?? null,
    ]
  );

  return result.rows[0];
}

export async function updateProject(
  id: number,
  input: UpdateProjectInput
): Promise<Project | null> {
  const current = await getProjectById(id);

  if (!current) {
    return null;
  }

  const nextName = input.name ?? current.name;
  const nextStatus =
    input.status && isValidStatus(input.status)
      ? input.status
      : current.status;

  const nextArchived = toArchived(nextStatus);

  const result = await pool.query<Project>(
    `
    UPDATE projects
    SET
      name = $1,
      status = $2,
      archived = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING
      id,
      name,
      status,
      archived,
      parent_project_id,
      created_at,
      updated_at
    `,
    [nextName, nextStatus, nextArchived, id]
  );

  return result.rows[0];
}

export async function deleteProject(id: number): Promise<boolean> {
  const result = await pool.query(
    `
    DELETE FROM projects
    WHERE id = $1
    `,
    [id]
  );

  return (result.rowCount ?? 0) > 0;
}