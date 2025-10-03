// n8n Function Node - Execute Multiple PostgreSQL Queries
// Input: Array of queries in the format [{ query: "SELECT * FROM table", params: [] }, ...]
// Output: Array of results with full response for each query

const { Client } = require('pg');

async function executeQueries(queries) {
  const client = new Client({
    host: 'host.docker.internal', // Use host.docker.internal to connect to host from Docker
    port: 5432,
    database: 'scheduler',
    user: 'postgres',
    password: 'postgres'
  });

  const results = [];

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    for (let i = 0; i < queries.length; i++) {
      const queryObj = queries[i];
      const query = queryObj.query;
      const params = queryObj.params || [];

      try {
        console.log(`Executing query ${i + 1}: ${query.substring(0, 100)}...`);

        const result = await client.query(query, params);

        // Full response includes all metadata
        results.push({
          queryIndex: i,
          query: query,
          params: params,
          success: true,
          rowCount: result.rowCount,
          rows: result.rows,
          fields: result.fields,
          command: result.command,
          oid: result.oid,
          executionTime: Date.now() // You could track timing if needed
        });

      } catch (queryError) {
        console.error(`Error executing query ${i + 1}:`, queryError);

        results.push({
          queryIndex: i,
          query: query,
          params: params,
          success: false,
          error: {
            message: queryError.message,
            code: queryError.code,
            severity: queryError.severity,
            detail: queryError.detail,
            hint: queryError.hint,
            position: queryError.position,
            internalPosition: queryError.internalPosition,
            internalQuery: queryError.internalQuery,
            where: queryError.where,
            schema: queryError.schema,
            table: queryError.table,
            column: queryError.column,
            dataType: queryError.dataType,
            constraint: queryError.constraint,
            file: queryError.file,
            line: queryError.line,
            routine: queryError.routine
          }
        });
      }
    }

  } catch (connectionError) {
    console.error('Database connection error:', connectionError);
    return [{
      json: {
        success: false,
        error: 'Database connection failed',
        details: connectionError.message
      }
    }];
  } finally {
    await client.end();
    console.log('Database connection closed');
  }

  return results.map(result => ({ json: result }));
}

// Main function for n8n
return (async () => {
  const inputData = $input.all();

  if (!inputData || inputData.length === 0) {
    return [{
      json: {
        success: false,
        error: 'No input data provided'
      }
    }];
  }

  // Extract queries from input - can be in various formats
  let queries = [];

  // Check if input contains a queries array directly
  if (inputData[0].json.queries && Array.isArray(inputData[0].json.queries)) {
    queries = inputData[0].json.queries;
  }
  // Check if input contains data object with item1, item2, etc. (your format)
  else if (inputData[0].json.data && typeof inputData[0].json.data === 'object') {
    const data = inputData[0].json.data;
    const itemKeys = Object.keys(data).filter(key => key.startsWith('item'));

    // Sort items numerically (item1, item2, item3, etc.)
    itemKeys.sort((a, b) => {
      const numA = parseInt(a.replace('item', ''));
      const numB = parseInt(b.replace('item', ''));
      return numA - numB;
    });

    for (const key of itemKeys) {
      const item = data[key];
      if (item && item.query) {
        queries.push({
          query: item.query,
          params: item.params || []
        });
      }
    }
  }
  // Check if input contains individual query fields (query1, query2, etc.)
  else {
    const firstItem = inputData[0].json;
    const queryKeys = Object.keys(firstItem).filter(key => key.startsWith('query'));

    for (const key of queryKeys) {
      queries.push({
        query: firstItem[key],
        params: []
      });
    }
  }

  if (queries.length === 0) {
    return [{
      json: {
        success: false,
        error: 'No queries found in input data'
      }
    }];
  }

  console.log(`Found ${queries.length} queries to execute`);
  return await executeQueries(queries);
})();
