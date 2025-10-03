// =====================================================
// N8N PostgreSQL Function Node Examples
// =====================================================

// Example 1: Simple Query Execution (Copy this directly into n8n Function node)
const simpleExecuteQuery = `
// n8n Function Node - Execute Single Query
const { Client } = require('pg');

return (async () => {
  const client = new Client({
    host: 'host.docker.internal',
    port: 5432,
    database: 'scheduler',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();
    const result = await client.query('SELECT * FROM your_table LIMIT 5');
    return [{ json: { success: true, rows: result.rows, rowCount: result.rowCount } }];
  } catch (error) {
    return [{ json: { success: false, error: error.message } }];
  } finally {
    await client.end();
  }
})();
`;

// Example 2: Execute Multiple Queries from Array (Copy this directly into n8n Function node)
const executeMultipleQueries = `
// n8n Function Node - Execute Multiple Queries
// Input: queries array like [{ query: "SELECT * FROM table1", params: [] }, { query: "SELECT * FROM table2", params: [] }]

const { Client } = require('pg');

async function executeQueries(queries) {
  const client = new Client({
    host: 'host.docker.internal',
    port: 5432,
    database: 'scheduler',
    user: 'postgres',
    password: 'postgres'
  });

  const results = [];

  try {
    await client.connect();

    for (let i = 0; i < queries.length; i++) {
      const queryObj = queries[i];
      try {
        const result = await client.query(queryObj.query, queryObj.params || []);
        results.push({
          queryIndex: i,
          query: queryObj.query,
          success: true,
          rowCount: result.rowCount,
          rows: result.rows
        });
      } catch (error) {
        results.push({
          queryIndex: i,
          query: queryObj.query,
          success: false,
          error: error.message
        });
      }
    }

    return results.map(r => ({ json: r }));

  } catch (error) {
    return [{ json: { success: false, error: 'Connection failed: ' + error.message } }];
  } finally {
    await client.end();
  }
}

return (async () => {
  const input = $input.all();
  if (!input || input.length === 0) {
    return [{ json: { error: 'No input data' } }];
  }

  const queries = input[0].json.queries || [];
  if (queries.length === 0) {
    return [{ json: { error: 'No queries found' } }];
  }

  return await executeQueries(queries);
})();
`;

// Example 3: Get Database Schema (Copy this directly into n8n Function node)
const getDatabaseSchema = `
// n8n Function Node - Get Database Schema
const { Client } = require('pg');

return (async () => {
  const client = new Client({
    host: 'host.docker.internal',
    port: 5432,
    database: 'scheduler',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();

    // Get tables
    const tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    );

    const schema = {};

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;

      // Get columns
      const columnsResult = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1",
        [tableName]
      );

      // Get indexes
      const indexesResult = await client.query(
        "SELECT indexname, indexdef FROM pg_indexes WHERE tablename=$1",
        [tableName]
      );

      schema[tableName] = {
        columns: columnsResult.rows,
        indexes: indexesResult.rows
      };
    }

    return [{ json: { success: true, schema } }];

  } catch (error) {
    return [{ json: { success: false, error: error.message } }];
  } finally {
    await client.end();
  }
})();
`;

// =====================================================
// How to Use These in n8n:
// =====================================================

/*
1. Create a new Function node in your n8n workflow
2. Copy one of the examples above into the Function field
3. Configure the input data as needed
4. The node will output the results in JSON format

Input Data Examples:

For executeMultipleQueries:
{
  "queries": [
    { "query": "SELECT * FROM users LIMIT 5", "params": [] },
    { "query": "SELECT COUNT(*) as total FROM users", "params": [] },
    { "query": "SELECT * FROM orders WHERE status = $1", "params": ["completed"] }
  ]
}

For single queries, you can pass the query directly in the input JSON.
*/

// Export for reference
module.exports = {
  simpleExecuteQuery,
  executeMultipleQueries,
  getDatabaseSchema
};

