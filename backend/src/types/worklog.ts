export interface Worklog {
  id: number;
  work_date: string; // YYYY-MM-DD
  project_id: number;
  hours: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertWorklogInput {
  work_date: string;
  project_id: number;
  hours: number;
  comment?: string | null;
}