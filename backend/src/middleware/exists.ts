import type { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

const cardExists = (require: boolean | null = null) => async (req: Request, res: Response, next: NextFunction) => {
    if (typeof req.params.id !== "string") {
        res.status(400).send("Please provide a card ID")
        return
    }

    req.cardId = req.params.id;

    const card = await prisma.task.findFirst({
        where: { id: req.cardId }
    });

    req.cardExists = (card !== null)

    if (require && !req.cardExists) {
        res.status(404).send("Card with a given ID doesn't exist")
        return
    } 

    if ((require === null) && req.cardExists) {
        res.status(400).send("Card with a given ID already exists.")
        return
    }

    if (req.cardExists) {
        req.card = card
    }

    next()
}

const listExists = (require: boolean | null = null) => async (req: Request, res: Response, next: NextFunction) => {
    if (typeof req.params.id !== "string") {
        res.status(400).send("Please provide a list ID")
        return
    }

    req.listId = req.params.id;

    const list = await prisma.column.findFirst({
        where: { id: req.listId }
    });

    const listExists = (list !== null)

    if (require && !listExists) {
        res.status(404).send("List with a given ID doesn't exist")
        return
    } 

    if ((require === false) && listExists) {
        res.status(400).send("List with a given ID already exists.")
        return
    }

    next()
}

const boardExists = (require: boolean | null = null) => async (req: Request, res: Response, next: NextFunction) => {
    if (typeof req.params.id !== "string") {
        res.status(400).send("Please provide a board ID")
        return
    }

    req.boardId = req.params.id;

    const list = await prisma.board.findFirst({
        where: { id: req.boardId }
    });

    const listExists = (list !== null)

    if (require && !listExists) {
        res.status(404).send("Board with a given ID doesn't exist")
        return
    } 

    if ((require === false) && listExists) {
        res.status(400).send("Board with a given ID already exists.")
        return
    }

    next()
}

export { cardExists, listExists, boardExists }