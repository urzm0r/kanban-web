import "dotenv/config";
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import prisma from "./src/lib/prisma.js";

import authorize from './src/middleware/authorize.js'
import { boardExists, cardExists, listExists } from "./src/middleware/exists.js";

import * as zod from "zod"


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

app.use(cors());
app.use(express.json());

// TODO: notify clients after each change

// Return the entire board ( with every list and task )
app.get('/boards/:id', boardExists(true), async (req, res) => {
    const boards = await prisma.board.findMany({
        where: { id: req.boardId },
        include: {
            columns: {
                include: {
                    tasks: true,
                },
                orderBy: { order: 'asc' },
            },
        },
    });
    res.json(boards);
});

// Process card lock requests
app.post("/cards/:id/lock", authorize, cardExists(true), async (req, res) => {

    if (req.card.lockedBy !== null) {
        res.status(423).send("This card is already locked")
        return
    }

    await prisma.task.update({
        where: { id: req.cardId },
        data: {
            lockedAt: new Date(),
            lockedBy: req.clientId
        }
    })

    // TODO: notify clients about lock

    res.status(200).send("Awaiting PUT /cards/:id request...") 
})

const cardSchema = zod.object({
    content: zod.string(),
    columnId: zod.optional(zod.string())
})

// Create/Edit a card
app.put("/cards/:id", authorize, cardExists(), async (req, res) => {
    if (req.body === undefined || !("content" in req.body)) {
        res.status(400).send("Incomplete request body. Please provide the content attribute.")
        return
    }

    const cardData = cardSchema.parse({
        content: req.body["content"],
        columnId: req.body["columnId"]
    })

    // Card creation
    if (!req.cardExists) {
        if (cardData.columnId === undefined) {
            res.status(400).send("Incomplete request body. Please provide the columnId attribute.")
            console.log(req.body)
            return
        }

        await prisma.task.create({
            data: {
                id: req.cardId,
                order: 0,
                content: cardData.content,
                columnId: cardData.columnId
            }
        })
        res.status(201).send()

        return
    }

    // Card editing
    if (req.card.lockedBy !== null && req.card.lockedBy !== req.clientId) {
        res.status(423).send("This card is currently being edited by another user.")
        return
    }

    await prisma.task.update({
        where: { id: req.cardId },
        data: { 
            content: cardData.content,
            lockedBy: null    
        }

    })

    // TODO: notify clients that the card is available to edit
    // TODO: handle user disconnection while editing
    
    res.status(200).send()
})

// Add tag/move card to another column
app.patch("/cards/:id", cardExists(true), async (req, res) => {

    if (req.body["completed"] !== undefined)
    {
        await prisma.task.update({
            where: { id: req.cardId },
            data: { completed: zod.boolean("\"completed\" must be boolean").parse(req.body["completed"]) }
        });
    }

    if (req.body["columnId"] !== undefined)
    {
        await prisma.task.update({
            where: { id: req.cardId },
            data: { columnId: zod.string("\"columnId\" attribute must be a string").parse(req.body["columnId"]) }
        });
    }

    res.status(200).send()
})

// Delete card
app.delete("/cards/:id", authorize, cardExists(true), async (req, res) => {
    if (req.card.lockedBy !== null && req.card.lockedBy !== req.clientId) {
        res.status(423).send("This card is currently being edited by another user.")
        return
    }

    await prisma.task.delete({
        where: { id: req.cardId }
    })

    res.status(204).send()
})


// Add tag
const tagSchema = zod.string("\"title\" attribute must exist and be a string")

app.post("/cards/:id/tag", cardExists(true), async (req, res) => {
    const title = tagSchema.parse(req.body["title"])

    // find or create
    const tag = await prisma.tag.upsert({
        where: { title },
        update: {},
        create: { title }
    })

    await prisma.task.update({
        where: { id: req.cardId },
        data: {
            tags: {
                connect: [{ title: tag.title }]
            }
        }
    })

    res.status(200).send()
})

// Delete tag
app.delete("/cards/:id/tag", cardExists(true), async (req, res) => {
    const title = tagSchema.parse(req.body["title"])

    await prisma.task.update({
        where: { id: req.cardId },
        data: {
            tags: {
                disconnect: [{ title: title }]
            }
        }
    })

    res.status(204).send()
})

// Create list
app.post("/lists/:id", listExists(false), async (req, res) => {
    const listSchema = zod.object({
        title: zod.string(),
        boardId: zod.string()
    })

    const listData = listSchema.parse({
        title: req.body["title"],
        boardId: req.body["boardId"]
    })

    await prisma.column.create({
        data: {
            id: req.listId,
            title: listData.title,
            order: 0, // ? TODO
            boardId: listData.boardId
        }
    })

    res.status(201).send()
})

// Delete list
app.delete("/lists/:id", listExists(true), async (req, res) => {
    await prisma.column.delete({
        where: { id: req.listId }
    })

    res.status(204).send()
})

// Create board
app.post("/boards/:id", boardExists(false), async (req, res) => {
    await prisma.board.create({
        data: {
            id: req.boardId,
            title: zod.string("\"title\" attribute must exist and be a string").parse(req.body["title"])
        }
    })

    res.status(201).send()
})

// Delete board
app.delete("/boards/:id", boardExists(true), async (req, res) => {
    await prisma.board.delete({
        where: { id: req.boardId }
    })

    res.status(204).send()
})

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof zod.ZodError) {
        res.status(400).send(err.issues)
        return
    }
    res.status(500).send(err.message)
})


const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Serwer działa z obsługą Socket.io na http://localhost:${PORT}`);
});