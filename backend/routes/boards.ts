import { authMiddleware } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { Prisma } from '../generated/prisma/index.js';
import express from 'express'
import type { AuthRequest } from "../types.js";
import { boardSchema, boardMemberSchema } from "../lib/zodSchemas.js";
import io from '../lib/socketio.js';

const boardsRouter = express.Router();

// /api/boards Endpoints

// Get all boards accessible by the user
boardsRouter.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.userId as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const boards = await prisma.board.findMany({
            where: {
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId } } }
                ]
            },
            select: {
                id: true,
                title: true,
                ownerId: true,
                _count: { select: { members: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(boards);
    } catch {
        res.status(500).json({ error: "Error" });
    }
});

// Create a new board
boardsRouter.post('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.userId as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = boardSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error });

        const { title } = parsed.data;

        const board = await prisma.board.create({
            data: {
                title,
                ownerId: userId,
                members: {
                    create: {
                        userId: userId,
                        role: "ADMIN"
                    }
                }
            }
        });

        res.json(board);
    } catch {
        res.status(500).json({ error: "Error creating board" });
    }
});

// Update board (rename)
boardsRouter.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const boardId = req.params.id as string;
        const userId = req.user?.userId as string;

        const parsed = boardSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error });

        const { title } = parsed.data;

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { ownerId: true }
        });

        if (!board) return res.status(404).json({ error: "Board not found" });
        if (board.ownerId !== userId) return res.status(403).json({ error: "Only owner can rename board" });

        const updatedBoard = await prisma.board.update({
            where: { id: boardId },
            data: { title }
        });

        // Notify other clients in the board
        io.to(`board:${boardId}`).emit('board:updated', updatedBoard);

        res.json(updatedBoard);
    } catch {
        res.status(500).json({ error: "Error updating board" });
    }
});

// Get all members of a board
boardsRouter.get('/:id/members', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const boardId = req.params.id as string;
        const userId = req.user?.userId as string;

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { ownerId: true, members: { where: { userId } } }
        });

        if (!board || (board.ownerId !== userId && board.members.length === 0)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const members = await prisma.boardMember.findMany({
            where: { boardId },
            include: { user: { select: { id: true, name: true, email: true } } }
        });

        res.json(members);
    } catch {
        res.status(500).json({ error: "Error fetching members" });
    }
});

boardsRouter.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.userId as string;
        const boardId = req.params.id as string;

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            include: {
                members: {
                    select: { role: true, userId: true }
                },
                lists: {
                    include: {
                        cards: {
                            select: {
                                id: true,
                                content: true,
                                createdAt: true,
                                description: true,
                                isDone: true,
                                priority: true,
                                order: true,
                                listId: true,
                                lockedBy: true,
                                lockedByName: true,
                                lockedAt: true,
                                inProgress: true,
                                tags: { select: { name: true, color: true } },
                                members: { select: { id: true, email: true, name: true }}
                            },
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!board) return res.status(404).json({ error: "Board not found" });

        // Explicitly type the board to help TypeScript recognize added fields
        type BoardWithRelations = Prisma.BoardGetPayload<{
            include: {
                members: { select: { role: true, userId: true } },
                lists: {
                    include: {
                        cards: {
                            select: {
                                id: true, content: true, description: true, isDone: true,
                                priority: true, order: true, listId: true, lockedBy: true,
                                lockedByName: true, lockedAt: true, inProgress: true,
                                tags: { select: { name: true, color: true } },
                                members: { select: { id: true, email: true, name: true }}
                            }
                        }
                    }
                }
            }
        }>;

        const validBoard = board as unknown as BoardWithRelations;

        // Check access
        const isOwner = validBoard.ownerId === userId;
        const isMember = validBoard.members.some(m => m.userId === userId);

        if (!isOwner && !isMember) {
            return res.status(403).json({ error: "Access denied" });
        }

        // Ensure Telemetry list exists for the board (as requested to keep optimizations/patterns)
        if (!validBoard.lists.find((l) => l.type === 'TELEMETRY')) {
            const telList = await prisma.list.create({
                data: { title: "Telemetria", boardId: validBoard.id, order: validBoard.lists.length, type: "TELEMETRY" },
                include: { cards: { include: { tags: true } } }
            });
            validBoard.lists.push(telList as any);
        }

        res.json(validBoard);
    } catch {
        res.status(500).json({ error: "Error fetching board details" });
    }
});

// Member management

boardsRouter.post('/:id/members', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const boardId = req.params.id as string;
        const userId = req.user?.userId as string;

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { ownerId: true, members: { where: { userId }, select: { role: true } } }
        });

        if (!board) return res.status(404).json({ error: "Board not found" });
        const canInvite = board.ownerId === userId;

        if (!canInvite) return res.status(403).json({ error: "Insufficient permissions" });

        const parsed = boardMemberSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error });

        const existingMember = await prisma.boardMember.findUnique({
            where: { boardId_userId: { boardId, userId: parsed.data.userId } }
        });

        if (existingMember) {
            return res.status(400).json({ error: "User is already a member of this board" });
        }

        const member = await prisma.boardMember.create({
            data: {
                boardId,
                userId: parsed.data.userId,
                role: parsed.data.role
            },
            include: { user: { select: { name: true, email: true } } }
        });

        res.json(member);
    } catch {
        res.status(500).json({ error: "Error adding member" });
    }
});

// Remove member from board
boardsRouter.delete('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const boardId = req.params.id as string;
        const targetUserId = req.params.userId as string;
        const currentUserId = req.user?.userId as string;

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { ownerId: true }
        });

        if (!board) return res.status(404).json({ error: "Board not found" });
        if (board.ownerId !== currentUserId) return res.status(403).json({ error: "Only owner can remove members" });
        if (board.ownerId === targetUserId) return res.status(400).json({ error: "Owner cannot remove themselves from the board" });

        await prisma.boardMember.delete({
            where: { boardId_userId: { boardId, userId: targetUserId } }
        });

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: "Error removing member" });
    }
});

// Delete board
boardsRouter.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const boardId = req.params.id as string;
        const currentUserId = req.user?.userId as string;

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { ownerId: true }
        });

        if (!board) return res.status(404).json({ error: "Board not found" });
        if (board.ownerId !== currentUserId) return res.status(403).json({ error: "Only owner can delete board" });

        await prisma.board.delete({
            where: { id: boardId }
        });

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: "Error deleting board" });
    }
});

export default boardsRouter
