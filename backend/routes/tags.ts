import { authMiddleware } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { tagSchema } from "../lib/zodSchemas.js";
import express from 'express'

const tagsRouter = express.Router();

// /api/tags Endpoints

tagsRouter.get('/', authMiddleware, async (req, res) => {
    try {
        const tags = await prisma.tag.findMany();
        res.json(tags);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch tags" });
    }
});

tagsRouter.post('/', authMiddleware, async (req, res) => {
    try {
        const parsed = tagSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { name, color } = parsed.data;
        const tag = await prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name, color: color ?? null }
        });
        res.json(tag);
    } catch {
        res.status(500).json({ error: "Failed to create tag" });
    }
});

export default tagsRouter