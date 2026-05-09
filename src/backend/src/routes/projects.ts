import { FastifyInstance } from 'fastify';
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjectsByParent,
  updateProject,
} from '../services/projectService';

export async function projectRoutes(fastify: FastifyInstance) {
  /**
   * Get projects.
   *
   * /api/projects
   *   -> root projects
   *
   * /api/projects?parent_project_id=1
   *   -> child projects of project 1
   */
  fastify.get('/projects', async (request, reply) => {
    const query = request.query as { parent_project_id?: string };

    const parentProjectId =
      query.parent_project_id === undefined
        ? null
        : Number(query.parent_project_id);

    if (
      query.parent_project_id !== undefined &&
      Number.isNaN(parentProjectId)
    ) {
      return reply.status(400).send({ message: 'invalid parent_project_id' });
    }

    const projects = await getProjectsByParent(parentProjectId);
    return reply.send(projects);
  });

  fastify.get('/projects/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const id = Number(params.id);

    if (Number.isNaN(id)) {
      return reply.status(400).send({ message: 'invalid project id' });
    }

    const project = await getProjectById(id);

    if (!project) {
      return reply.status(404).send({ message: 'project not found' });
    }

    return reply.send(project);
  });

  fastify.post('/projects', async (request, reply) => {
    const body = request.body as {
      name?: string;
      status?: string;
      parent_project_id?: number | null;
    };

    if (!body?.name || !body.name.trim()) {
      return reply.status(400).send({ message: 'name is required' });
    }

    const project = await createProject({
      name: body.name.trim(),
      status: body.status as any,
      parent_project_id: body.parent_project_id ?? null,
    });

    return reply.status(201).send(project);
  });

  fastify.put('/projects/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as { name?: string; status?: string };

    const id = Number(params.id);

    if (Number.isNaN(id)) {
      return reply.status(400).send({ message: 'invalid project id' });
    }

    const project = await updateProject(id, {
      name: body?.name?.trim(),
      status: body?.status as any,
    });

    if (!project) {
      return reply.status(404).send({ message: 'project not found' });
    }

    return reply.send(project);
  });

  fastify.delete('/projects/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const id = Number(params.id);

    if (Number.isNaN(id)) {
      return reply.status(400).send({ message: 'invalid project id' });
    }

    const deleted = await deleteProject(id);

    if (!deleted) {
      return reply.status(404).send({ message: 'project not found' });
    }

    return reply.status(204).send();
  });
}