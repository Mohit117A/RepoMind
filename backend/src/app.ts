import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { askRouter } from './routes/ask';
import { errorHandler, NotFoundError } from './lib/errors';

export function createApp(): Express {
  const app = express();

  // CORS configuration
  // Allow chrome-extension:// origins and requests without an Origin header (e.g. curl)
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.use(cors(corsOptions));

  // Request body parsing with size limit
  app.use(express.json({ limit: '100kb' }));

  // Request logging middleware (path and method only, no secrets or request bodies)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[HTTP] ${req.method} ${req.path}`);
    next();
  });

  // Mount routes
  app.use(healthRouter);
  app.use(askRouter);

  // Catch-all 404 handler for unknown routes
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('The requested endpoint does not exist'));
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
