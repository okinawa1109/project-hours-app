import { FormEvent, useEffect, useMemo, useState } from "react";
import "./App.css";

/**
 * プロジェクト情報
 */
type Project = {
  id: number;
  name: string;
  status: "todo" | "doing" | "not_required" | "done";
  is_archived: boolean;
};

/**
 * 工数明細
 */
type WorkLog = {
  work_date: string;
  project_id: number;
  hours: string | number;
};

/**
 * 集計結果
 */
type Summary = {
  project_id: number;
  name: string;
  status: string;
  is_archived: boolean;
  total_hours: string | number;
};

/**
 * ステータス選択肢
 */
const PROJECT_STATUSES = ["todo", "doing", "not_required", "done"] as const;

const STATUS_LABELS: Record<string, string> = {
  todo: "未着手",
  doing: "対応中",
  not_required: "対応不要",
  done: "完了"
};

/**
 * API エンドポイント
 */
const API_BASE = "http://localhost:3000";

/**
 * YYYY-MM を返す
 */
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 指定月の日付一覧を生成する
 */
function getDaysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();

  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1;
    return `${month}-${String(day).padStart(2, "0")}`;
  });
}

export default function App() {
  // -----------------------------
  // 画面状態
  // -----------------------------
  const [month, setMonth] = useState(getCurrentMonth());
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [workMap, setWorkMap] = useState<Record<string, number>>({});
  const [monthlySummary, setMonthlySummary] = useState<Summary[]>([]);
  const [allSummary, setAllSummary] = useState<Summary[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectError, setProjectError] = useState("");
  const [projectSuccess, setProjectSuccess] = useState("");

  /**
   * 編集用の一時状態
   * プロジェクト一覧テーブルで name/status を編集するために使う
   */
  const [editProjectMap, setEditProjectMap] = useState<
    Record<number, { name: string; status: Project["status"] }>
  >({});

  const days = useMemo(() => getDaysInMonth(month), [month]);

  /**
   * workMap 用のキー
   * 例: 2026-03-01_1
   */
  const cellKey = (date: string, projectId: number) => `${date}_${projectId}`;

  /**
   * サーバーから必要なデータをまとめて取得する
   */
  const loadAll = async () => {
    const [pRes, archivedRes, wRes, mRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/projects`),
      fetch(`${API_BASE}/projects/archived`),
      fetch(`${API_BASE}/worklogs?month=${month}`),
      fetch(`${API_BASE}/summary/monthly?month=${month}`),
      fetch(`${API_BASE}/summary/all`)
    ]);

    const projectsData: Project[] = await pRes.json();
    const archivedData: Project[] = await archivedRes.json();
    const worklogsData: WorkLog[] = await wRes.json();
    const monthlyData: Summary[] = await mRes.json();
    const allData: Summary[] = await aRes.json();

    // 工数入力マップを作る
    const map: Record<string, number> = {};
    for (const row of worklogsData) {
      map[cellKey(row.work_date, row.project_id)] = Number(row.hours);
    }

    // 編集用の name/status を初期化する
    const editMap: Record<number, { name: string; status: Project["status"] }> = {};
    [...projectsData, ...archivedData].forEach((project) => {
      editMap[project.id] = {
        name: project.name,
        status: project.status
      };
    });

    setProjects(projectsData);
    setArchivedProjects(archivedData);
    setWorkMap(map);
    setMonthlySummary(monthlyData);
    setAllSummary(allData);
    setEditProjectMap(editMap);
  };

  /**
   * 月が変わったら再読み込み
   */
  useEffect(() => {
    loadAll();
  }, [month]);

  /**
   * 工数変更時の保存処理
   * 現状は onChange 保存
   * 将来 onBlur 保存に変えることもできる
   */
  const handleChange = async (date: string, projectId: number, value: string) => {
    const hours = value === "" ? 0 : Number(value);

    setWorkMap((prev) => ({
      ...prev,
      [cellKey(date, projectId)]: Number.isNaN(hours) ? 0 : hours
    }));

    await fetch(`${API_BASE}/worklogs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        work_date: date,
        project_id: projectId,
        hours: Number.isNaN(hours) ? 0 : hours
      })
    });

    const [mRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/summary/monthly?month=${month}`),
      fetch(`${API_BASE}/summary/all`)
    ]);

    setMonthlySummary(await mRes.json());
    setAllSummary(await aRes.json());
  };

  /**
   * 新規プロジェクト追加
   */
  const handleAddProject = async (e: FormEvent) => {
    e.preventDefault();

    setProjectError("");
    setProjectSuccess("");

    const name = newProjectName.trim();

    if (!name) {
      setProjectError("プロジェクト名を入力してください");
      return;
    }

    const res = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name })
    });

    const data = await res.json();

    if (!res.ok) {
      setProjectError(
        data?.error === "project already exists"
          ? "同じプロジェクト名が既に存在します"
          : "プロジェクト追加に失敗しました"
      );
      return;
    }

    setNewProjectName("");
    setProjectSuccess(`「${data.name}」を追加しました`);
    await loadAll();
  };

  /**
   * プロジェクト編集欄の変更
   */
  const handleProjectFieldChange = (
    projectId: number,
    field: "name" | "status",
    value: string
  ) => {
    setEditProjectMap((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [field]: value
      }
    }));
  };

  /**
   * プロジェクト更新
   * status=完了 のとき backend 側で自動アーカイブされる
   */
  const handleUpdateProject = async (projectId: number) => {
    const target = editProjectMap[projectId];

    if (!target?.name.trim()) {
      alert("プロジェクト名を入力してください");
      return;
    }

    const res = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: target.name.trim(),
        status: target.status
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (data?.error === "project already exists") {
        alert("同じプロジェクト名が既に存在します");
      } else {
        alert("プロジェクト更新に失敗しました");
      }
      return;
    }

    await loadAll();

    if (data.status === "done") {
      alert("完了に更新したため、アーカイブへ移動しました");
    } else {
      alert("プロジェクトを更新しました");
    }
  };

  /**
   * プロジェクト削除
   * 関連工数も一緒に削除される
   */
  const handleDeleteProject = async (projectId: number, projectName: string) => {
    const ok = window.confirm(
      `プロジェクト「${projectName}」を削除しますか？\n関連する工数データも削除されます。`
    );

    if (!ok) return;

    const res = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      alert("プロジェクト削除に失敗しました");
      return;
    }

    await loadAll();
    alert("プロジェクトを削除しました");
  };

  /**
   * 1日合計を計算する
   * 工数入力対象はアクティブな未アーカイブ案件のみ
   */
  const getDailyTotal = (date: string) => {
    return projects.reduce((sum, project) => {
      return sum + (workMap[cellKey(date, project.id)] || 0);
    }, 0);
  };

  /**
   * 全期間総合計
   */
  const grandTotal = allSummary.reduce((sum, row) => sum + Number(row.total_hours), 0);

  return (
    <div className="app">
      <h1>工数管理アプリ</h1>

      {/* 対象月選択 */}
      <div className="toolbar">
        <label>
          対象月:
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {/* プロジェクト追加フォーム */}
      <div className="project-form-box">
        <h2>プロジェクト追加</h2>
        <form className="project-form" onSubmit={handleAddProject}>
          <input
            type="text"
            placeholder="プロジェクト名を入力"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button type="submit">追加</button>
        </form>

        {projectError && <p className="message error">{projectError}</p>}
        {projectSuccess && <p className="message success">{projectSuccess}</p>}
      </div>

      {/* プロジェクト管理 */}
      <div className="project-management-box">
        <h2>プロジェクト管理</h2>
        <table>
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
              <tr key={project.id}>
                <td>{project.id}</td>
                <td>
                  <input
                    type="text"
                    value={editProjectMap[project.id]?.name ?? ""}
                    onChange={(e) =>
                      handleProjectFieldChange(project.id, "name", e.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    value={editProjectMap[project.id]?.status ?? "未着手"}
                    onChange={(e) =>
                      handleProjectFieldChange(project.id, "status", e.target.value)
                    }
                  >
                    {PROJECT_STATUSES.map((status) => (
                       <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                       </option>
                     ))}
                  </select>
                </td>
                <td className="action-cell">
                  <button onClick={() => handleUpdateProject(project.id)}>更新</button>
                  <button
                    className="danger"
                    onClick={() => handleDeleteProject(project.id, project.name)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 工数入力テーブル */}
      <div className="table-wrap">
        <h2>工数入力</h2>
        <table>
          <thead>
            <tr>
              <th>日付</th>
              {projects.map((project) => (
                <th key={project.id}>
                  <div>{project.name}</div>
                  <small className="status-label">{STATUS_LABELS[project.status]}</small>
                </th>
              ))}
              <th>1日合計</th>
            </tr>
          </thead>
          <tbody>
            {days.map((date) => (
              <tr key={date}>
                <td>{date}</td>
                {projects.map((project) => (
                  <td key={project.id}>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={workMap[cellKey(date, project.id)] ?? ""}
                      onChange={(e) => handleChange(date, project.id, e.target.value)}
                    />
                  </td>
                ))}
                <td>{getDailyTotal(date).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>月合計</td>
              {projects.map((project) => {
                const found = monthlySummary.find((x) => x.project_id === project.id);
                return <td key={project.id}>{Number(found?.total_hours || 0).toFixed(1)}</td>;
              })}
              <td>
                {projects
                  .reduce((sum, project) => {
                    const found = monthlySummary.find((x) => x.project_id === project.id);
                    return sum + Number(found?.total_hours || 0);
                  }, 0)
                  .toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 全体工数一覧 */}
      <div className="summary-box">
        <h2>プロジェクト全体工数</h2>
        <table>
          <thead>
            <tr>
              <th>プロジェクト</th>
              <th>ステータス</th>
              <th>区分</th>
              <th>全体工数</th>
            </tr>
          </thead>
          <tbody>
            {allSummary.map((row) => (
              <tr key={row.project_id}>
                <td>{row.name}</td>
                <td>{STATUS_LABELS[row.status]}</td>
                <td>{row.is_archived ? "アーカイブ" : "有効"}</td>
                <td>{Number(row.total_hours).toFixed(1)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}>
                <strong>総合計</strong>
              </td>
              <td>
                <strong>{grandTotal.toFixed(1)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* アーカイブ済みプロジェクト */}
      <div className="archive-box">
        <h2>アーカイブ済みプロジェクト</h2>
        {archivedProjects.length === 0 ? (
          <p>アーカイブされたプロジェクトはありません。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>プロジェクト名</th>
                <th>ステータス</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {archivedProjects.map((project) => (
                <tr key={project.id}>
                  <td>{project.id}</td>
                  <td>
                    <input
                      type="text"
                      value={editProjectMap[project.id]?.name ?? ""}
                      onChange={(e) =>
                        handleProjectFieldChange(project.id, "name", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={editProjectMap[project.id]?.status ?? "完了"}
                      onChange={(e) =>
                        handleProjectFieldChange(project.id, "status", e.target.value)
                      }
                    >
                      {PROJECT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="action-cell">
                    <button onClick={() => handleUpdateProject(project.id)}>更新</button>
                    <button
                      className="danger"
                      onClick={() => handleDeleteProject(project.id, project.name)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}