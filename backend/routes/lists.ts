import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { listSchema, listUpdateSchema } from "../lib/zodSchemas.js";
import io from "../lib/socketio.js";
import express from 'express'

const listsRouter = express.Router();

// /api/lists Endpoints

listsRouter.post('/', authMiddleware, async (req, res) => {
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

listsRouter.put('/:id', authMiddleware, async (req, res) => {
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

listsRouter.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.list.delete({ where: { id: req.params.id as string } });
        io.emit('list:deleted', req.params.id as string);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete list" });
    }
});

export default listsRouter