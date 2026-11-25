import { app } from './app';
import { config, validateConfig } from './config';

validateConfig();

const server = app.listen(config.port, () => {
  console.log(`[RepoMind Backend] Server running at http://localhost:${config.port}`);
});

process.on('SIGTERM', () => {
  console.log('[RepoMind Backend] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[RepoMind Backend] SIGINT received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
