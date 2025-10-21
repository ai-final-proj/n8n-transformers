// Helper functions ported from the Python tooling for use in an n8n JavaScript Code node.
/* eslint-disable @typescript-eslint/no-var-requires */
const { Client } = require('pg');

const sslMode = process.env.POSTGRES_SSLMODE || 'prefer';

const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'host.docker.internal',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || 'scheduler',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  sslMode,
};

async function connectToDb(config = DB_CONFIG) {
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.sslMode && config.sslMode !== 'disable' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  return client;
}

function numericOrder(key) {
  const digits = String(key)
    .split('')
    .filter((ch) => /\d/.test(ch))
    .join('');
  return digits ? Number(digits) : 10 ** 6;
}

function extractQueries(inputItems) {
  const collected = [];

  for (const item of inputItems || []) {
    const payload = item && item.json ? item.json : {};

    const queriesArray = payload.queries;
    if (Array.isArray(queriesArray)) {
      for (const entry of queriesArray) {
        const text = entry?.query || '';
        if (typeof text === 'string' && text.trim()) {
          collected.push({
            query: text,
            params: Array.isArray(entry?.params) ? entry.params : [],
          });
        }
      }
      continue;
    }

    const dataSection = payload.data;
    if (dataSection && typeof dataSection === 'object' && !Array.isArray(dataSection)) {
      for (const key of Object.keys(dataSection).sort((a, b) => numericOrder(a) - numericOrder(b))) {
        const entry = dataSection[key] || {};
        const text = entry.query || '';
        if (typeof text === 'string' && text.trim()) {
          collected.push({
            query: text,
            params: Array.isArray(entry.params) ? entry.params : [],
          });
        }
      }
      continue;
    }

    const queryKeys = Object.keys(payload).filter((key) => key.toLowerCase().startsWith('query'));
    for (const key of queryKeys.sort((a, b) => numericOrder(a) - numericOrder(b))) {
      const text = payload[key] || '';
      if (typeof text === 'string' && text.trim()) {
        collected.push({ query: text, params: [] });
      }
    }
  }

  return collected;
}

async function executeMultipleQueries(queries, config = DB_CONFIG) {
  const meta = {
    summary: {
      startedAt: new Date().toISOString(),
      totalQueries: Array.isArray(queries) ? queries.length : 0,
    },
    results: [],
  };

  if (!Array.isArray(queries) || queries.length === 0) {
    meta.summary.finishedAt = new Date().toISOString();
    meta.summary.hadErrors = false;
    meta.summary.durationMs = 0;
    return meta;
  }

  let client;
  try {
    client = await connectToDb(config);

    for (let index = 0; index < queries.length; index += 1) {
      const entry = queries[index] || {};
      const query = typeof entry.query === 'string' ? entry.query.trim() : '';
      const params = Array.isArray(entry.params) ? entry.params : [];
      const started = Date.now();

      if (!query) {
        meta.results.push({
          queryIndex: index,
          query,
          params,
          success: false,
          error: { message: 'Missing SQL statement for this item.' },
          executionTimeMs: 0,
        });
        continue;
      }

      await client.query('BEGIN');
      try {
        const result = await client.query(query, params);
        const fields = result.fields.map((field) => ({
          name: field.name,
          typeCode: field.dataTypeID,
        }));

        await client.query('COMMIT');
        meta.results.push({
          queryIndex: index,
          query,
          params,
          success: true,
          rowCount: result.rowCount,
          rows: result.rows,
          fields,
          columns: fields.map((field) => field.name),
          command: result.command,
          executionTimeMs: Date.now() - started,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        meta.results.push({
          queryIndex: index,
          query,
          params,
          success: false,
          error: { message: error.message },
          executionTimeMs: Date.now() - started,
        });
      }
    }

    meta.summary.finishedAt = new Date().toISOString();
    meta.summary.hadErrors = meta.results.some((result) => !result.success);
    meta.summary.durationMs = new Date(meta.summary.finishedAt).getTime() - new Date(meta.summary.startedAt).getTime();
    return meta;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

module.exports = {
  DB_CONFIG,
  connectToDb,
  extractQueries,
  executeMultipleQueries,
};
