import { Project, ProjectStatus } from '../types/project';

const API_BASE = 'http://localhost:3000/api';

/**
 * プロジェクト一覧を取得します。
 * parentProjectId が null の場合は親プロジェクト一覧、
 * 数値の場合はその親に紐づく子プロジェクト一覧を取得します。
 */
export async function fetchProjects(
  parentProjectId: number | null = null
): Promise<Project[]> {
  const url =
    parentProjectId == null
      ? `${API_BASE}/projects`
      : `${API_BASE}/projects?parent_project_id=${parentProjectId}`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchProjects failed:', text);
    throw new Error(text);
  }

  return res.json();
}

/**
 * プロジェクト1件を取得します。
 */
export async function fetchProject(projectId: number): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${projectId}`);

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchProject failed:', text);
    throw new Error(text);
  }

  return res.json();
}

/**
 * プロジェクトを新規作成します。
 *
 * 重要:
 * name だけでなく、status と parent_project_id もそのまま送ります。
 */
export async function createProject(payload: {
  name: string;
  status?: ProjectStatus;
  parent_project_id?: number | null;
}): Promise<Project> {
  console.log('createProject payload:', payload);

  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('createProject failed:', text);
    throw new Error(text);
  }

  return res.json();
}

/**
 * プロジェクトを更新します。
 */
export async function updateProject(
  projectId: number,
  payload: {
    name?: string;
    status?: ProjectStatus;
  }
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('updateProject failed:', text);
    throw new Error(text);
  }

  return res.json();
}

/**
 * プロジェクトを削除します。
 */
export async function deleteProject(projectId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('deleteProject failed:', text);
    throw new Error(text);
  }
}