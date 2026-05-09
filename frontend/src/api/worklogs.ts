import type { WorklogRow } from '../types/worklog';

const API_BASE = 'http://localhost:3000/api';

/**
 * 工数を保存します。
 *
 * 同じ日付 + 同じプロジェクトの工数が既にある場合は、
 * backend側で更新されます。
 */
export async function saveWorklog(payload: {
  work_date: string;
  project_id: number;
  hours: number;
  comment?: string | null;
}) {
  const res = await fetch(`${API_BASE}/worklogs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('saveWorklog failed:', text);
    throw new Error(text);
  }

  return res.json();
}

/**
 * 指定日の工数一覧を取得します。
 *
 * 画面を再表示したときに、
 * 以前登録した工数を入力欄へ戻すために使います。
 */
export async function fetchWorklogsByDate(
  workDate: string
): Promise<WorklogRow[]> {
  const res = await fetch(
    `${API_BASE}/worklogs?work_date=${encodeURIComponent(workDate)}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchWorklogsByDate failed:', text);
    throw new Error(text);
  }

  return res.json();
}

/**
 * 指定日の全体合計を取得します。
 */
export async function fetchDailyTotal(workDate: string): Promise<number> {
  const res = await fetch(
    `${API_BASE}/summary/daily?work_date=${encodeURIComponent(workDate)}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchDailyTotal failed:', text);
    throw new Error(text);
  }

  const data = await res.json();

  return Number(data.total);
}

/**
 * 指定月のプロジェクト別合計を取得します。
 *
 * yearMonth の形式:
 * 例: 2026-05
 */
export async function fetchMonthlyProjectSummary(yearMonth: string) {
  const res = await fetch(
    `${API_BASE}/summary/monthly-project?year_month=${encodeURIComponent(
      yearMonth
    )}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchMonthlyProjectSummary failed:', text);
    throw new Error(text);
  }

  return res.json();
}

/**
 * 指定月の全体合計を取得します。
 *
 * yearMonth の形式:
 * 例: 2026-05
 */
export async function fetchMonthlyTotal(yearMonth: string): Promise<number> {
  const res = await fetch(
    `${API_BASE}/summary/monthly-total?year_month=${encodeURIComponent(
      yearMonth
    )}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchMonthlyTotal failed:', text);
    throw new Error(text);
  }

  const data = await res.json();

  return Number(data.total);
}

/**
 * 親プロジェクトの日別合計を取得します。
 *
 * この合計には以下を含めます。
 * - 親プロジェクト自身の工数
 * - 子プロジェクトの工数
 *
 * 子プロジェクトの工数を親プロジェクトに反映するためのAPIです。
 */
export async function fetchProjectDailyTotal(
  projectId: number,
  workDate: string
): Promise<number> {
  const res = await fetch(
    `${API_BASE}/summary/project-daily?project_id=${projectId}&work_date=${encodeURIComponent(
      workDate
    )}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchProjectDailyTotal failed:', text);
    throw new Error(text);
  }

  const data = await res.json();

  return Number(data.total);
}

export type TotalScope = 'all' | 'month';

/**
 * プロジェクトの合計工数を取得します。
 *
 * scope:
 * - all   : 全体
 * - month : 指定月
 */
export async function fetchProjectTotal(
  projectId: number,
  scope: TotalScope,
  yearMonth: string
): Promise<number> {
  const params = new URLSearchParams();

  params.set('project_id', String(projectId));
  params.set('scope', scope);

  if (scope === 'month') {
    params.set('year_month', yearMonth);
  }

  const res = await fetch(
    `${API_BASE}/summary/project-total?${params.toString()}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchProjectTotal failed:', text);
    throw new Error(text);
  }

  const data = await res.json();

  return Number(data.total);
}

/**
 * 親プロジェクト配下の子プロジェクト工数を月単位で取得します。
 *
 * 画面の一覧形式入力で使います。
 *
 * 例:
 * parentProjectId = 1
 * yearMonth = '2026-05'
 */
export async function fetchChildProjectWorklogsByMonth(
  parentProjectId: number,
  yearMonth: string
) {
  const params = new URLSearchParams();

  params.set('parent_project_id', String(parentProjectId));
  params.set('year_month', yearMonth);

  const res = await fetch(
    `${API_BASE}/worklogs/child-month?${params.toString()}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('fetchChildProjectWorklogsByMonth failed:', text);
    throw new Error(text);
  }

  return res.json();
}

/**
 * 工数データをCSV形式でバックアップします。
 */
export async function downloadWorklogsBackupCsv(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/worklogs/backup.csv`);

  if (!res.ok) {
    const text = await res.text();
    console.error('downloadWorklogsBackupCsv failed:', text);
    throw new Error(text);
  }

  return res.blob();
}

/**
 * CSV形式の工数データを読み込みます。
 */
export async function importWorklogsCsv(csvText: string): Promise<{
  importedCount: number;
  skippedCount: number;
  skippedRows: {
    rowNumber: number;
    reason: string;
  }[];
}> {
  const res = await fetch(`${API_BASE}/worklogs/import-csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      csvText,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('importWorklogsCsv failed:', text);
    throw new Error(text);
  }

  return res.json();
}