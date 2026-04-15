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

const JWT_SECRET = (process.env["JWT_SECRET"] as string) || "super-secret-key-123";

app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
interface AuthRequest extends Request {
    user?: { userId: string };
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing or invalid token" });
    }
    const token = header.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Malformed authorization header" });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as unknown as { userId: string };
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
    }
};

// --- Auth Endpoints ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ error: "Email already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword }
        });
        const token = jwt.sign({ userId: user.id }, JWT_SECRET as string, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email } });
    } catch (e) {
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET as string, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email } });
    } catch (e) {
        res.status(500).json({ error: "Login failed" });
    }
});

// --- API Endpoints ---
app.get('/boards', authMiddleware, async (req, res) => {
    try {
        let boards = await prisma.board.findMany({
            include: {
                lists: {
                    include: { cards: true },
                    orderBy: { order: 'asc' },
                },
            },
        });
        // Create default board if none exists
        if (boards.length === 0) {
            const newBoard = await prisma.board.create({
                data: { title: "Main Board" },
                include: { lists: { include: { cards: true } } }
            });
            boards = [newBoard];
        }
        res.json(boards);
    } catch (error) {
        res.status(500).json({ error: "Error fetching boards" });
    }
});

app.post('/api/lists', authMiddleware, async (req, res) => {
    const { title, boardId } = req.body;
    try {
        const count = await prisma.list.count({ where: { boardId } });
        const list = await prisma.list.create({
            data: { title, boardId, order: count }
        });
        io.emit('board:updated');
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: "Failed to create list" });
    }
});

app.post('/api/cards', authMiddleware, async (req, res) => {
    const { content, listId } = req.body;
    try {
        const count = await prisma.card.count({ where: { listId } });
        const card = await prisma.card.create({
            data: { content, listId, order: count }
        });
        io.emit('board:updated');
        res.json(card);
    } catch (e) {
        res.status(500).json({ error: "Failed to create card" });
    }
});

// --- WebSockets ---
io.on('connection', (socket) => {
    console.log(' User connected:', socket.id);

    socket.on('card:locked', async (cardId) => {
        try {
            await prisma.card.update({
                where: { id: cardId },
                data: { lockedBy: socket.id, lockedAt: new Date() }
            });
            socket.broadcast.emit('card:locked', { cardId, lockedBy: socket.id });
        } catch (error) {
            console.error("Card lock error:", error);
        }
    });

    socket.on('card:unlocked', async (cardId) => {
        try {
            await prisma.card.update({
                where: { id: cardId },
                data: { lockedBy: null, lockedAt: null }
            });
            socket.broadcast.emit('card:unlocked', { cardId });
        } catch (error) {
            console.error("Card unlock error:", error);
        }
    });

    socket.on('card:moved', async (data) => {
        try {
            await prisma.card.update({
                where: { id: data.cardId },
                data: {
                    listId: data.newListId,
                    order: data.newOrder,
                    lockedBy: null,
                    lockedAt: null
                }
            });
            socket.broadcast.emit('card:moved', data);
        } catch (error) {
            console.error("Card move error:", error);
        }
    });

    socket.on('disconnect', async () => {
        console.log(' User disconnected:', socket.id);
        try {
            await prisma.card.updateMany({
                where: { lockedBy: socket.id },
                data: { lockedBy: null, lockedAt: null }
            });
            socket.broadcast.emit('card:unlocked_all', { socketId: socket.id });
        } catch (error) {
            console.error("Disconnect cleanup error:", error);
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Serwer działa z obsługą Socket.io na http://localhost:${PORT}`);
});