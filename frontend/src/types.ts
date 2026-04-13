export interface Task {
  id: string;
  content: string;
  order: number;
  columnId: string;
  lockedBy: string | null;
  lockedAt: string | null;
}

export interface ColumnType {
  id: string;
  title: string;
  order: number;
  boardId: string;
  tasks: Task[];
}

export interface BoardType {
  id: string;
  title: string;
  columns: ColumnType[];
}
