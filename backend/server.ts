import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient, Prisma } from './generated/prisma/index.js';
import cors from 'cors';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

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
const registerSchema = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(1) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const tagSchema = z.object({ name: z.string().min(1), color: z.string().optional() });
const listSchema = z.object({ title: z.string().min(1), boardId: z.string().uuid(), type: z.string().optional() });
const cardSchema = z.object({ content: z.string().min(1), listId: z.string().uuid(), priority: z.string().optional() });
const listUpdateSchema = z.object({ title: z.string().min(1) });
const cardUpdateSchema = z.object({ 
    content: z.string().optional(), 
    description: z.string().nullable().optional(), 
    isDone: z.boolean().optional(),
    inProgress: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    listId: z.string().uuid().optional(),
    priority: z.string().optional()
});

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
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { email, password, name } = parsed.data;
        
        const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { name }] } });
        if (existing) return res.status(400).json({ error: "Email or name already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, name, password: hashedPassword }
        });
        const token = jwt.sign({ userId: user.id, name: user.name }, JWT_SECRET as string, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (e) {
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ userId: user.id, name: user.name }, JWT_SECRET as string, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (e) {
        res.status(500).json({ error: "Login failed" });
    }
});

// --- API Endpoints ---
app.get('/boards', authMiddleware, async (req, res) => {
    try {
        let boards = await prisma.board.findMany({
            select: { id: true, title: true }
        });

        // Create default board if none exists
        if (boards.length === 0) {
            const newBoard = await prisma.board.create({
                data: { title: "Main Board" },
                select: { id: true, title: true }
            });
            boards = [newBoard];
        }

        res.json(boards);
    } catch (error) {
        res.status(500).json({ error: "Error fetching boards" });
    }
});

app.get('/api/boards/:id', authMiddleware, async (req, res) => {
    try {
        const board = await prisma.board.findUnique({
            where: { id: req.params.id as string },
            include: {
                lists: {
                    include: { cards: { include: { tags: true }, orderBy: { order: 'asc' } } },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!board) return res.status(404).json({ error: "Board not found" });

        // Board type inference using Prisma
        type BoardWithLists = Prisma.BoardGetPayload<{
            include: { lists: { include: { cards: { include: { tags: true } } } } }
        }>;

        const validBoard = board as BoardWithLists;

        // Ensure Telemetry list exists for the board
        if (!validBoard.lists.find((l) => l.type === 'TELEMETRY')) {
            const telList = await prisma.list.create({
                data: { title: "Telemetria", boardId: validBoard.id, order: validBoard.lists.length, type: "TELEMETRY" },
                include: { cards: { include: { tags: true } } }
            });
            validBoard.lists.push(telList as any);
        }

        res.json(validBoard);
    } catch (error) {
        res.status(500).json({ error: "Error fetching board details" });
    }
});

app.get('/api/tags', authMiddleware, async (req, res) => {
    try {
        const tags = await prisma.tag.findMany();
        res.json(tags);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch tags" });
    }
});

app.post('/api/tags', authMiddleware, async (req, res) => {
    try {
        const parsed = tagSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { name, color } = parsed.data;
        const tag = await prisma.tag.create({ data: { name, color } });
        res.json(tag);
    } catch (e) {
        // Tag might exist
        const existing = await prisma.tag.findUnique({ where: { name: req.body.name } });
        if (existing) res.json(existing);
        else res.status(500).json({ error: "Failed to create tag" });
    }
});

app.post('/api/lists', authMiddleware, async (req, res) => {
    try {
        const parsed = listSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { title, boardId, type } = parsed.data;

        const boardExists = await prisma.board.findUnique({ where: { id: boardId } });
        if (!boardExists) return res.status(404).json({ error: "Board not found" });

        const count = await prisma.list.count({ where: { boardId } });
        const list = await prisma.list.create({
            data: { title, boardId, order: count, type: type || "DEFAULT" },
            include: { cards: { include: { tags: true } } }
        });
        io.emit('list:created', list);
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: "Failed to create list" });
    }
});

app.post('/api/cards', authMiddleware, async (req, res) => {
    try {
        const parsed = cardSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { content, listId, priority } = parsed.data;

        const listExists = await prisma.list.findUnique({ where: { id: listId } });
        if (!listExists) return res.status(404).json({ error: "List not found" });

        const count = await prisma.card.count({ where: { listId } });
        const card = await prisma.card.create({
            data: { content, listId, order: count, priority: priority || "Medium" },
            include: { tags: true }
        });
        io.emit('card:synced', card);
        res.json(card);
    } catch (e) {
        res.status(500).json({ error: "Failed to create card" });
    }
});

app.put('/api/lists/:id', authMiddleware, async (req, res) => {
    try {
        const parsed = listUpdateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { title } = parsed.data;

        const list = await prisma.list.update({ 
            where: { id: req.params.id as string }, 
            data: { title },
            include: { cards: { include: { tags: true } } }
        });
        io.emit('list:updated', list);
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: "Failed to update list" });
    }
});

app.delete('/api/lists/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.list.delete({ where: { id: req.params.id as string } });
        io.emit('list:deleted', req.params.id as string);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete list" });
    }
});

