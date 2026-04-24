import "dotenv/config";
import { app, httpServer } from "./lib/expressApp.js";

import authRouter from "./routes/auth.js";
import boardsRouter from "./routes/boards.js";
import listsRouter from "./routes/lists.js";
import cardsRouter from "./routes/cards.js";
import tagsRouter from "./routes/tags.js";
import usersRouter from "./routes/users.js";

app.use('/api/auth', authRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/lists', listsRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/users', usersRouter);

// Export for Vercel/Serverless (opcjonalnie)
export default app;

const PORT = process.env.PORT || 3001;

// Na Railway/Render/Local zawsze musimy nasłuchiwać na porcie
httpServer.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT} z obsługą Socket.io`);
});