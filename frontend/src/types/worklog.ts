export interface WorklogRow {
  id: number;
  work_date: string;
  project_id: number;
  hours: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  project_name: string;
  project_status: string;
  project_archived: boolean;
}