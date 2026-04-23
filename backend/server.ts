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

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Serwer działa z obsługą Socket.io na http://localhost:${PORT}`);
});