import { type Response, type NextFunction } from 'express';
import { type AuthRequest } from '../types.js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET) {
    console.error("FATAL: JWT_SECRET environment variable is not set!");
    process.exit(1);
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

export { authMiddleware, JWT_SECRET }