import pg from 'pg';

const { Pool } = pg;

// DB connection for PostgreSQL.
// Values are expected from docker-compose / devcontainer environment variables.
export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'db',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'appuser',
  password: process.env.POSTGRES_PASSWORD || 'apppass',
  database: process.env.POSTGRES_DB || 'projecthours',
});