app.put('/api/cards/:id', authMiddleware, async (req, res) => {
    try {
        const parsed = cardUpdateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { content, description, isDone, inProgress, tags, listId, priority } = parsed.data;

        const existing = await prisma.card.findUnique({ where: { id: req.params.id as string } });
        if (!existing) return res.status(404).json({ error: "Card not found" });

        const authReq = req as AuthRequest;
        if (existing.lockedBy && authReq.user && existing.lockedBy !== authReq.user.userId) {
            return res.status(403).json({ error: "Card is locked by another user" });
        }

        let completedAt = existing.completedAt;
        if (isDone !== undefined) {
            if (isDone && !existing.isDone) completedAt = new Date();
            if (!isDone && existing.isDone) completedAt = null;
        }

        const data: any = {};
        if (content !== undefined) data.content = content;
        if (description !== undefined) data.description = description;
        if (priority !== undefined) data.priority = priority;
        if (tags !== undefined) {
            data.tags = { set: tags.map((id: string) => ({ id })) };
        }
        if (listId !== undefined) {
            const destListExists = await prisma.list.findUnique({ where: { id: listId } });
            if (!destListExists) return res.status(404).json({ error: "Destination list not found" });
            data.listId = listId;
        }
        if (inProgress !== undefined) data.inProgress = inProgress;
        if (isDone !== undefined) {
            data.isDone = isDone;
            data.completedAt = completedAt;
        }

        const card = await prisma.card.update({
            where: { id: req.params.id as string },
            data,
            include: { tags: true }
        });
        io.emit('card:synced', card);
        res.json(card);
    } catch (e) {
        res.status(500).json({ error: "Failed to update card" });
    }
});

app.delete('/api/cards/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.card.delete({ where: { id: req.params.id as string } });
        io.emit('card:deleted', req.params.id as string);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete card" });
    }
});

// --- WebSockets ---
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error: Token missing"));
    try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as { userId: string, name: string };
        (socket as any).data = { user: decoded };
        next();
    } catch {
        next(new Error("Authentication error: Invalid token"));
    }
});

io.on('connection', (socket) => {
    const user = (socket as any).data.user;
    console.log(` User connected: ${user.name} (${socket.id})`);

    socket.on('card:locked', async (cardId, callback) => {
        try {
            const card = await prisma.card.findUnique({ where: { id: cardId } });
            if (card && (!card.lockedBy || card.lockedBy === user.userId)) {
                await prisma.card.update({
                    where: { id: cardId },
                    data: { lockedBy: user.userId, lockedByName: user.name, lockedAt: new Date() }
                });
                socket.broadcast.emit('card:locked', { cardId, lockedBy: user.userId, lockedByName: user.name });
                if (callback) callback({ success: true });
            } else if (callback) {
                callback({ error: "Card already locked by another user" });
            }
        } catch (error: any) {
            console.error("Card lock error:", error);
            if (callback) callback({ error: error.message });
        }
    });

    socket.on('card:unlocked', async (cardId, callback) => {
        try {
            await prisma.card.update({
                where: { id: cardId },
                data: { lockedBy: null, lockedByName: null, lockedAt: null }
            });
            socket.broadcast.emit('card:unlocked', { cardId });
            if (callback) callback({ success: true });
        } catch (error: any) {
            console.error("Card unlock error:", error);
            if (callback) callback({ error: error.message });
        }
    });

    socket.on('cards:reordered', async (items, callback) => {
        try {
            const cardIds = items.map((i: any) => i.id);
            const existingCards = await prisma.card.findMany({ where: { id: { in: cardIds } } });

            await prisma.$transaction(
                items.map((item: any) => {
                    const dbCard = existingCards.find(c => c.id === item.id);
                    const isMyLock = dbCard && dbCard.lockedBy === user.userId;

                    return prisma.card.update({
                        where: { id: item.id },
                        data: {
                            listId: item.listId,
                            order: item.order,
                            lockedBy: isMyLock ? null : undefined,
                            lockedByName: isMyLock ? null : undefined,
                            lockedAt: isMyLock ? null : undefined
                        }
                    });
                })
            );
            socket.broadcast.emit('cards:reordered', items);
            if (callback) callback({ success: true });
        } catch (error: any) {
            console.error("Cards reorder error:", error);
            if (callback) callback({ error: error.message || "Failed to reorder cards" });
        }
    });

    socket.on('lists:reordered', async (items, callback) => {
        try {
            await prisma.$transaction(
                items.map((item: any) =>
                    prisma.list.update({
                        where: { id: item.id },
                        data: { order: item.order }
                    })
                )
            );
            socket.broadcast.emit('lists:reordered', items);
            if (callback) callback({ success: true });
        } catch (error: any) {
            console.error("Lists reorder error:", error);
            if (callback) callback({ error: error.message || "Failed to reorder lists" });
        }
    });

    socket.on('disconnect', async () => {
        console.log(` User disconnected: ${user.name} (${socket.id})`);
        try {
            await prisma.card.updateMany({
                where: { lockedBy: user.userId },
                data: { lockedBy: null, lockedByName: null, lockedAt: null }
            });
            socket.broadcast.emit('card:unlocked_all', { userId: user.userId });
        } catch (error) {
            console.error("Disconnect cleanup error:", error);
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Serwer działa z obsługą Socket.io na http://localhost:${PORT}`);
});