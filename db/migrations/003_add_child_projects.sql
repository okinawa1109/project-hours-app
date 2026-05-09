-- Add parent-child relation to projects.
-- Keep SQL literals English only for Windows compatibility.

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS parent_project_id INTEGER;

ALTER TABLE projects
DROP CONSTRAINT IF EXISTS fk_projects_parent_project;

ALTER TABLE projects
ADD CONSTRAINT fk_projects_parent_project
FOREIGN KEY (parent_project_id)
REFERENCES projects(id)
ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_parent_project_id
ON projects(parent_project_id);