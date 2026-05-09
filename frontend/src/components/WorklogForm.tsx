import { useEffect, useMemo, useState } from 'react';
import { fetchProjects } from '../api/projects';
import { fetchWorklogsByDate, saveWorklog } from '../api/worklogs';
import { STATUS_LABELS } from '../constants/status';
import { Project } from '../types/project';

type WorklogInputRow = {
  project_id: number;
  hours: string;
  comment: string;
};

type Props = {
  selectedDate: string;
  onSaved?: () => void;
};

export function WorklogForm({ selectedDate, onSaved }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<WorklogInputRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * Load both project master and saved worklog data for the selected date.
   * This makes it possible to re-open the screen and continue editing.
   */
  const load = async () => {
    setLoading(true);
    try {
      const [projectData, savedWorklogs] = await Promise.all([
        fetchProjects(),
        fetchWorklogsByDate(selectedDate),
      ]);

      setProjects(projectData);

      const savedMap = new Map<number, { hours: number; comment: string | null }>();
      for (const item of savedWorklogs) {
        savedMap.set(item.project_id, {
          hours: item.hours,
          comment: item.comment,
        });
      }

      const nextRows = projectData.map((project) => ({
        project_id: project.id,
        hours: savedMap.has(project.id) ? String(savedMap.get(project.id)?.hours ?? '') : '',
        comment: savedMap.get(project.id)?.comment ?? '',
      }));

      setRows(nextRows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedDate]);

  const totalHours = useMemo(() => {
    return rows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0);
  }, [rows]);

  const handleChange = (projectId: number, key: 'hours' | 'comment', value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.project_id === projectId
          ? { ...row, [key]: value }
          : row
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save only rows that have hours value.
      const targets = rows.filter((row) => row.hours !== '' && !Number.isNaN(Number(row.hours)));

      for (const row of targets) {
        await saveWorklog({
          work_date: selectedDate,
          project_id: row.project_id,
          hours: Number(row.hours),
          comment: row.comment || null,
        });
      }

      await load();
      onSaved?.();
      window.alert('保存しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p>工数データを読み込み中...</p>;
  }

  return (
    <section style={{ border: '1px solid #ccc', padding: 16, marginBottom: 24 }}>
      <h2>工数入力</h2>
      <p>対象日: {selectedDate}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>プロジェクト</th>
            <th>ステータス</th>
            <th>アーカイブ</th>
            <th>工数</th>
            <th>コメント</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const row = rows.find((r) => r.project_id === project.id);

            return (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{STATUS_LABELS[project.status]}</td>
                <td>{project.archived ? 'はい' : 'いいえ'}</td>
                <td>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    value={row?.hours ?? ''}
                    onChange={(e) => handleChange(project.id, 'hours', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row?.comment ?? ''}
                    onChange={(e) => handleChange(project.id, 'comment', e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <strong>1日合計: {totalHours.toFixed(2)} 時間</strong>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '登録'}
        </button>
      </div>
    </section>
  );
}