/**
 * n8n Code node that extracts SQL SELECT statements using strict JSON-emitter mode rules.
 */

/**
 * Helper function to sort keys numerically
 */
function numericOrder(key) {
  const digits = key.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 1000000;
}

/**
 * Remove SQL comments from the query.
 */
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ block comments
    .replace(/--.*$/gm, ''); // Remove -- line comments
}

/**
 * Check if the SQL query is read-only (SELECT or WITH...SELECT).
 */
function isReadOnlyQuery(sql) {
  const sqlClean = stripSqlComments(sql).trim().toUpperCase();
  
  // Check for data-changing keywords outside quoted strings
  const forbiddenKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CREATE', 'ALTER', 'DROP',
    'TRUNCATE', 'GRANT', 'REVOKE', 'COMMENT', 'COPY'
  ];
  
  // Simple check for quoted strings and forbidden keywords
  // This is a basic implementation - for production, use a proper SQL parser
  for (const keyword of forbiddenKeywords) {
    if (sqlClean.includes(keyword)) {
      return false;
    }
  }
  
  // Check for "SELECT ... INTO" pattern
  if (sqlClean.includes('SELECT') && sqlClean.includes('INTO')) {
    return false;
  }
  
  // Must start with SELECT or WITH
  return sqlClean.startsWith('SELECT') || sqlClean.startsWith('WITH');
}

/**
 * Extract SQL from fenced code blocks with sql language tag.
 */
function extractFromFencedSql(text) {
  const pattern = /```sql\s*\n(.*?)\n```/is;
  const match = text.match(pattern);
  if (match) {
    let sql = match[1].trim();
    if (sql.endsWith(';')) {
      sql = sql.slice(0, -1);
    }
    return sql;
  }
  return null;
}

/**
 * Extract SQL from single-backtick inline snippets.
 */
function extractFromInlineSql(text) {
  const pattern = /`([^`]+)`/;
  const match = text.match(pattern);
  if (match) {
    let sql = match[1].trim();
    if (sql.endsWith(';')) {
      sql = sql.slice(0, -1);
    }
    return sql;
  }
  return null;
}

/**
 * Extract SQL using statement scan (WITH...SELECT or SELECT).
 */
function extractFromStatementScan(text) {
  const textClean = text.trim();
  
  // Check for WITH...SELECT pattern
  if (textClean.toUpperCase().startsWith('WITH')) {
    const endPos = textClean.indexOf(';');
    if (endPos !== -1) {
      let sql = textClean.slice(0, endPos).trim();
      if (sql.endsWith(';')) {
        sql = sql.slice(0, -1);
      }
      return sql;
    }
    return textClean;
  }
  
  // Check for SELECT pattern
  const selectPos = textClean.toUpperCase().indexOf('SELECT');
  if (selectPos !== -1) {
    let sql = textClean.slice(selectPos).trim();
    const endPos = sql.indexOf(';');
    if (endPos !== -1) {
      sql = sql.slice(0, endPos).trim();
    }
    if (sql.endsWith(';')) {
      sql = sql.slice(0, -1);
    }
    return sql;
  }
  
  return null;
}

/**
 * Apply the only allowed identifier correction: public.user -> public."user".
 */
function applyIdentifierCorrection(sql) {
  return sql.replace(/public\.user/g, 'public."user"');
}

/**
 * Extract SQL from text using strict precedence rules.
 */
function extractSqlFromText(text) {
  if (!text || !text.trim()) {
    return null;
  }
  
  // Precedence 1: Fenced SQL with language tag
  let sql = extractFromFencedSql(text);
  if (sql && isReadOnlyQuery(sql)) {
    return applyIdentifierCorrection(sql);
  }
  
  // Precedence 2: Single-backtick inline SQL
  sql = extractFromInlineSql(text);
  if (sql && isReadOnlyQuery(sql)) {
    return applyIdentifierCorrection(sql);
  }
  
  // Precedence 3: Statement scan
  sql = extractFromStatementScan(text);
  if (sql && isReadOnlyQuery(sql)) {
    return applyIdentifierCorrection(sql);
  }
  
  return null;
}

/**
 * Validate that referenced tables exist in the schema.
 */
function validateSchemaTables(sql, schemaText) {
  if (!schemaText) {
    return true;
  }
  
  // Extract table names from FROM and JOIN clauses
  // This is a simplified approach - for production, use proper SQL parsing
  const tablePattern = /(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
  const matches = sql.match(tablePattern);
  
  if (matches) {
    for (const match of matches) {
      const tableName = match.replace(/(?:FROM|JOIN)\s+/i, '');
      if (!schemaText.includes(tableName)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Extracts SQL queries using strict JSON-emitter mode rules.
 */
function extractQueriesStrict(inputItems) {
  const collected = [];
  
  for (const item of inputItems) {
    const payload = item.json || {};
    
    // Look for "response" array first (primary input format)
    const responseArray = payload.response;
    if (Array.isArray(responseArray)) {
      const schemaText = payload.schema;
      for (const text of responseArray) {
        const sql = extractSqlFromText(text);
        if (sql && validateSchemaTables(sql, schemaText)) {
          collected.push({
            query: sql,
            params: []
          });
        }
      }
      continue;
    }
    
    // Fallback to legacy formats for backward compatibility
    const queriesArray = payload.queries;
    if (Array.isArray(queriesArray)) {
      for (const entry of queriesArray) {
        const text = entry?.query || '';
        const sql = extractSqlFromText(text);
        if (sql) {
          collected.push({
            query: sql,
            params: entry.params || []
          });
        }
      }
      continue;
    }

    const dataSection = payload.data;
    if (typeof dataSection === 'object' && dataSection !== null) {
      const sortedKeys = Object.keys(dataSection).sort((a, b) => numericOrder(a) - numericOrder(b));
      for (const key of sortedKeys) {
        const entry = dataSection[key] || {};
        const text = entry.query || '';
        const sql = extractSqlFromText(text);
        if (sql) {
          collected.push({
            query: sql,
            params: entry.params || []
          });
        }
      }
      continue;
    }

    const queryKeys = Object.keys(payload).filter(key => key.toLowerCase().startsWith('query'));
    const sortedQueryKeys = queryKeys.sort((a, b) => numericOrder(a) - numericOrder(b));
    for (const key of sortedQueryKeys) {
      const text = payload[key] || '';
      const sql = extractSqlFromText(text);
      if (sql) {
        collected.push({ query: sql, params: [] });
      }
    }
  }

  return collected;
}

/**
 * Entry point invoked by n8n when the AI agent calls this tool.
 */
async function main(inputData) {
  try {
    const toolArgs = inputData[0].json || {};
    const inputItemsForExtraction = toolArgs.input_items;

    if (!inputItemsForExtraction) {
      return [{ json: { error: "Missing 'input_items' for query extraction." } }];
    }

    const extractedQueries = extractQueriesStrict(inputItemsForExtraction);
    return [{ json: { extracted_queries: extractedQueries } }];
  } catch (error) {
    return [{ json: { error: error.message } }];
  }
}

module.exports = { main };
