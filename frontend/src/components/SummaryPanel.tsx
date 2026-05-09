import { useEffect, useState } from 'react';
import { fetchDailyTotal, fetchMonthlyProjectSummary, fetchMonthlyTotal } from '../api/worklogs';
import { STATUS_LABELS } from '../constants/status';

type Props = {
  selectedDate: string;
};

export function SummaryPanel({ selectedDate }: Props) {
  const [dailyTotal, setDailyTotal] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyProjectSummary, setMonthlyProjectSummary] = useState<any[]>([]);

  const yearMonth = selectedDate.slice(0, 7);

  const loadSummary = async () => {
    const [daily, monthly, projectSummary] = await Promise.all([
      fetchDailyTotal(selectedDate),
      fetchMonthlyTotal(yearMonth),
      fetchMonthlyProjectSummary(yearMonth),
    ]);

    setDailyTotal(daily);
    setMonthlyTotal(monthly);
    setMonthlyProjectSummary(projectSummary);
  };

  useEffect(() => {
    loadSummary();
  }, [selectedDate]);

  return (
    <section style={{ border: '1px solid #ccc', padding: 16 }}>
      <h2>集計</h2>
      <p>1日合計: {dailyTotal.toFixed(2)} 時間</p>
      <p>月合計: {monthlyTotal.toFixed(2)} 時間</p>

      <h3>月ごとのプロジェクト合計</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>プロジェクト</th>
            <th>ステータス</th>
            <th>アーカイブ</th>
            <th>月合計</th>
          </tr>
        </thead>
        <tbody>
          {monthlyProjectSummary.map((row) => (
            <tr key={row.project_id}>
              <td>{row.project_name}</td>
              <td>{STATUS_LABELS[row.project_status as keyof typeof STATUS_LABELS] ?? row.project_status}</td>
              <td>{row.project_archived ? 'はい' : 'いいえ'}</td>
              <td>{Number(row.total_hours).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}