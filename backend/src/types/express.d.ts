declare global {
  namespace Express {
    interface Request {
      clientId: string
      cardId: string
      card: Prisma.card
      cardExists: boolean
      listId: string
      boardId: string
    }
  }
}

export {};