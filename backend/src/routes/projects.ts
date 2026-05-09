import { FastifyInstance } from 'fastify';
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjectsByParent,
  updateProject,
} from '../services/projectService';

/**
 * Project routes.
 *
 * server.ts 側で prefix: '/api' を付けているため、
 * ここでは '/projects' と書きます。
 *
 * 実際のURL:
 * GET    /api/projects
 * POST   /api/projects
 * GET    /api/projects/:id
 * PUT    /api/projects/:id
 * DELETE /api/projects/:id
 */
export async function projectRoutes(fastify: FastifyInstance) {
  /**
   * 親プロジェクト、または子プロジェクト一覧を取得します。
   *
   * /api/projects
   *   => 親プロジェクト一覧
   *
   * /api/projects?parent_project_id=1
   *   => project_id=1 の子プロジェクト一覧
   */
  fastify.get('/projects', async (request, reply) => {
    try {
      const query = request.query as {
        parent_project_id?: string;
      };

      const parentProjectId =
        query.parent_project_id === undefined ||
        query.parent_project_id === ''
          ? null
          : Number(query.parent_project_id);

      if (
        query.parent_project_id !== undefined &&
        query.parent_project_id !== '' &&
        Number.isNaN(parentProjectId)
      ) {
        return reply.status(400).send({
          error: 'invalid parent_project_id',
        });
      }

      const projects = await getProjectsByParent(parentProjectId);

      return reply.send(projects);
    } catch (error: any) {
      console.error('GET /api/projects failed:', error);

      return reply.status(500).send({
        error: 'failed to fetch projects',
        detail: error?.message ?? String(error),
        code: error?.code ?? null,
      });
    }
  });

  /**
   * プロジェクトを1件取得します。
   */
  fastify.get('/projects/:id', async (request, reply) => {
    try {
      const params = request.params as {
        id: string;
      };

      const id = Number(params.id);

      if (Number.isNaN(id)) {
        return reply.status(400).send({
          error: 'invalid project id',
        });
      }

      const project = await getProjectById(id);

      if (!project) {
        return reply.status(404).send({
          error: 'project not found',
        });
      }

      return reply.send(project);
    } catch (error: any) {
      console.error('GET /api/projects/:id failed:', error);

      return reply.status(500).send({
        error: 'failed to fetch project',
        detail: error?.message ?? String(error),
        code: error?.code ?? null,
      });
    }
  });

  /**
   * プロジェクトを新規作成します。
   *
   * parent_project_id:
   * - null: 親プロジェクト
   * - number: 子プロジェクト
   */
  fastify.post('/projects', async (request, reply) => {
    try {
      const body = request.body as {
        name?: string;
        status?: string;
        parent_project_id?: number | string | null;
      };

      console.log('POST /api/projects body:', body);

      if (!body?.name || !body.name.trim()) {
        return reply.status(400).send({
          error: 'name is required',
        });
      }

      const parentProjectId =
        body.parent_project_id === undefined ||
        body.parent_project_id === null ||
        body.parent_project_id === ''
          ? null
          : Number(body.parent_project_id);

      if (parentProjectId !== null && Number.isNaN(parentProjectId)) {
        return reply.status(400).send({
          error: 'invalid parent_project_id',
        });
      }

      const project = await createProject({
        name: body.name.trim(),
        status: body.status as any,
        parent_project_id: parentProjectId,
      });

      return reply.status(201).send(project);
    } catch (error: any) {
      console.error('POST /api/projects failed:', error);

      return reply.status(500).send({
        error: 'failed to create project',
        detail: error?.message ?? String(error),
        code: error?.code ?? null,
      });
    }
  });

  /**
   * プロジェクトを更新します。
   */
  fastify.put('/projects/:id', async (request, reply) => {
    try {
      const params = request.params as {
        id: string;
      };

      const body = request.body as {
        name?: string;
        status?: string;
      };

      const id = Number(params.id);

      if (Number.isNaN(id)) {
        return reply.status(400).send({
          error: 'invalid project id',
        });
      }

      const project = await updateProject(id, {
        name: body.name?.trim(),
        status: body.status as any,
      });

      if (!project) {
        return reply.status(404).send({
          error: 'project not found',
        });
      }

      return reply.send(project);
    } catch (error: any) {
      console.error('PUT /api/projects/:id failed:', error);

      return reply.status(500).send({
        error: 'failed to update project',
        detail: error?.message ?? String(error),
        code: error?.code ?? null,
      });
    }
  });

  /**
   * プロジェクトを削除します。
   */
  fastify.delete('/projects/:id', async (request, reply) => {
    try {
      const params = request.params as {
        id: string;
      };

      const id = Number(params.id);

      if (Number.isNaN(id)) {
        return reply.status(400).send({
          error: 'invalid project id',
        });
      }

      const deleted = await deleteProject(id);

      if (!deleted) {
        return reply.status(404).send({
          error: 'project not found',
        });
      }

      return reply.status(204).send();
    } catch (error: any) {
      console.error('DELETE /api/projects/:id failed:', error);

      return reply.status(500).send({
        error: 'failed to delete project',
        detail: error?.message ?? String(error),
        code: error?.code ?? null,
      });
    }
  });
}