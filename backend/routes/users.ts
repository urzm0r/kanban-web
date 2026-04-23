import { authMiddleware } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import express from 'express'
import type { AuthRequest } from "../types.js";

const usersRouter = express.Router();

// Search users by name or email
usersRouter.get('/search', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const query = req.query.q as string;
        if (!query || query.length < 2) return res.json([]);

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } }
                ],
                NOT: { id: req.user?.userId as string } // Don't include self
            },
            select: {
                id: true,
                name: true,
                email: true
            },
            take: 10
        });

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Error searching users" });
    }
});

export default usersRouter;
