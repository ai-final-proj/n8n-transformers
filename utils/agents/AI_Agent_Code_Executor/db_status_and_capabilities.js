/**
 * n8n Code node logic that publishes database status and tool definitions for the AI agent.
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
 * Helper function to sort keys numerically
 */
function numericOrder(key) {
  const digits = key.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 1000000;
}

/**
 * Extracts SQL queries and their parameters from n8n input formats.
 */
function extractQueries(inputItems) {
  const collected = [];

  for (const item of inputItems) {
    const payload = item.json || {};

    // Check for queries array
    const queriesArray = payload.queries;
    if (Array.isArray(queriesArray)) {
      for (const entry of queriesArray) {
        const text = entry?.query || '';
        if (typeof text === 'string' && text.trim()) {
          collected.push({
            query: text,
            params: entry.params || [],
          });
        }
      }
      continue;
    }

    // Check for data section
    const dataSection = payload.data;
    if (typeof dataSection === 'object' && dataSection !== null) {
      const sortedKeys = Object.keys(dataSection).sort((a, b) => numericOrder(a) - numericOrder(b));
      for (const key of sortedKeys) {
        const entry = dataSection[key] || {};
        const text = entry.query || '';
        if (typeof text === 'string' && text.trim()) {
          collected.push({
            query: text,
            params: entry.params || [],
          });
        }
      }
      continue;
    }

    // Check for queryX fields
    const queryKeys = Object.keys(payload).filter(key => key.toLowerCase().startsWith('query'));
    const sortedQueryKeys = queryKeys.sort((a, b) => numericOrder(a) - numericOrder(b));
    for (const key of sortedQueryKeys) {
      const text = payload[key] || '';
      if (typeof text === 'string' && text.trim()) {
        collected.push({ query: text, params: [] });
      }
    }
  }

  return collected;
}

/**
 * Executes the provided queries against PostgreSQL and returns metadata.
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
        meta.results.push({
          queryIndex: index,
          query: query,
          params: params,
          success: false,
          error: { message: 'Missing SQL statement for this item.' },
          executionTimeMs: 0,
        });
        continue;
      }

      try {
        const result = await client.query(query, params);
        const rows = result.rows || [];
        const fields = result.fields || [];
        const columnNames = fields.map(field => field.name);

        meta.results.push({
          queryIndex: index,
          query: query,
          params: params,
          success: true,
          rowCount: result.rowCount || rows.length,
          rows: rows,
          fields: fields.map(field => ({
            name: field.name,
            typeCode: field.dataTypeID,
          })),
          columns: columnNames,
          command: result.command,
          executionTimeMs: Date.now() - started,
        });
      } catch (error) {
        meta.results.push({
          queryIndex: index,
          query: query,
          params: params,
          success: false,
          error: { message: error.message },
          executionTimeMs: Date.now() - started,
        });
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
 * Main function - publishes database capability metadata and tool schemas for the agent.
 */
async function main(inputData, config = DB_CONFIG) {
  let initializationStatus = false;
  let errorMessage = null;

  try {
    const client = await connectToDb(config);
    await client.end();
    initializationStatus = true;
  } catch (error) {
    initializationStatus = false;
    errorMessage = `Database connection failed with configuration: ${error.message}`;
  }

  const toolsDefinitions = [
    {
      name: 'extract_sql_queries',
      description: 'Extracts SQL queries and parameters from raw n8n items using strict JSON-emitter mode rules. Supports arrays at `json.queries`, keyed maps under `json.data`, and `queryX` fields.',
      parameters: {
        type: 'object',
        properties: {
          input_items: {
            type: 'array',
            description: 'Raw n8n items (typically `$input.all()`). Each item must expose its payload via `json`.',
            items: {
              type: 'object',
              properties: {
                json: {
                  type: 'object',
                  description: 'The payload of an n8n item.'
                }
              },
              required: ['json']
            }
          }
        },
        required: ['input_items']
      }
    },
    {
      name: 'execute_db_queries',
      description: 'Runs read-only SQL queries against PostgreSQL and returns per-query results with summaries.',
      parameters: {
        type: 'object',
        properties: {
          queries_to_execute: {
            type: 'array',
            description: 'List of query objects (usually from `extract_sql_queries`). Each entry must provide a SQL string and optional parameters.',
            items: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'SQL statement to execute.'
                },
                params: {
                  type: 'array',
                  description: 'Optional parameters aligned with positional placeholders.',
                  items: {
                    type: ['string', 'number', 'boolean', 'null']
                  }
                }
              },
              required: ['query']
            }
          }
        },
        required: ['queries_to_execute']
      }
    }
  ];

  const outputPayload = {
    status: {
      pg_available: true,
      db_connection_initialized: initializationStatus,
      error_detail: errorMessage
    },
    description_for_ai_agent: 'Reports PostgreSQL connector readiness and exposes tools to extract and execute queries. Always rely on these tools for database work.',
    tools_for_ai_agent: toolsDefinitions,
    example_agent_thought_process: 'If `db_connection_initialized` is true, first call `extract_sql_queries` with `$input.all()`. Then pass the resulting queries to `execute_db_queries` and summarize the response.'
  };

  return [{ json: outputPayload }];
}

module.exports = { main };
