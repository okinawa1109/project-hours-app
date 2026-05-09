import { useEffect, useState } from 'react';
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
} from '../api/projects';
import { STATUS_OPTIONS } from '../constants/status';
import type { Project, ProjectStatus } from '../types/project';

type Props = {
  onProjectsChanged?: () => void;
};

export function ProjectManager({ onProjectsChanged }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('todo');
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * プロジェクト一覧を取得
   */
  const loadProjects = async () => {
    try {
      setErrorMessage('');

      const data = await fetchProjects(null);

      console.log('loaded projects:', data);

      setProjects(data);
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト一覧の取得に失敗しました');
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  /**
   * プロジェクト追加
   */
  const handleCreate = async () => {
    if (!newProjectName.trim()) {
      return;
    }

    const payload = {
      name: newProjectName.trim(),
      status: newStatus,
      parent_project_id: null,
    };

    console.log('ProjectManager payload:', payload);

    try {
      setErrorMessage('');

      await createProject(payload);

      setNewProjectName('');
      setNewStatus('todo');

      await loadProjects();

      onProjectsChanged?.();
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト追加に失敗しました');
    }
  };

  /**
   * プロジェクト更新
   */
  const handleUpdate = async (
    projectId: number,
    name: string,
    status: ProjectStatus
  ) => {
    try {
      setErrorMessage('');

      await updateProject(projectId, {
        name,
        status,
      });

      await loadProjects();

      onProjectsChanged?.();
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト更新に失敗しました');
    }
  };

  /**
   * プロジェクト削除
   */
  const handleDelete = async (projectId: number) => {
    const ok = window.confirm('削除しますか？');

    if (!ok) {
      return;
    }

    try {
      setErrorMessage('');

      await deleteProject(projectId);

      await loadProjects();

      onProjectsChanged?.();
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト削除に失敗しました');
    }
  };

  return (
    <section style={{ marginBottom: 24 }}>
      <h2>プロジェクト追加</h2>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          placeholder="プロジェクト名"
          style={{ flex: 1 }}
        />

        <select
          value={newStatus}
          onChange={(event) =>
            setNewStatus(event.target.value as ProjectStatus)
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleCreate}
        >
          追加
        </button>
      </div>

      {errorMessage !== '' && (
        <p style={{ color: 'red' }}>
          {errorMessage}
        </p>
      )}

      <h2>プロジェクト管理</h2>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr>
            <th>ID</th>
            <th>プロジェクト名</th>
            <th>ステータス</th>
            <th>操作</th>
          </tr>
        </thead>

        <tbody>
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

type ProjectRowProps = {
  project: Project;
  onUpdate: (
    projectId: number,
    name: string,
    status: ProjectStatus
  ) => Promise<void>;
  onDelete: (projectId: number) => Promise<void>;
};

function ProjectRow({
  project,
  onUpdate,
  onDelete,
}: ProjectRowProps) {
  const [name, setName] = useState(project.name);
  const [status, setStatus] =
    useState<ProjectStatus>(project.status);

  return (
    <tr>
      <td>{project.id}</td>

      <td>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </td>

      <td>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as ProjectStatus)
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </td>

      <td>
        <button
          type="button"
          onClick={() =>
            onUpdate(project.id, name, status)
          }
        >
          更新
        </button>

        <button
          type="button"
          onClick={() =>
            onDelete(project.id)
          }
          style={{ marginLeft: 8 }}
        >
          削除
        </button>
      </td>
    </tr>
  );
}