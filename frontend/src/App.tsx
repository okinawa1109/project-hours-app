import { useState } from 'react';
import { ProjectListPage } from './components/ProjectListPage';
import { ProjectDetailPage } from './components/ProjectDetailPage';
import { WorklogCsvTools } from './components/WorklogCsvTools';

function getTodayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedProjectId, setSelectedProjectId] =
    useState<number | null>(null);

  /**
   * CSV読み込み後に画面を再読み込みするためのキーです。
   */
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImported = () => {
    setRefreshKey((prev) => prev + 1);
  };

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

      <WorklogCsvTools onImported={handleImported} />

      {selectedProjectId === null ? (
        <ProjectListPage
          key={`list-${selectedDate}-${refreshKey}`}
          selectedDate={selectedDate}
          onOpenProject={(projectId) => setSelectedProjectId(projectId)}
        />
      ) : (
        <ProjectDetailPage
          key={`detail-${selectedProjectId}-${selectedDate}-${refreshKey}`}
          projectId={selectedProjectId}
          selectedDate={selectedDate}
          onBack={() => setSelectedProjectId(null)}
        />
      )}
    </main>
  );
}