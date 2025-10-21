# OpenAI 4.1 Mini SQL Executor Agent (v1)

## System Message Template

BEGIN_SYSTEM_MESSAGE
ROLE
You are a PostgreSQL SELECT extractor and executor operating in strict JSON-emitter mode, designed to work with OpenAI 4.1 mini in n8n workflows.

SCOPE

-   Process items from RAG collections that contain SQL queries in the "response" array
-   Execute read-only SELECT queries against PostgreSQL database
-   Provide structured output with query used, database response, and concise summary

BEGIN_INPUT_PROCESSING

-   Expect input from upstream Llama RAG summarization containing SQL queries
-   Look for JSON objects with "response" array containing strings with SQL queries
-   Optional "schema" field for table validation
-   Process each string in "response" array in order

EXTRACTION_RULES
Follow strict precedence for SQL extraction:

1. Fenced SQL blocks: `sql ... `
2. Inline SQL: `SELECT ...`
3. Statement scan: Find SELECT or WITH...SELECT patterns

VALIDATION

-   Only execute read-only queries (SELECT, WITH...SELECT)
-   Reject INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, etc.
-   Apply schema validation if provided
-   Only allowed correction: public.user → public."user"

EXECUTION_PROTOCOL

1. Extract SQL queries using strict rules
2. Execute each valid query against PostgreSQL
3. Generate concise summaries for each result
4. Return structured output

OUTPUT_FORMAT
For each executed query:
{
"query_used": "<exact SQL query>",
"db_response": {
"success": true/false,
"rowCount": <number>,
"rows": [<result objects>],
"fields": [<field metadata>],
"executionTimeMs": <number>
},
"summary": "<concise summary>"
}

ERROR_HANDLING

-   If no valid SELECT queries found: {"error": "No valid SELECT queries found in input"}
-   If database connection fails: report error details
-   If query execution fails: include error message in response

CONSTRAINTS

-   Never modify, synthesize, or reformat SQL beyond minimal trimming
-   Preserve original spacing and casing
-   Do not add aliases, functions, or qualifiers
-   Only process content from "response" array
-   Maintain strict read-only enforcement
    END_SYSTEM_MESSAGE

## Runtime Configuration for OpenAI 4.1 Mini

### Model Settings

-   **Model**: gpt-4.1-mini
-   **Temperature**: 0 (deterministic output)
-   **Top P**: 1
-   **Frequency Penalty**: 0
-   **Presence Penalty**: 0
-   **Max Tokens**: 4000 (sufficient for query results and summaries)

### Tool Integration

-   **Primary Tool**: AI Agent Tool - Code Executor
-   **Tool Parameters**:
    -   `input_items`: Pass `$input.all()` from upstream RAG
    -   `description`: "Executing SQL queries extracted from RAG response"

### Workflow Integration Points

#### Input from Llama RAG

````json
{
	"response": [
		"1. Here's a query to get user data: ```sql\nSELECT id, name, email FROM users WHERE active = true\n```",
		"2. Another query: `SELECT COUNT(*) FROM orders WHERE status = 'completed'`",
		"3. Complex query: WITH recent_orders AS (SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '30 days') SELECT COUNT(*) FROM recent_orders"
	],
	"schema": "CREATE TABLE users (id INT, name VARCHAR, email VARCHAR, active BOOLEAN); CREATE TABLE orders (id INT, status VARCHAR, created_at TIMESTAMP);"
}
````

#### Expected Output

```json
{
  "results": [
    {
      "query_used": "SELECT id, name, email FROM users WHERE active = true",
      "db_response": {
        "success": true,
        "rowCount": 150,
        "rows": [{"id": 1, "name": "John Doe", "email": "john@example.com"}, ...],
        "fields": [{"name": "id", "typeCode": 23}, {"name": "name", "typeCode": 1043}, {"name": "email", "typeCode": 1043}],
        "executionTimeMs": 45
      },
      "summary": "Returned 150 rows with columns: id, name, email (executed in 45ms)"
    },
    {
      "query_used": "SELECT COUNT(*) FROM orders WHERE status = 'completed'",
      "db_response": {
        "success": true,
        "rowCount": 1,
        "rows": [{"count": 1250}],
        "fields": [{"name": "count", "typeCode": 20}],
        "executionTimeMs": 23
      },
      "summary": "Returned 1 rows with columns: count (executed in 23ms)"
    }
  ]
}
```

## n8n Node Configuration

### AI Agent Node Settings

-   **Model**: OpenAI GPT-4.1-mini
-   **System Message**: Use the system message template above
-   **Tools**: Connect to "AI Agent Tool - Code Executor"
-   **Temperature**: 0
-   **Max Tokens**: 4000

### Tool Node Configuration

-   **Node Type**: Code
-   **Language**: Python
-   **Code**: Use `execute_db_queries_tool.py` from AI_Agent_Code_Executor directory
-   **Environment Variables**:
    -   `POSTGRES_HOST`: Database host
    -   `POSTGRES_PORT`: Database port (default: 5432)
    -   `POSTGRES_DB`: Database name
    -   `POSTGRES_USER`: Database user
    -   `POSTGRES_PASSWORD`: Database password
    -   `POSTGRES_SSLMODE`: SSL mode (default: prefer)

### Database Status Node

-   **Node Type**: Code
-   **Language**: Python
-   **Code**: Use `db_status_and_capabilities.py`
-   **Purpose**: Check database connectivity and provide tool definitions

## Error Handling

### Common Error Scenarios

1. **No SQL queries found**: Return error message
2. **Database connection failed**: Report connection error
3. **Invalid SQL syntax**: Include syntax error in response
4. **Permission denied**: Report access error
5. **Table not found**: Report missing table error

### Error Response Format

```json
{
	"error": "Error description",
	"query_used": "<query that failed>",
	"db_response": {
		"success": false,
		"error": { "message": "Detailed error message" }
	},
	"summary": "Query failed: Detailed error message"
}
```

## Performance Considerations

### Query Optimization

-   Use connection pooling for multiple queries
-   Set reasonable query timeouts
-   Monitor execution times in summaries
-   Limit result set sizes for large queries

### Memory Management

-   Stream large result sets if possible
-   Clear cursor after each query
-   Close connections properly
-   Monitor memory usage for large datasets

## Testing and Validation

### Test Cases

1. **Valid SELECT queries**: Should execute and return results
2. **Invalid SQL**: Should return error without execution
3. **Non-SELECT queries**: Should be rejected
4. **Empty results**: Should return empty result set
5. **Schema validation**: Should validate table existence
6. **Large result sets**: Should handle efficiently

### Validation Checklist

-   [ ] SQL extraction follows precedence rules
-   [ ] Only read-only queries are executed
-   [ ] Schema validation works correctly
-   [ ] Error handling is comprehensive
-   [ ] Output format matches specification
-   [ ] Performance is acceptable for expected load
