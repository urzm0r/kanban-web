import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from './generated/prisma/index.js';
import cors from 'cors';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

const JWT_SECRET = process.env["JWT_SECRET"] || "super-secret-key-123";

app.use(cors());
app.use(express.json());

// 1. Pobieranie wszystkich tablic (razem z kolumnami i zadaniami)
app.get('/boards', async (req, res) => {
    try {
        const boards = await prisma.board.findMany({
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

// 2. Dodawanie nowej tablicy (na próbę)
app.post('/boards', async (req, res) => {
    const { title } = req.body;
    try {
        const newBoard = await prisma.board.create({
            data: { title },
        });
        res.json(newBoard);
    } catch (error) {
        res.status(500).json({ error: "Nie udało się stworzyć tablicy" });
    }
});

io.on('connection', (socket) => {
    console.log('⚡ User connected:', socket.id);

    socket.on('task:locked', async (taskId) => {
        try {
            await prisma.task.update({
                where: { id: taskId },
                data: { lockedBy: socket.id, lockedAt: new Date() }
            });
            socket.broadcast.emit('task:locked', { taskId, lockedBy: socket.id });
        } catch (error) {
            console.error("Task lock error:", error);
        }
    });

    socket.on('task:unlocked', async (taskId) => {
        try {
            await prisma.task.update({
                where: { id: taskId },
                data: { lockedBy: null, lockedAt: null }
            });
            socket.broadcast.emit('task:unlocked', { taskId });
        } catch (error) {
            console.error("Task unlock error:", error);
        }
    });

    socket.on('task:moved', async (data) => {
        try {
            await prisma.task.update({
                where: { id: data.taskId },
                data: {
                    columnId: data.newColumnId,
                    order: data.newOrder,
                    lockedBy: null,
                    lockedAt: null
                }
            });
            socket.broadcast.emit('task:moved', data);
        } catch (error) {
            console.error("Task move error:", error);
        }
    });

    socket.on('disconnect', async () => {
        console.log(' User disconnected:', socket.id);
        try {
            await prisma.task.updateMany({
                where: { lockedBy: socket.id },
                data: { lockedBy: null, lockedAt: null }
            });
            socket.broadcast.emit('task:unlocked_all', { socketId: socket.id });
        } catch (error) {
            console.error("Disconnect cleanup error:", error);
        }
    });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Serwer działa z obsługą Socket.io na http://localhost:${PORT}`);
});