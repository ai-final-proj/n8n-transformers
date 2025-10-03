# Fixing "Cannot find module 'pg'" Error

## The Problem

The `pg` (PostgreSQL client) module is not installed in your n8n environment by default.

## ✅ Solution 1: Install pg as n8n Dependency (RECOMMENDED)

I've already added `pg` to your n8n nodes package.json and installed it. Now restart n8n:

```bash
# Restart n8n to pick up the new dependency
docker-compose restart n8n

# Or if using docker directly:
docker restart n8n-transformers_n8n_1
```

**Verification:**

-   Your Function node should now work with `const { Client } = require('pg');`
-   The pg module is installed in `n8n_data/nodes/node_modules/pg/`

## 🔄 Solution 2: Use n8n PostgreSQL Node

Instead of Function nodes, use n8n's built-in PostgreSQL node:

1. Add a **PostgreSQL** node to your workflow
2. Configure connection:
    - Host: `host.docker.internal`
    - Port: `5432`
    - Database: `scheduler`
    - User: `postgres`
    - Password: `postgres`
3. Select operation type and enter your query

**Pros:** No dependency issues, built-in error handling
**Cons:** One query per node (use multiple nodes or loop)

## 🌐 Solution 3: External API Approach

Use HTTP Request nodes to call a separate API that handles PostgreSQL:

### Step 1: Run the API Server

```bash
# Install Flask if needed
pip install flask psycopg2-binary

# Run the API server
python simple_postgres_api.py
```

### Step 2: Update Docker Compose (optional)

Add to `docker-compose.yml`:

```yaml
services:
    postgres-api:
        build: .
        ports:
            - '5000:5000'
        command: python simple_postgres_api.py
        depends_on:
            - postgres
```

### Step 3: Use HTTP Request Node in n8n

-   Method: POST
-   URL: `http://host.docker.internal:5000/execute-query`
-   Body:

```json
{
	"query": "SELECT * FROM your_table",
	"params": []
}
```

## 📊 Comparison

| Solution      | Setup Time | Complexity | Performance | Scalability |
| ------------- | ---------- | ---------- | ----------- | ----------- |
| Install pg    | 5 min      | Low        | Best        | High        |
| Built-in Node | 2 min      | Low        | Good        | Medium      |
| External API  | 15 min     | Medium     | Good        | High        |

## 🔧 Troubleshooting

### Still getting "Cannot find module 'pg'"?

1. Verify n8n container restarted: `docker-compose ps`
2. Check logs: `docker-compose logs n8n`
3. Verify pg installation: `ls n8n_data/nodes/node_modules/pg`

### Connection Issues?

-   Ensure PostgreSQL is running: `docker-compose ps`
-   Test connection manually in container:

```bash
docker exec -it n8n-transformers_n8n_1 bash
npm list pg  # Should show pg@8.11.3
```

### Permission Issues?

-   The n8n container might need file permissions:

```bash
chmod -R 755 n8n_data/nodes/
```

## 🎯 Recommendation

**Use Solution 1 (install pg)** - it's the most straightforward and gives you full control over database operations in Function nodes.

Your existing `execute_multiple_queries.js` will work perfectly once n8n is restarted! 🚀

