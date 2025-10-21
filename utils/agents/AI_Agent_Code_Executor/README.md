# AI Agent Code Executor Assets

This directory hosts the code and prompts that support the PostgreSQL AI agent inside n8n, specifically designed for OpenAI 4.1 mini integration with Llama RAG workflows.

## Overview

This system implements a strict JSON-emitter mode for PostgreSQL SELECT extraction and execution, designed to work seamlessly with:

-   **Llama models** for RAG summarization and data gathering from collections
-   **OpenAI 4.1 mini** for SQL query generation and execution
-   **n8n workflows** for orchestration

## Key Features

-   **Strict SQL Extraction**: Follows precise precedence rules (fenced SQL → inline SQL → statement scan)
-   **Read-only Enforcement**: Only executes SELECT and WITH...SELECT queries
-   **Schema Validation**: Validates table existence against provided schema
-   **Structured Output**: Provides query used, database response, and concise summary
-   **Error Handling**: Comprehensive error reporting and graceful failure handling

## Files

### Core Components

-   `db_status_and_capabilities.py` — Database connectivity check and tool definitions
-   `extract_sql_queries_tool.py` — Strict SQL extraction using JSON-emitter mode rules
-   `execute_db_queries_tool.py` — PostgreSQL query execution with structured results
-   `system_message.md` — Updated system message with strict extraction rules

### Documentation

-   `README.md` — This file
-   `test_integration.py` — Integration test suite
-   `*_node.md` files — n8n node configuration guides

## Quick Start

### 1. Environment Setup

Set these environment variables in your n8n instance:

```bash
POSTGRES_HOST=host.docker.internal
POSTGRES_PORT=5432
POSTGRES_DB=scheduler
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_SSLMODE=prefer
```

### 2. n8n Workflow Setup

1. **Database Status Node**: Use `db_status_and_capabilities.py`
2. **AI Agent Node**: Configure with OpenAI 4.1 mini, temperature=0
3. **Tool Node**: Use `execute_db_queries_tool.py`
4. **System Message**: Use content from `system_message.md`

### 3. Input Format

Expected input from Llama RAG:

````json
{
	"response": [
		"1. Get active users: ```sql\nSELECT id, name FROM users WHERE active = true\n```",
		"2. Count orders: `SELECT COUNT(*) FROM orders`"
	],
	"schema": "CREATE TABLE users (id INT, name VARCHAR, active BOOLEAN);"
}
````

### 4. Output Format

Each executed query produces:

```json
{
  "query_used": "SELECT id, name FROM users WHERE active = true",
  "db_response": {
    "success": true,
    "rowCount": 150,
    "rows": [{"id": 1, "name": "John"}, ...],
    "fields": [{"name": "id", "typeCode": 23}, ...],
    "executionTimeMs": 45
  },
  "summary": "Returned 150 rows with columns: id, name (executed in 45ms)"
}
```

## Testing

Run the integration test:

```bash
cd utils/agents/AI_Agent_Code_Executor
python test_integration.py
```

## Architecture

```
Llama RAG → OpenAI 4.1 Mini → SQL Extraction → PostgreSQL → Structured Results
    ↓              ↓                ↓              ↓              ↓
Collections → Query Generation → Validation → Execution → Summary
```

## Security Features

-   **Read-only Enforcement**: Rejects INSERT, UPDATE, DELETE, CREATE, ALTER, DROP
-   **Schema Validation**: Validates table existence before execution
-   **SQL Injection Protection**: Uses parameterized queries
-   **Connection Security**: Supports SSL connections

## Performance

-   **Connection Pooling**: Efficient database connection management
-   **Query Optimization**: Monitors execution times
-   **Memory Management**: Handles large result sets efficiently
-   **Error Recovery**: Graceful handling of connection failures

## Troubleshooting

### Common Issues

1. **Database Connection Failed**: Check environment variables and network connectivity
2. **No Queries Extracted**: Verify input format matches expected JSON structure
3. **Permission Denied**: Ensure database user has SELECT permissions
4. **Table Not Found**: Verify schema validation or table existence

### Debug Mode

Enable detailed logging by setting `DEBUG=true` in environment variables.

## Contributing

When modifying the extraction rules or execution logic:

1. Update the corresponding test cases in `test_integration.py`
2. Verify the system message reflects any changes
3. Test with various SQL patterns and edge cases
4. Ensure backward compatibility with existing n8n workflows
