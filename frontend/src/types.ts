export interface Card {
  id: string;
  content: string;
  description: string | null;
  isDone: boolean;
  createdAt: string;
  completedAt: string | null;
  order: number;
  listId: string;
  lockedBy: string | null;
  lockedByName: string | null;
  lockedAt: string | null;
  inProgress: boolean;
  priority: string;
  tags: TagType[];
}

export interface TagType {
  id: string;
  name: string;
  color: string | null;
}

export interface ListType {
  id: string;
  title: string;
  order: number;
  type: string;
  boardId: string;
  cards: Card[];
}

export interface BoardType {
  id: string;
  title: string;
  ownerId: string;
  members: { userId: string; role: string }[];
  lists: ListType[];
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface BoardActions {
  moveListByOffset: (listId: string, offset: number) => void;
  moveCardByOffset: (card: Card, listOffset: number, cardOffset: number) => void;
}