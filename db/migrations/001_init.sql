-- 001_init.sql
-- Important:
-- Keep this file UTF-8 without BOM if possible.
-- Avoid Japanese literals in SQL files for Windows compatibility.

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'todo',
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worklogs (
    id SERIAL PRIMARY KEY,
    work_date DATE NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    hours NUMERIC(5,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1 project per date
CREATE UNIQUE INDEX IF NOT EXISTS uq_worklogs_work_date_project_id
ON worklogs(work_date, project_id);