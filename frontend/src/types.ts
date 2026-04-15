export interface Card {
  id: string;
  content: string;
  order: number;
  listId: string;
  lockedBy: string | null;
  lockedAt: string | null;
}

export interface ListType {
  id: string;
  title: string;
  order: number;
  boardId: string;
  cards: Card[];
}

export interface BoardType {
  id: string;
  title: string;
  lists: ListType[];
}
