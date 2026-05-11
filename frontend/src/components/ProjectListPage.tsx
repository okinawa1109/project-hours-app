import { useEffect, useMemo, useState } from 'react';
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
} from '../api/projects';
import {
  fetchParentBracketTotals,
  fetchParentProjectTotals,
  type ParentBracketTotalRow,
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

function getScopeLabel(scope: TotalScope, selectedDate: string) {
  if (scope === 'day') {
    return `対象日: ${selectedDate}`;
  }

  if (scope === 'month') {
    return `対象月: ${getYearMonth(selectedDate)}`;
  }

  return '全期間';
}

function getTotalColumnTitle(scope: TotalScope) {
  if (scope === 'day') {
    return '日ごとの合計工数';
  }

  if (scope === 'month') {
    return '月ごとの合計工数';
  }

  return '全体の合計工数';
}

export function ProjectListPage({ selectedDate, onOpenProject }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTotals, setProjectTotals] = useState<ProjectTotalMap>({});
  const [bracketTotals, setBracketTotals] = useState<ParentBracketTotalRow[]>(
    []
  );

  const [newProjectName, setNewProjectName] = useState('');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('todo');

  const [totalScope, setTotalScope] = useState<TotalScope>('month');
  const [errorMessage, setErrorMessage] = useState('');

  const scopeLabel = useMemo(() => {
    return getScopeLabel(totalScope, selectedDate);
  }, [totalScope, selectedDate]);

  /**
   * 親プロジェクト一覧、親プロジェクト別合計、
   * 【xx】ごとの集計をまとめて取得します。
   */
  const loadProjects = async () => {
    try {
      setErrorMessage('');

      const [projectData, parentTotalRows, bracketTotalRows] =
        await Promise.all([
          fetchProjects(null),
          fetchParentProjectTotals(totalScope, selectedDate),
          fetchParentBracketTotals(totalScope, selectedDate),
        ]);

      setProjects(projectData);
      setBracketTotals(bracketTotalRows);

      const totalMap: ProjectTotalMap = {};

      for (const row of parentTotalRows) {
        totalMap[row.project_id] = Number(row.total_hours ?? 0);
      }

      setProjectTotals(totalMap);
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト一覧または合計工数の取得に失敗しました');
    }
  };

  useEffect(() => {
    loadProjects();
  }, [selectedDate, totalScope]);

  /**
   * 親プロジェクトを追加します。
   */
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

  /**
   * 親プロジェクトを更新します。
   */
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

  /**
   * 親プロジェクトを削除します。
   */
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

      <section style={{ marginBottom: 32 }}>
        <h2>工数表示</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setTotalScope('day')}
            disabled={totalScope === 'day'}
          >
            日ごと
          </button>

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
          >
            全体
          </button>

          <strong style={{ marginLeft: 16 }}>{scopeLabel}</strong>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>【xx】ごとの集計</h2>

        {bracketTotals.length === 0 ? (
          <p>集計対象がありません。</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>分類</th>
                <th>{getTotalColumnTitle(totalScope)}</th>
              </tr>
            </thead>

            <tbody>
              {bracketTotals.map((row) => (
                <tr key={row.bracket_name}>
                  <td>{row.bracket_name}</td>
                  <td>{row.total_hours.toFixed(2)} 時間</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>プロジェクト管理</h2>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>プロジェクト名</th>
              <th>ステータス</th>
              <th>{getTotalColumnTitle(totalScope)}</th>
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