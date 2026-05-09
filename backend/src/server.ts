import Fastify from 'fastify';
import cors from '@fastify/cors';
import { projectRoutes } from './routes/projects';
import { worklogRoutes } from './routes/worklogs';

const app = Fastify({
  logger: true,
});

async function buildServer() {
  // Allow frontend dev server access.
  await app.register(cors, {
    origin: true,
  });

  // Health check endpoint.
  app.get('/health', async () => {
    return { ok: true };
  });

  // Feature routes.
  await app.register(projectRoutes, { prefix: '/api' });
  await app.register(worklogRoutes, { prefix: '/api' });

  return app;
}

buildServer()
  .then(async () => {
    const port = Number(process.env.PORT || 3000);
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`server listening on ${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });