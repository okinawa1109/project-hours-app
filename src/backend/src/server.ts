import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

/**
 * 利用可能なプロジェクトステータス
 * DB の CHECK 制約とも合わせる
 */
const PROJECT_STATUSES = ["todo", "doing", "not_required", "done"] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const app = Fastify({ logger: true });
const { Pool } = pg;

/**
 * PostgreSQL 接続設定
 * Docker Compose 内の db サービスへ接続する
 */
const pool = new Pool({
  host: "db",
  port: 5432,
  user: "appuser",
  password: "apppass",
  database: "projecthours"
});

app.register(cors, { origin: true });

/**
 * ステータス妥当性チェック
 */
function isValidStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

/**
 * health check
 * サーバー稼働確認用
 */
app.get("/health", async () => {
  return { ok: true };
});

/**
 * 有効なプロジェクト一覧を返す
 * デフォルトではアーカイブ済みを除外
 *
 * query:
 *   includeArchived=true を付けると全件取得
 */
app.get("/projects", async (request) => {
  const { includeArchived } = request.query as { includeArchived?: string };

  if (includeArchived === "true") {
    const result = await pool.query(
      `
      SELECT id, name, is_active, status, is_archived, created_at
      FROM projects
      WHERE is_active = true
      ORDER BY is_archived ASC, id ASC
      `
    );
    return result.rows;
  }

  const result = await pool.query(
    `
    SELECT id, name, is_active, status, is_archived, created_at
    FROM projects
    WHERE is_active = true
      AND is_archived = false
    ORDER BY id ASC
    `
  );

  return result.rows;
});

/**
 * アーカイブ済みプロジェクト一覧
 */
app.get("/projects/archived", async () => {
  const result = await pool.query(
    `
    SELECT id, name, is_active, status, is_archived, created_at
    FROM projects
    WHERE is_active = true
      AND is_archived = true
    ORDER BY id ASC
    `
  );

  return result.rows;
});

/**
 * プロジェクト追加
 * 初期ステータスは未着手
 */
app.post("/projects", async (request, reply) => {
  const body = request.body as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return reply.status(400).send({ error: "name is required" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO projects (name, is_active, status, is_archived)
      VALUES ($1, true, 'todo', false)
      RETURNING id, name, is_active, status, is_archived, created_att
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

/**
 * プロジェクト更新
 * - 名前変更
 * - ステータス変更
 * - 完了なら自動アーカイブ
 * - 完了以外に戻したら自動でアーカイブ解除
 */
app.put("/projects/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    name?: string;
    status?: string;
  };

  const projectId = Number(id);
  const name = body.name?.trim();
  const status = body.status?.trim();

  if (!projectId || Number.isNaN(projectId)) {
    return reply.status(400).send({ error: "invalid project id" });
  }

  if (!name) {
    return reply.status(400).send({ error: "name is required" });
  }

  if (!status || !isValidStatus(status)) {
    return reply.status(400).send({ error: "invalid status" });
  }

  const isArchived = status === "done";

  try {
    const result = await pool.query(
      `
      UPDATE projects
      SET
        name = $1,
        status = $2,
        is_archived = $3
      WHERE id = $4
      RETURNING id, name, is_active, status, is_archived, created_at
      `,
      [name, status, isArchived, projectId]
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: "project not found" });
    }

    return result.rows[0];
  } catch (error: any) {
    if (error.code === "23505") {
      return reply.status(409).send({ error: "project already exists" });
    }
    return reply.status(500).send({ error: "failed to update project" });
  }
});

/**
 * プロジェクト削除
 * work_logs は FK の ON DELETE CASCADE で一緒に削除される
 */
app.delete("/projects/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const projectId = Number(id);

  if (!projectId || Number.isNaN(projectId)) {
    return reply.status(400).send({ error: "invalid project id" });
  }

  const result = await pool.query(
    `
    DELETE FROM projects
    WHERE id = $1
    RETURNING id
    `,
    [projectId]
  );

  if (result.rowCount === 0) {
    return reply.status(404).send({ error: "project not found" });
  }

  return { ok: true };
});

/**
 * 指定月の工数一覧を返す
 */
app.get("/worklogs", async (request) => {
  const { month } = request.query as { month?: string };

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { error: "month must be YYYY-MM" };
  }

  const result = await pool.query(
    `
    SELECT wl.work_date, wl.project_id, wl.hours
    FROM work_logs wl
    INNER JOIN projects p
      ON p.id = wl.project_id
    WHERE TO_CHAR(wl.work_date, 'YYYY-MM') = $1
      AND p.is_active = true
    ORDER BY wl.work_date, wl.project_id
    `,
    [month]
  );

  return result.rows;
});

/**
 * 工数保存
 * 同じ日付・同じプロジェクトがあれば上書き
 */
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

/**
 * 指定月のプロジェクト別合計
 * アーカイブ済みも含めて集計する
 */
app.get("/summary/monthly", async (request) => {
  const { month } = request.query as { month?: string };

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { error: "month must be YYYY-MM" };
  }

  const result = await pool.query(
    `
    SELECT
      p.id AS project_id,
      p.name,
      p.status,
      p.is_archived,
      COALESCE(SUM(wl.hours), 0) AS total_hours
    FROM projects p
    LEFT JOIN work_logs wl
      ON wl.project_id = p.id
      AND TO_CHAR(wl.work_date, 'YYYY-MM') = $1
    WHERE p.is_active = true
    GROUP BY p.id, p.name, p.status, p.is_archived
    ORDER BY p.is_archived ASC, p.id ASC
    `,
    [month]
  );

  return result.rows;
});

/**
 * 全期間のプロジェクト別合計
 * アーカイブ済みも含める
 */
app.get("/summary/all", async () => {
  const result = await pool.query(
    `
    SELECT
      p.id AS project_id,
      p.name,
      p.status,
      p.is_archived,
      COALESCE(SUM(wl.hours), 0) AS total_hours
    FROM projects p
    LEFT JOIN work_logs wl
      ON wl.project_id = p.id
    WHERE p.is_active = true
    GROUP BY p.id, p.name, p.status, p.is_archived
    ORDER BY p.is_archived ASC, p.id ASC
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