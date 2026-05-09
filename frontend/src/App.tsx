import { useState } from 'react';
import { ProjectListPage } from './components/ProjectListPage';
import { ProjectDetailPage } from './components/ProjectDetailPage';

function getTodayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  // null の場合は親プロジェクト一覧を表示します。
  // 数値が入っている場合は、そのプロジェクトの詳細ページを表示します。
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <h1>工数管理アプリ</h1>

      <section style={{ marginBottom: 24 }}>
        <label>
          対象日:
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            style={{ marginLeft: 8 }}
          />
        </label>
      </section>

      {selectedProjectId === null ? (
        <ProjectListPage
          selectedDate={selectedDate}
          onOpenProject={(projectId) => setSelectedProjectId(projectId)}
        />
      ) : (
        <ProjectDetailPage
          projectId={selectedProjectId}
          selectedDate={selectedDate}
          onBack={() => setSelectedProjectId(null)}
        />
      )}
    </main>
  );
}