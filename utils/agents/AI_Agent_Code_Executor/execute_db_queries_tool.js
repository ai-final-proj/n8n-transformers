/**
 * n8n Code node that executes SQL queries against PostgreSQL.
 */

const { Client } = require('pg');

// Database configuration
const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'host.docker.internal',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || 'scheduler',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  sslMode: process.env.POSTGRES_SSLMODE || 'prefer',
};

/**
 * Establishes a connection to the PostgreSQL database.
 */
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

/**
 * Generate a concise summary of query results.
 */
function generateQuerySummary(result) {
  if (!result.success) {
    return `Query failed: ${result.error.message}`;
  }
  
  const rowCount = result.rowCount;
  const executionTime = result.executionTimeMs;
  
  if (rowCount === 0) {
    return `No rows returned (executed in ${executionTime}ms)`;
  }
  
  const columns = result.columns || [];
  let columnInfo = '';
  if (columns.length > 0) {
    columnInfo = ` with columns: ${columns.slice(0, 3).join(', ')}`;
    if (columns.length > 3) {
      columnInfo += ` and ${columns.length - 3} more`;
    }
  }
  
  return `Returned ${rowCount} rows${columnInfo} (executed in ${executionTime}ms)`;
}

/**
 * Executes a list of SQL queries and returns structured metadata with summaries.
 */
async function executeMultipleQueries(queries, config = DB_CONFIG) {
  const meta = {
    summary: {
      startedAt: new Date().toISOString(),
      totalQueries: queries.length,
    },
    results: [],
  };

  let client = null;
  try {
    client = await connectToDb(config);

    for (let index = 0; index < queries.length; index++) {
      const entry = queries[index];
      const query = (entry.query || '').trim();
      const params = entry.params || [];
      const started = Date.now();

      if (!query) {
        const result = {
          queryIndex: index,
          query_used: query,
          params: params,
          success: false,
          error: { message: 'Missing SQL statement for this item.' },
          executionTimeMs: 0,
        };
        result.summary = generateQuerySummary(result);
        meta.results.push(result);
        continue;
      }

      try {
        const dbResult = await client.query(query, params);
        const rows = dbResult.rows || [];
        const fields = dbResult.fields || [];
        const columnNames = fields.map(field => field.name);

        const result = {
          queryIndex: index,
          query_used: query,
          params: params,
          success: true,
          rowCount: dbResult.rowCount || rows.length,
          rows: rows,
          fields: fields.map(field => ({
            name: field.name,
            typeCode: field.dataTypeID,
          })),
          columns: columnNames,
          command: dbResult.command,
          executionTimeMs: Date.now() - started,
        };
        result.summary = generateQuerySummary(result);
        meta.results.push(result);
      } catch (error) {
        const result = {
          queryIndex: index,
          query_used: query,
          params: params,
          success: false,
          error: { message: error.message },
          executionTimeMs: Date.now() - started,
        };
        result.summary = generateQuerySummary(result);
        meta.results.push(result);
      }
    }

    meta.summary.finishedAt = new Date().toISOString();
    meta.summary.hadErrors = meta.results.some(result => !result.success);
    meta.summary.durationMs = new Date(meta.summary.finishedAt).getTime() - new Date(meta.summary.startedAt).getTime();

    return meta;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

/**
 * Entry point invoked by n8n when the AI agent requests execution.
 */
async function main(inputData) {
  try {
    const toolArgs = inputData[0].json || {};
    const queriesToRun = toolArgs.queries_to_execute;

    if (!queriesToRun) {
      return [{ json: { error: "Missing 'queries_to_execute' for database execution." } }];
    }

    const executionResults = await executeMultipleQueries(queriesToRun, DB_CONFIG);
    return [{ json: executionResults }];
  } catch (error) {
    return [{ json: { error: error.message } }];
  }
}

module.exports = { main };
