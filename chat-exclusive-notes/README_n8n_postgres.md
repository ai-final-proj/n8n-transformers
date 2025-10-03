# N8N PostgreSQL Function Node Examples

This directory contains Node.js functions that can be used in n8n Function nodes to interact with your PostgreSQL database.

## Database Configuration

Based on your `docker-compose.yml` and `pgadmin_postgres.yml`, the database connection details are:

-   **Host**: `host.docker.internal` (when running n8n in Docker)
-   **Port**: `5432`
-   **Database**: `scheduler`
-   **User**: `postgres`
-   **Password**: `postgres`

## Files Overview

### `execute_multiple_queries.js`

A comprehensive function that executes multiple SQL queries from an array and returns full results for each query, including error handling.

### `get_db_schema.js`

Retrieves the complete database schema including tables, columns, indexes, primary keys, and foreign keys.

### `n8n_postgres_examples.js`

Contains ready-to-copy code snippets for common n8n Function node operations.

## How to Use in n8n

### Step 1: Create a Function Node

1. In your n8n workflow, add a new **Function** node
2. Set the **Mode** to "Run Once for All Items" or "Run Once for Each Item" as needed
3. Copy the appropriate code from the files above into the **Function** field

### Step 2: Configure Input Data

Connect your Function node to a node that provides the necessary input data.

### Step 3: Handle Output

The Function node will output JSON data that can be processed by subsequent nodes.

## Example Usage

### Execute Multiple Queries

**Input Data Structure:**

```json
{
	"queries": [
		{
			"query": "SELECT * FROM users LIMIT 5",
			"params": []
		},
		{
			"query": "SELECT COUNT(*) as total_users FROM users",
			"params": []
		},
		{
			"query": "SELECT * FROM orders WHERE status = $1",
			"params": ["completed"]
		}
	]
}
```

**Function Node Code:**

```javascript
// Copy from execute_multiple_queries.js
```

**Output:**

```json
[
  {
    "queryIndex": 0,
    "query": "SELECT * FROM users LIMIT 5",
    "success": true,
    "rowCount": 5,
    "rows": [...],
    "fields": [...],
    "command": "SELECT"
  },
  {
    "queryIndex": 1,
    "query": "SELECT COUNT(*) as total_users FROM users",
    "success": true,
    "rowCount": 1,
    "rows": [{"total_users": 100}],
    ...
  }
]
```

### Get Database Schema

**Input:** No special input required (can be triggered by any data)

**Function Node Code:**

```javascript
// Copy from get_db_schema.js
```

**Output:**

```json
{
  "success": true,
  "schema": {
    "users": {
      "columns": [
        {"name": "id", "type": "integer", "nullable": false, ...},
        {"name": "name", "type": "varchar", ...}
      ],
      "indexes": [...],
      "primaryKeys": ["id"],
      "foreignKeys": [...]
    },
    "orders": {
      ...
    }
  },
  "tableCount": 5,
  "tables": ["users", "orders", "products", ...]
}
```

## Error Handling

All functions include comprehensive error handling:

-   **Connection errors**: When the database cannot be reached
-   **Query errors**: When individual SQL queries fail
-   **Syntax errors**: When the provided SQL is invalid

Errors are returned in the output JSON with detailed information including error codes, messages, and positions.

## Security Notes

-   These examples use hardcoded credentials for simplicity
-   In production, consider using n8n's credential system or environment variables
-   The `pg` library is automatically available in n8n Function nodes
-   All database connections are properly closed after use

## Troubleshooting

1. **Connection refused**: Make sure PostgreSQL is running and accessible from the n8n container
2. **Host not found**: Use `host.docker.internal` when n8n runs in Docker, or `localhost` when running locally
3. **Authentication failed**: Verify username/password match your database configuration
4. **Table not found**: Ensure you're querying the correct database (`scheduler` in your case)

## Integration with Existing Workflow

These functions work well with your existing `code_explode_queries.js` and `code_aggregate_postgres.js` nodes:

1. Use `code_explode_queries.js` to prepare queries
2. Execute them with `execute_multiple_queries.js`
3. Aggregate results with `code_aggregate_postgres.js`

