import express from 'express'
import cors from 'cors';
import { createServer } from 'http';

const CORS_ORIGIN = process.env["CORS_ORIGIN"] || "http://localhost:5173";

const app = express();
const httpServer = createServer(app);

app.use(cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express.json({ limit: '10kb' }));

export { app, httpServer, CORS_ORIGIN }