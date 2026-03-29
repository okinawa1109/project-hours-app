import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const app = Fastify({ logger: true });
const { Pool } = pg;

const pool = new Pool({
  host: "db",
  port: 5432,
  user: "appuser",
  password: "apppass",
  database: "projecthours"
});

app.register(cors, { origin: true });

app.get("/health", async () => {
  return { ok: true };
});

app.get("/projects", async () => {
  const result = await pool.query(
    "SELECT id, name, is_active FROM projects WHERE is_active = true ORDER BY id"
  );
  return result.rows;
});

app.post("/projects", async (request, reply) => {
  const body = request.body as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return reply.status(400).send({ error: "name is required" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO projects (name, is_active)
      VALUES ($1, true)
      RETURNING id, name, is_active
      `,
      [name]
    );

    return result.rows[0];
  } catch (error: any) {
    if (error.code === "23505") {
      return reply.status(409).send({ error: "project already exists" });
    }
    return reply.status(500).send({ error: "failed to create project" });
  }
});

app.get("/worklogs", async (request) => {
  const { month } = request.query as { month?: string };

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { error: "month must be YYYY-MM" };
  }

  const result = await pool.query(
    `
    SELECT wl.work_date, wl.project_id, wl.hours
    FROM work_logs wl
    WHERE TO_CHAR(wl.work_date, 'YYYY-MM') = $1
    ORDER BY wl.work_date, wl.project_id
    `,
    [month]
  );

  return result.rows;
});

app.post("/worklogs", async (request, reply) => {
  const body = request.body as {
    work_date: string;
    project_id: number;
    hours: number;
  };

  const { work_date, project_id, hours } = body;

  if (!work_date || !project_id || hours == null || hours < 0) {
    return reply.status(400).send({ error: "invalid payload" });
  }

  await pool.query(
    `
    INSERT INTO work_logs (work_date, project_id, hours)
    VALUES ($1, $2, $3)
    ON CONFLICT (work_date, project_id)
    DO UPDATE SET hours = EXCLUDED.hours
    `,
    [work_date, project_id, hours]
  );

  return { ok: true };
});

app.get("/summary/monthly", async (request) => {
  const { month } = request.query as { month?: string };

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { error: "month must be YYYY-MM" };
  }

  const result = await pool.query(
    `
    SELECT p.id AS project_id, p.name, COALESCE(SUM(wl.hours), 0) AS total_hours
    FROM projects p
    LEFT JOIN work_logs wl
      ON wl.project_id = p.id
      AND TO_CHAR(wl.work_date, 'YYYY-MM') = $1
    WHERE p.is_active = true
    GROUP BY p.id, p.name
    ORDER BY p.id
    `,
    [month]
  );

  return result.rows;
});

app.get("/summary/all", async () => {
  const result = await pool.query(
    `
    SELECT p.id AS project_id, p.name, COALESCE(SUM(wl.hours), 0) AS total_hours
    FROM projects p
    LEFT JOIN work_logs wl
      ON wl.project_id = p.id
    WHERE p.is_active = true
    GROUP BY p.id, p.name
    ORDER BY p.id
    `
  );

  return result.rows;
});

const start = async () => {
  try {
    await app.listen({ host: "0.0.0.0", port: 3000 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();