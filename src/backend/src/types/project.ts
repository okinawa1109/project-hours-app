export type ProjectStatus = 'todo' | 'doing' | 'not_required' | 'done';

export interface Project {
  id: number;
  name: string;
  status: ProjectStatus;
  archived: boolean;
  parent_project_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  status?: ProjectStatus;
  parent_project_id?: number | null;
}

export interface UpdateProjectInput {
  name?: string;
  status?: ProjectStatus;
}