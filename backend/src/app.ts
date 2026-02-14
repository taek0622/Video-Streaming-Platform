import path from 'node:path';
import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { healthRouter } from './routes/health.route';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { logger } from './lib/logger';
import { authRouter } from './routes/auth.route';
import { meRouter } from './routes/me.route';
import { storageRouter } from './routes/storage.route';
import { videosRouter } from './routes/videos.route';
import { homeRouter } from './routes/home.route';
import { searchRouter } from './routes/search.route';
import { commentsRouter } from './routes/comments.route';
import { mediaRouter } from './routes/media.route';

export const app = express();
const localStorageRoot = path.isAbsolute(env.localStorageDir)
  ? env.localStorageDir
  : path.resolve(process.cwd(), env.localStorageDir);

app.use(express.json());
app.use(pinoHttp({ logger }));

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/me', meRouter);
app.use('/home', homeRouter);
app.use('/search', searchRouter);
app.use('/media', mediaRouter);
app.use('/videos', videosRouter);
app.use('/comments', commentsRouter);
app.use('/storage', storageRouter);
app.use('/uploads', express.static(localStorageRoot));

app.use(notFoundHandler);
app.use(errorHandler);
