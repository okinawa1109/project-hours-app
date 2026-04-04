-- =========================================
-- projects テーブルに status / is_archived を追加
-- 既存環境向けのマイグレーションSQL
-- =========================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo';

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- ステータスの値を制限する CHECK 制約を追加
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('todo', 'doing', 'not_required', 'done'));

-- 既に完了になっているレコードがあればアーカイブ扱いに寄せる
UPDATE projects
SET status = 'done',
    is_archived = TRUE
WHERE is_archived = TRUE;
