import { useRef, useState } from 'react';
import {
  downloadWorklogsBackupCsv,
  importWorklogsCsv,
} from '../api/worklogs';

type Props = {
  onImported?: () => void;
};

function getTodayForFileName() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return `${yyyy}${mm}${dd}`;
}

export function WorklogCsvTools({ onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  /**
   * 工数CSVをダウンロードします。
   */
  const handleBackup = async () => {
    try {
      setProcessing(true);
      setMessage('');

      const blob = await downloadWorklogsBackupCsv();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `worklogs-backup-${getTodayForFileName()}.csv`;
      link.click();

      window.URL.revokeObjectURL(url);

      setMessage('工数CSVをバックアップしました');
    } catch (error) {
      console.error(error);
      setMessage('工数CSVのバックアップに失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * CSVファイル選択ダイアログを開きます。
   */
  const handleOpenImportFile = () => {
    fileInputRef.current?.click();
  };

  /**
   * CSVを読み込んでbackendへ送信します。
   */
  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const ok = window.confirm(
      'CSVを読み込みます。同じ日付・同じプロジェクトの工数は上書き更新されます。よろしいですか？'
    );

    if (!ok) {
      event.target.value = '';
      return;
    }

    try {
      setProcessing(true);
      setMessage('');

      const csvText = await file.text();
      const result = await importWorklogsCsv(csvText);

      setMessage(
        `CSV読み込み完了：取込 ${result.importedCount} 件 / スキップ ${result.skippedCount} 件`
      );

      onImported?.();
    } catch (error) {
      console.error(error);
      setMessage('CSV読み込みに失敗しました');
    } finally {
      setProcessing(false);
      event.target.value = '';
    }
  };

  return (
    <section
      style={{
        border: '1px solid #ccc',
        padding: 16,
        marginBottom: 24,
      }}
    >
      <h2>工数CSVバックアップ / 読み込み</h2>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleBackup}
          disabled={processing}
        >
          工数をバックアップCSV出力
        </button>

        <button
          type="button"
          onClick={handleOpenImportFile}
          disabled={processing}
        >
          工数CSVを読み込み
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
      </div>

      {message !== '' && (
        <p style={{ marginTop: 12 }}>
          {message}
        </p>
      )}

      <p style={{ fontSize: 12, marginTop: 12 }}>
        CSV形式：
        work_date, project_id, project_name, parent_project_id, parent_project_name, status, hours, comment
      </p>
    </section>
  );
}