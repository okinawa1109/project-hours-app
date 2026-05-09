import { FastifyInstance } from 'fastify';
import {
  getChildProjectWorklogsByMonth,
  getDailyTotal,
  getMonthlyOverallTotal,
  getMonthlyProjectSummary,
  getProjectDailyTotal,
  getProjectTotal,
  getWorklogsByDate,
  upsertWorklog,
} from '../services/worklogService';

export async function worklogRoutes(fastify: FastifyInstance) {
  /**
   * Save or update worklog.
   * Same date + same project => update existing row.
   */
  fastify.post('/worklogs', async (request, reply) => {
    const body = request.body as {
      work_date?: string;
      project_id?: number;
      hours?: number;
      comment?: string | null;
    };

    if (!body.work_date || !body.project_id || body.hours === undefined) {
      return reply.status(400).send({ message: 'work_date, project_id and hours are required' });
    }

    if (body.hours < 0 || body.hours > 24) {
      return reply.status(400).send({ message: 'hours must be between 0 and 24' });
    }

    const saved = await upsertWorklog({
      work_date: body.work_date,
      project_id: Number(body.project_id),
      hours: Number(body.hours),
      comment: body.comment ?? null,
    });

    return reply.status(201).send(saved);
  });

  /**
   * Load saved worklogs for a specific date.
   * Frontend uses this when the page is opened again.
   */
  fastify.get('/worklogs', async (request, reply) => {
    const query = request.query as { work_date?: string };

    if (!query.work_date) {
      return reply.status(400).send({ message: 'work_date is required' });
    }

    const rows = await getWorklogsByDate(query.work_date);
    return reply.send(rows);
  });

  fastify.get('/summary/daily', async (request, reply) => {
    const query = request.query as { work_date?: string };

    if (!query.work_date) {
      return reply.status(400).send({ message: 'work_date is required' });
    }

    const total = await getDailyTotal(query.work_date);
    return reply.send({ work_date: query.work_date, total });
  });

  fastify.get('/summary/monthly-project', async (request, reply) => {
    const query = request.query as { year_month?: string };

    if (!query.year_month) {
      return reply.status(400).send({ message: 'year_month is required' });
    }

    const summary = await getMonthlyProjectSummary(query.year_month);
    return reply.send(summary);
  });

  fastify.get('/summary/monthly-total', async (request, reply) => {
    const query = request.query as { year_month?: string };

    if (!query.year_month) {
      return reply.status(400).send({ message: 'year_month is required' });
    }

    const total = await getMonthlyOverallTotal(query.year_month);
    return reply.send({ year_month: query.year_month, total });
  });
  
  fastify.get('/summary/project-daily', async (request, reply) => {
  const query = request.query as {
    project_id?: string;
    work_date?: string;
  };

  if (!query.project_id || !query.work_date) {
    return reply.status(400).send({
      message: 'project_id and work_date are required',
    });
  }

  const projectId = Number(query.project_id);

  if (Number.isNaN(projectId)) {
    return reply.status(400).send({ message: 'invalid project_id' });
  }

  const total = await getProjectDailyTotal(projectId, query.work_date);

  return reply.send({
    project_id: projectId,
    work_date: query.work_date,
    total,
  });
});

/**
 * Get project total hours.
 *
 * Examples:
 * /api/summary/project-total?project_id=1&scope=all
 * /api/summary/project-total?project_id=1&scope=month&year_month=2026-05
 */
fastify.get('/summary/project-total', async (request, reply) => {
  try {
    const query = request.query as {
      project_id?: string;
      scope?: string;
      year_month?: string;
    };

    if (!query.project_id) {
      return reply.status(400).send({
        message: 'project_id is required',
      });
    }

    const projectId = Number(query.project_id);

    if (Number.isNaN(projectId)) {
      return reply.status(400).send({
        message: 'invalid project_id',
      });
    }

    const scope = query.scope === 'all' ? 'all' : 'month';

    if (scope === 'month' && !query.year_month) {
      return reply.status(400).send({
        message: 'year_month is required when scope is month',
      });
    }

    const total = await getProjectTotal(
      projectId,
      scope,
      query.year_month
    );

    return reply.send({
      project_id: projectId,
      scope,
      year_month: query.year_month ?? null,
      total,
    });
  } catch (error: any) {
    console.error('GET /api/summary/project-total failed:', error);

    return reply.status(500).send({
      error: 'failed to fetch project total',
      detail: error?.message ?? String(error),
    });
  }
});

 /**
 * Get child project worklogs by month.
 *
 * Example:
 * GET /api/worklogs/child-month?parent_project_id=1&year_month=2026-05
 */
fastify.get('/worklogs/child-month', async (request, reply) => {
  try {
    const query = request.query as {
      parent_project_id?: string;
      year_month?: string;
    };

    if (!query.parent_project_id || !query.year_month) {
      return reply.status(400).send({
        message: 'parent_project_id and year_month are required',
      });
    }

    const parentProjectId = Number(query.parent_project_id);

    if (Number.isNaN(parentProjectId)) {
      return reply.status(400).send({
        message: 'invalid parent_project_id',
      });
    }

    const rows = await getChildProjectWorklogsByMonth(
      parentProjectId,
      query.year_month
    );

    return reply.send(rows);
  } catch (error: any) {
    console.error('GET /api/worklogs/child-month failed:', error);

    return reply.status(500).send({
      error: 'failed to fetch child project worklogs by month',
      detail: error?.message ?? String(error),
    });
  }
});

}