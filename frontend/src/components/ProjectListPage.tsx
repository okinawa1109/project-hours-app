import { useEffect, useState } from 'react';
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
} from '../api/projects';
import {
  fetchProjectTotal,
  type TotalScope,
} from '../api/worklogs';
import { STATUS_OPTIONS } from '../constants/status';
import type { Project, ProjectStatus } from '../types/project';

type Props = {
  selectedDate: string;
  onOpenProject: (projectId: number) => void;
};

type ProjectTotalMap = Record<number, number>;

function getYearMonth(date: string) {
  return date.slice(0, 7);
}

export function ProjectListPage({ selectedDate, onOpenProject }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTotals, setProjectTotals] = useState<ProjectTotalMap>({});
  const [newProjectName, setNewProjectName] = useState('');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('todo');
  const [totalScope, setTotalScope] = useState<TotalScope>('month');
  const [errorMessage, setErrorMessage] = useState('');

  const yearMonth = getYearMonth(selectedDate);

  /**
   * 親プロジェクト一覧と、親プロジェクトごとの合計工数を取得します。
   *
   * totalScope:
   * - all   : 全体工数
   * - month : 対象月の工数
   */
  const loadProjects = async () => {
    try {
      setErrorMessage('');

      const projectData = await fetchProjects(null);
      setProjects(projectData);

      const totalEntries = await Promise.all(
        projectData.map(async (project) => {
          const total = await fetchProjectTotal(
            project.id,
            totalScope,
            yearMonth
          );

          return [project.id, total] as const;
        })
      );

      setProjectTotals(Object.fromEntries(totalEntries));
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト一覧または合計工数の取得に失敗しました');
    }
  };

  useEffect(() => {
    loadProjects();
  }, [selectedDate, totalScope]);

  const handleCreate = async () => {
    if (!newProjectName.trim()) {
      return;
    }

    try {
      setErrorMessage('');

      await createProject({
        name: newProjectName.trim(),
        status: newStatus,
        parent_project_id: null,
      });

      setNewProjectName('');
      setNewStatus('todo');

      await loadProjects();
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト追加に失敗しました');
    }
  };

  const handleUpdate = async (
    projectId: number,
    name: string,
    status: ProjectStatus
  ) => {
    try {
      setErrorMessage('');

      await updateProject(projectId, {
        name: name.trim(),
        status,
      });

      await loadProjects();
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト更新に失敗しました');
    }
  };

  const handleDelete = async (projectId: number) => {
    const ok = window.confirm('このプロジェクトを削除しますか？');

    if (!ok) {
      return;
    }

    try {
      setErrorMessage('');

      await deleteProject(projectId);

      await loadProjects();
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト削除に失敗しました');
    }
  };

  return (
    <>
      <section style={{ marginBottom: 32 }}>
        <h2>プロジェクト追加</h2>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            placeholder="親プロジェクト名"
            style={{ flex: 1 }}
          />

          <select
            value={newStatus}
            onChange={(event) =>
              setNewStatus(event.target.value as ProjectStatus)
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button type="button" onClick={handleCreate}>
            追加
          </button>
        </div>

        {errorMessage !== '' && (
          <p style={{ color: 'red' }}>{errorMessage}</p>
        )}
      </section>

      <section>
        <h2>プロジェクト管理</h2>

        <div style={{ marginBottom: 16 }}>
          <span style={{ marginRight: 8 }}>工数表示:</span>

          <button
            type="button"
            onClick={() => setTotalScope('month')}
            disabled={totalScope === 'month'}
          >
            月ごと
          </button>

          <button
            type="button"
            onClick={() => setTotalScope('all')}
            disabled={totalScope === 'all'}
            style={{ marginLeft: 8 }}
          >
            全体
          </button>

          <span style={{ marginLeft: 16 }}>
            {totalScope === 'month'
              ? `対象月: ${yearMonth}`
              : '全期間'}
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>プロジェクト名</th>
              <th>ステータス</th>
              <th>
                {totalScope === 'month'
                  ? '月ごとの合計工数'
                  : '全体の合計工数'}
              </th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                totalHours={projectTotals[project.id] ?? 0}
                onOpenProject={onOpenProject}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

type ProjectRowProps = {
  project: Project;
  totalHours: number;
  onOpenProject: (projectId: number) => void;
  onUpdate: (
    projectId: number,
    name: string,
    status: ProjectStatus
  ) => Promise<void>;
  onDelete: (projectId: number) => Promise<void>;
};

function ProjectRow({
  project,
  totalHours,
  onOpenProject,
  onUpdate,
  onDelete,
}: ProjectRowProps) {
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState<ProjectStatus>(project.status);

  useEffect(() => {
    setName(project.name);
    setStatus(project.status);
  }, [project]);

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
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>

      <td>{totalHours.toFixed(2)} 時間</td>

      <td>
        <button type="button" onClick={() => onOpenProject(project.id)}>
          開く
        </button>

        <button
          type="button"
          onClick={() => onUpdate(project.id, name, status)}
          style={{ marginLeft: 8 }}
        >
          更新
        </button>

        <button
          type="button"
          onClick={() => onDelete(project.id)}
          style={{ marginLeft: 8 }}
        >
          削除
        </button>
      </td>
    </tr>
  );
}