// Alternative PostgreSQL Function Node - No external dependencies
// Uses n8n's built-in HTTP Request capabilities to call a simple API endpoint

const axios = require('axios'); // Usually available in n8n

async function executeQueryViaAPI(query, params = []) {
  try {
    // This assumes you have a simple API endpoint that can execute queries
    // You would need to create this API endpoint separately
    const response = await axios.post('http://your-api-endpoint/execute-query', {
      query: query,
      params: params,
      database: 'scheduler'
    });

    return {
      success: true,
      data: response.data,
      rowCount: response.data.length || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
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

  // Extract queries from your data format
  let queries = [];

  if (inputData[0].json.data && typeof inputData[0].json.data === 'object') {
    const data = inputData[0].json.data;
    const itemKeys = Object.keys(data).filter(key => key.startsWith('item'));

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

  if (queries.length === 0) {
    return [{
      json: {
        success: false,
        error: 'No queries found in input data'
      }
    }];
  }

  const results = [];

  for (let i = 0; i < queries.length; i++) {
    const queryObj = queries[i];
    console.log(`Executing query ${i + 1}: ${queryObj.query.substring(0, 100)}...`);

    const result = await executeQueryViaAPI(queryObj.query, queryObj.params);
    results.push({
      json: {
        queryIndex: i,
        query: queryObj.query,
        ...result
      }
    });
  }

  return results;
})();

// NOTE: This approach requires you to create a separate API endpoint
// that can execute PostgreSQL queries. The API would handle the pg module.

