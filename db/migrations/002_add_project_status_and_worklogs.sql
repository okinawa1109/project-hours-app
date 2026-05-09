-- 002_add_project_status_and_worklogs.sql
-- Windows + psql safe version:
-- 1. Avoid DO $$ blocks
-- 2. Avoid Japanese literals
-- 3. Use English enum-like values in VARCHAR

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'todo';

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE projects
DROP CONSTRAINT IF EXISTS chk_projects_status;

ALTER TABLE projects
ADD CONSTRAINT chk_projects_status
CHECK (status IN ('todo', 'doing', 'not_required', 'done'));

CREATE TABLE IF NOT EXISTS worklogs (
    id SERIAL PRIMARY KEY,
    work_date DATE NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    hours NUMERIC(5,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_worklogs_work_date_project_id
ON worklogs(work_date, project_id);