import bcrypt from 'bcrypt';
import { registerSchema, loginSchema } from '../lib/zodSchemas.js';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';
import express from 'express'

const authRouter = express.Router();

// /api/auth Endpoints

authRouter.post('/register', async (req, res) => {
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
    } catch {
        res.status(500).json({ error: "Registration failed" });
    }
});

authRouter.post('/login', async (req, res) => {
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
    } catch {
        res.status(500).json({ error: "Login failed" });
    }
});

export default authRouter