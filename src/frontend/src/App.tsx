import { FormEvent, useEffect, useMemo, useState } from "react";
import "./App.css";

type Project = {
  id: number;
  name: string;
};

type WorkLog = {
  work_date: string;
  project_id: number;
  hours: string | number;
};

type Summary = {
  project_id: number;
  name: string;
  total_hours: string | number;
};

const API_BASE = "http://localhost:3000";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDaysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1;
    return `${month}-${String(day).padStart(2, "0")}`;
  });
}

export default function App() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [projects, setProjects] = useState<Project[]>([]);
  const [workMap, setWorkMap] = useState<Record<string, number>>({});
  const [monthlySummary, setMonthlySummary] = useState<Summary[]>([]);
  const [allSummary, setAllSummary] = useState<Summary[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectError, setProjectError] = useState("");
  const [projectSuccess, setProjectSuccess] = useState("");

  const days = useMemo(() => getDaysInMonth(month), [month]);

  const cellKey = (date: string, projectId: number) => `${date}_${projectId}`;

  const loadAll = async () => {
    const [pRes, wRes, mRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/projects`),
      fetch(`${API_BASE}/worklogs?month=${month}`),
      fetch(`${API_BASE}/summary/monthly?month=${month}`),
      fetch(`${API_BASE}/summary/all`)
    ]);

    const projectsData: Project[] = await pRes.json();
    const worklogsData: WorkLog[] = await wRes.json();
    const monthlyData: Summary[] = await mRes.json();
    const allData: Summary[] = await aRes.json();

    const map: Record<string, number> = {};
    for (const row of worklogsData) {
      map[cellKey(row.work_date, row.project_id)] = Number(row.hours);
    }

    setProjects(projectsData);
    setWorkMap(map);
    setMonthlySummary(monthlyData);
    setAllSummary(allData);
  };

  useEffect(() => {
    loadAll();
  }, [month]);

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

  const getDailyTotal = (date: string) => {
    return projects.reduce((sum, project) => {
      return sum + (workMap[cellKey(date, project.id)] || 0);
    }, 0);
  };

  const grandTotal = allSummary.reduce((sum, row) => sum + Number(row.total_hours), 0);

  return (
    <div className="app">
      <h1>工数管理アプリ</h1>

      <div className="toolbar">
        <label>
          対象月:
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日付</th>
              {projects.map((project) => (
                <th key={project.id}>{project.name}</th>
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
                {monthlySummary
                  .reduce((sum, row) => sum + Number(row.total_hours), 0)
                  .toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="summary-box">
        <h2>プロジェクト全体工数</h2>
        <table>
          <thead>
            <tr>
              <th>プロジェクト</th>
              <th>全体工数</th>
            </tr>
          </thead>
          <tbody>
            {allSummary.map((row) => (
              <tr key={row.project_id}>
                <td>{row.name}</td>
                <td>{Number(row.total_hours).toFixed(1)}</td>
              </tr>
            ))}
            <tr>
              <td><strong>総合計</strong></td>
              <td><strong>{grandTotal.toFixed(1)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}