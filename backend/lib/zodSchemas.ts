import { z } from 'zod';

export const registerSchema = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(1) });
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const tagSchema = z.object({ name: z.string().min(1), color: z.string().optional() });
export const listSchema = z.object({ title: z.string().min(1), boardId: z.string().uuid(), type: z.string().optional() });
export const cardSchema = z.object({ content: z.string().min(1), listId: z.string().uuid(), priority: z.string().optional() });
export const listUpdateSchema = z.object({ title: z.string().min(1) });
export const cardUpdateSchema = z.object({ 
    content: z.string().optional(), 
    description: z.string().nullable().optional(), 
    isDone: z.boolean().optional(),
    inProgress: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    listId: z.string().uuid().optional(),
    priority: z.string().optional()
});

export const boardSchema = z.object({ 
    title: z.string().min(1)
});

export const boardMemberSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER")
});