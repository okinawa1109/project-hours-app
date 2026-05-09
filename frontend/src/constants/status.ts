import { ProjectStatus } from '../types/project';

// UI label map.
// DB values remain English; only screen labels are Japanese.
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  todo: '未着手',
  doing: '対応中',
  not_required: '対応不要',
  done: '完了',
};

export const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'todo', label: '未着手' },
  { value: 'doing', label: '対応中' },
  { value: 'not_required', label: '対応不要' },
  { value: 'done', label: '完了' },
];