import { useEffect, useMemo, useState } from 'react';
import { createProject, fetchProject, fetchProjects } from '../api/projects';
import {
  fetchChildProjectWorklogsByMonth,
  fetchProjectTotal,
  saveWorklog,
  type TotalScope,
} from '../api/worklogs';
import { STATUS_OPTIONS } from '../constants/status';
import type { Project, ProjectStatus } from '../types/project';

type Props = {
  projectId: number;
  selectedDate: string;
  onBack: () => void;
};

type GridValue = {
  hours: string;
  comment: string;
};

type WorklogGrid = Record<string, Record<number, GridValue>>;

type ChildTotalMap = Record<number, number>;

function getYearMonth(date: string) {
  return date.slice(0, 7);
}

function formatDisplayDate(date: string) {
  const [yyyy, mm, dd] = date.split('-');
  return `${yyyy}/${Number(mm)}/${Number(dd)}`;
}

/**
 * 指定月の全日付を作ります。
 *
 * 例:
 * yearMonth = '2026-05'
 * =>
 * [
 *   '2026-05-01',
 *   '2026-05-02',
 *   ...
 *   '2026-05-31'
 * ]
 */
function createDatesInMonth(yearMonth: string): string[] {
  const [yearText, monthText] = yearMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  const lastDay = new Date(year, month, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${yearMonth}-${day}`;
  });
}

export function ProjectDetailPage({
  projectId,
  selectedDate,
  onBack,
}: Props) {
  const [parentProject, setParentProject] = useState<Project | null>(null);
  const [childProjects, setChildProjects] = useState<Project[]>([]);
  const [grid, setGrid] = useState<WorklogGrid>({});
  const [childTotals, setChildTotals] = useState<ChildTotalMap>({});
  const [parentTotal, setParentTotal] = useState(0);

  const [newChildName, setNewChildName] = useState('');
  const [newChildStatus, setNewChildStatus] =
    useState<ProjectStatus>('todo');

  const [totalScope, setTotalScope] = useState<TotalScope>('month');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const yearMonth = getYearMonth(selectedDate);
  const datesInMonth = useMemo(() => {
    return createDatesInMonth(yearMonth);
  }, [yearMonth]);

  /**
   * 親プロジェクト、子プロジェクト、対象月の工数をまとめて取得します。
   */
  const load = async () => {
    try {
      setErrorMessage('');

      const [parent, children, monthlyWorklogs] = await Promise.all([
        fetchProject(projectId),
        fetchProjects(projectId),
        fetchChildProjectWorklogsByMonth(projectId, yearMonth),
      ]);

      setParentProject(parent);
      setChildProjects(children);

      /**
       * 親プロジェクト合計。
       *
       * totalScope:
       * - month: 対象月の合計
       * - all  : 全期間の合計
       */
      const parentTotalValue = await fetchProjectTotal(
        projectId,
        totalScope,
        yearMonth
      );

      setParentTotal(parentTotalValue);

      /**
       * 子プロジェクトごとの合計。
       */
      const childTotalEntries = await Promise.all(
        children.map(async (child) => {
          const total = await fetchProjectTotal(
            child.id,
            totalScope,
            yearMonth
          );

          return [child.id, total] as const;
        })
      );

      setChildTotals(Object.fromEntries(childTotalEntries));

      /**
       * 一覧入力用のグリッドを作成します。
       *
       * grid[日付][子プロジェクトID] = {
       *   hours,
       *   comment
       * }
       */
      const nextGrid: WorklogGrid = {};

      for (const date of datesInMonth) {
        nextGrid[date] = {};

        for (const child of children) {
          nextGrid[date][child.id] = {
            hours: '',
            comment: '',
          };
        }
      }

      for (const worklog of monthlyWorklogs) {
        const workDate = String(worklog.work_date).slice(0, 10);
        const projectId = Number(worklog.project_id);

        if (!nextGrid[workDate]) {
          nextGrid[workDate] = {};
        }

        nextGrid[workDate][projectId] = {
          hours: String(worklog.hours ?? ''),
          comment: worklog.comment ?? '',
        };
      }

      setGrid(nextGrid);
    } catch (error) {
      console.error(error);
      setErrorMessage('プロジェクト詳細の取得に失敗しました');
    }
  };

  useEffect(() => {
    load();
  }, [projectId, selectedDate, totalScope]);

  /**
   * 1日ごとの合計を計算します。
   */
  const getDailyTotal = (date: string) => {
    const dateRow = grid[date] ?? {};

    return childProjects.reduce((sum, child) => {
      const value = Number(dateRow[child.id]?.hours || 0);
      return sum + value;
    }, 0);
  };

  /**
   * 入力中の対象月合計です。
   * まだ保存前の値も含みます。
   */
  const inputMonthTotal = useMemo(() => {
    return datesInMonth.reduce((sum, date) => {
      return sum + getDailyTotal(date);
    }, 0);
  }, [datesInMonth, grid, childProjects]);

  const handleAddChildProject = async () => {
    if (!newChildName.trim()) {
      return;
    }

    try {
      setErrorMessage('');

      await createProject({
        name: newChildName.trim(),
        status: newChildStatus,
        parent_project_id: projectId,
      });

      setNewChildName('');
      setNewChildStatus('todo');

      await load();
    } catch (error) {
      console.error(error);
      setErrorMessage('子プロジェクト追加に失敗しました');
    }
  };

  const handleGridChange = (
    date: string,
    childProjectId: number,
    key: 'hours' | 'comment',
    value: string
  ) => {
    setGrid((prev) => {
      const currentDateRow = prev[date] ?? {};
      const currentCell = currentDateRow[childProjectId] ?? {
        hours: '',
        comment: '',
      };

      return {
        ...prev,
        [date]: {
          ...currentDateRow,
          [childProjectId]: {
            ...currentCell,
            [key]: value,
          },
        },
      };
    });
  };

  /**
   * 一覧形式で入力した工数を保存します。
   *
   * 空欄は保存しません。
   * 0 と入力した場合は 0 として保存します。
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMessage('');

      for (const date of datesInMonth) {
        for (const child of childProjects) {
          const cell = grid[date]?.[child.id];

          if (!cell) {
            continue;
          }

          if (cell.hours === '') {
            continue;
          }

          const hours = Number(cell.hours);

          if (Number.isNaN(hours)) {
            continue;
          }

          await saveWorklog({
            work_date: date,
            project_id: child.id,
            hours,
            comment: cell.comment || null,
          });
        }
      }

      await load();

      alert('子プロジェクトの工数を保存しました');
    } catch (error) {
      console.error(error);
      setErrorMessage('工数保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (parentProject === null) {
    return <p>読み込み中...</p>;
  }

  return (
    <section>
      <button type="button" onClick={onBack} style={{ marginBottom: 16 }}>
        ← プロジェクト一覧へ戻る
      </button>

      <h2>{parentProject.name}</h2>

      <p>
        親プロジェクト工数合計時間：
        <strong>{parentTotal.toFixed(2)} 時間</strong>
      </p>

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

      {errorMessage !== '' && (
        <p style={{ color: 'red' }}>{errorMessage}</p>
      )}

      <hr />

      <h3>子プロジェクト追加</h3>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          value={newChildName}
          onChange={(event) => setNewChildName(event.target.value)}
          placeholder="子プロジェクト名"
          style={{ flex: 1 }}
        />

        <select
          value={newChildStatus}
          onChange={(event) =>
            setNewChildStatus(event.target.value as ProjectStatus)
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={handleAddChildProject}>
          子プロジェクト追加
        </button>
      </div>

      <h3>子プロジェクト工数入力</h3>

      {childProjects.length === 0 ? (
        <p>子プロジェクトがありません。</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: 900,
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th>年月日</th>

                  {childProjects.map((child) => (
                    <th key={child.id}>
                      <div>{child.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 'normal' }}>
                        {totalScope === 'month' ? '月合計' : '全体合計'}：
                        {(childTotals[child.id] ?? 0).toFixed(2)} 時間
                      </div>
                    </th>
                  ))}

                  <th>1日の合計</th>
                </tr>
              </thead>

              <tbody>
                {datesInMonth.map((date) => (
                  <tr key={date}>
                    <td>{formatDisplayDate(date)}</td>

                    {childProjects.map((child) => {
                      const cell = grid[date]?.[child.id] ?? {
                        hours: '',
                        comment: '',
                      };

                      return (
                        <td key={child.id}>
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.25"
                            value={cell.hours}
                            onChange={(event) =>
                              handleGridChange(
                                date,
                                child.id,
                                'hours',
                                event.target.value
                              )
                            }
                            style={{ width: 80 }}
                          />
                        </td>
                      );
                    })}

                    <td>{getDailyTotal(date).toFixed(2)} 時間</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p>
            入力中の月合計：
            <strong>{inputMonthTotal.toFixed(2)} 時間</strong>
          </p>

          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '登録'}
          </button>
        </>
      )}
    </section>
  );
}