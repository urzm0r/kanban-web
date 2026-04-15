import "dotenv/config";
import express from 'express';
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
    try {
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
    } catch (error) {
        res.status(500).json({ error: "Błąd podczas pobierania tablic" });
    }
});

// Process card lock requests
app.post("/card/:id/lock", authorize, cardExists(true), async (req, res) => {

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

    res.status(100).send("Awaiting PUT /cards/:id request...") 
})

// Create/Edit a card
app.put("/cards/:id", authorize, cardExists(), async (req, res) => {
    if (req.body === undefined || !("content" in req.body && "columnId" in req.body)) {
        res.status(400).send("Incomplete request body.")
        return
    }

    // Card creation
    if (!req.cardExists) {
        console.log("created")
        prisma.task.create({
            data: {
                id: req.cardId,
                order: 0,
                content: req.body["content"],
                columnId: req.body["columnId"]
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

    console.log("updated")
    await prisma.task.update({
        where: { id: req.cardId },
        data: { 
            content: req.body["content"],
            lockedBy: null    
        }

    })

    // TODO: notify clients that the card is available to edit
    // TODO: handle user disconnection while editing
    
    res.status(200).send()
})

// Add tag/move card to another column
app.patch("/cards/:id", cardExists(true), async (req, res) => {
    try {
        if (req.body["completed"] !== null)
        {
            prisma.task.update({
                where: { id: req.cardId },
                data: { completed: zod.boolean().parse(req.body["completed"]) }
            });
        }

        if (req.body["columnId"] !== null)
        {
            prisma.task.update({
                where: { id: req.cardId },
                data: { columnId: zod.string().parse(req.body["columnId"]) }
            });
        }

        res.status(200).send()
    } catch (error) {
        if (error instanceof zod.ZodError) {
            res.status(400).send(error.issues)
            return
        }
        res.status(500).send()
    }
})

// Delete card
app.delete("/cards/:id", authorize, cardExists(true), async (req, res) => {
    if (req.card.lockedBy !== null && req.card.lockedBy !== req.clientId) {
        res.status(423).send("This card is currently being edited by another user.")
        return
    }

    prisma.task.delete({
        where: { id: req.cardId }
    })

    res.status(204).send()
})


// Add tag
app.post("/cards/:id/tag", cardExists(true), async (req, res) => {
    if (req.body === undefined || !("title" in req.body)) {
        res.status(400).send("Incomplete request body.")
        return
    }

    // find or create
    const tag = await prisma.tag.upsert({
        where: { title: req.body["title"] },
        update: {},
        create: { title: req.body["title"] }
    })

    prisma.task.update({
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
    if (req.body === undefined || !("title" in req.body)) {
        res.status(400).send("Incomplete request body.")
        return
    }

    prisma.task.update({
        where: { id: req.cardId },
        data: {
            tags: {
                disconnect: [{ title: req.body["title"] }]
            }
        }
    })
})

// Create list
app.post("/lists/:id", listExists(false), async (req, res) => {
    if (req.body === undefined || !("title" in req.body && "boardId" in req.body)) {
        res.status(400).send("Incomplete request body.")
        return
    }

    prisma.column.create({
        data: {
            id: req.listId,
            title: req.body["title"],
            order: 0, // ? TODO
            boardId: req.body["boardId"]
        }
    })

    res.status(201).send()
})

// Delete list
app.delete("/lists/:id", listExists(true), async (req, res) => {
    prisma.column.delete({
        where: { id: req.listId }
    })

    res.status(204).send()
})

// Create board
app.post("/boards/:id", boardExists(false), async (req, res) => {
    if (req.body === undefined || !("title" in req.body)) {
        res.status(400).send("Incomplete request body.")
        return
    }

    prisma.board.create({
        data: {
            id: req.boardId,
            title: req.body["title"]
        }
    })

    res.status(201).send()
})

// Delete board
app.delete("/boards/:id", boardExists(true), async (req, res) => {
    prisma.board.delete({
        where: { id: req.boardId }
    })

    res.status(204).send()
})


const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Serwer działa z obsługą Socket.io na http://localhost:${PORT}`);
});