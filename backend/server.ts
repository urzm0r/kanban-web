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
        const { email, password, name } = req.body;
        if (!email || !password || !name) return res.status(400).json({ error: "Email, password and name are required" });
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
        const { email, password } = req.body;
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
            include: {
                lists: {
                    include: { cards: { include: { tags: true }, orderBy: { order: 'asc' } } },
                    orderBy: { order: 'asc' },
                },
            },
        });
        
        // Create default board if none exists
        if (boards.length === 0) {
            const newBoard = await prisma.board.create({
                data: { title: "Main Board" },
                include: { lists: { include: { cards: { include: { tags: true } } } } }
            });
            boards = [newBoard];
        }

        // Ensure Telemetry list exists for the first board
        const mainBoard = boards[0];
        if (mainBoard && !mainBoard.lists.find((l: any) => l.type === 'TELEMETRY')) {
            const telList = await prisma.list.create({
                data: { title: "Telemetria", boardId: mainBoard.id, order: mainBoard.lists.length, type: "TELEMETRY" },
                include: { cards: { include: { tags: true } } }
            });
            mainBoard.lists.push(telList);
        }

        res.json(boards);
    } catch (error) {
        res.status(500).json({ error: "Error fetching boards" });
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
        const { name, color } = req.body;
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
    const { title, boardId, type } = req.body;
    try {
        const count = await prisma.list.count({ where: { boardId } });
        const list = await prisma.list.create({
            data: { title, boardId, order: count, type: type || "DEFAULT" }
        });
        io.emit('board:updated');
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: "Failed to create list" });
    }
});

app.post('/api/cards', authMiddleware, async (req, res) => {
    const { content, listId, priority } = req.body;
    try {
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
    const { title } = req.body;
    try {
        const list = await prisma.list.update({ where: { id: req.params.id as string }, data: { title } });
        io.emit('board:updated');
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: "Failed to update list" });
    }
});

app.delete('/api/lists/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.list.delete({ where: { id: req.params.id as string } });
        io.emit('board:updated');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete list" });
    }
});

app.put('/api/cards/:id', authMiddleware, async (req, res) => {
    const { content, description, isDone, inProgress, tags, listId, priority } = req.body;
    try {
        const existing = await prisma.card.findUnique({ where: { id: req.params.id as string }});
        let completedAt = existing?.completedAt;
        if (isDone !== undefined) {
             if (isDone && !existing?.isDone) completedAt = new Date();
             if (!isDone && existing?.isDone) completedAt = null;
        }

        const data: any = {};
        if (content !== undefined) data.content = content;
        if (description !== undefined) data.description = description;
        if (priority !== undefined) data.priority = priority;
        if (tags !== undefined) {
             // tags is expected to be an array of tag IDs
             data.tags = { set: tags.map((id: string) => ({ id })) };
        }
        if (listId !== undefined) data.listId = listId;
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

    socket.on('card:locked', async (cardId) => {
        try {
            await prisma.card.update({
                where: { id: cardId },
                data: { lockedBy: user.userId, lockedByName: user.name, lockedAt: new Date() }
            });
            socket.broadcast.emit('card:locked', { cardId, lockedBy: user.userId, lockedByName: user.name });
        } catch (error) {
            console.error("Card lock error:", error);
        }
    });

    socket.on('card:unlocked', async (cardId) => {
        try {
            await prisma.card.update({
                where: { id: cardId },
                data: { lockedBy: null, lockedByName: null, lockedAt: null }
            });
            socket.broadcast.emit('card:unlocked', { cardId });
        } catch (error) {
            console.error("Card unlock error:", error);
        }
    });

    socket.on('cards:reordered', async (items) => {
        try {
            await prisma.$transaction(
                items.map((item: any) =>
                    prisma.card.update({
                        where: { id: item.id },
                        data: {
                            listId: item.listId,
                            order: item.order,
                            lockedBy: null,
                            lockedByName: null,
                            lockedAt: null
                        }
                    })
                )
            );
            socket.broadcast.emit('board:updated');
        } catch (error) {
            console.error("Cards reorder error:", error);
        }
    });

    socket.on('lists:reordered', async (items) => {
        try {
            await prisma.$transaction(
                items.map((item: any) =>
                    prisma.list.update({
                        where: { id: item.id },
                        data: { order: item.order }
                    })
                )
            );
            socket.broadcast.emit('board:updated');
        } catch (error) {
            console.error("Lists reorder error:", error);
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