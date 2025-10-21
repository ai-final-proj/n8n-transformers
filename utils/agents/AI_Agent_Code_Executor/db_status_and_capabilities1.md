# db_status_and_capabilities1 — Node Notes

Purpose: Probe PostgreSQL availability, emit connection status, and publish the tool schemas that the AI agent must use (`extract_sql_queries`, `execute_db_queries`).

Key outputs:
- `status.psycopg2_available` and `status.db_connection_initialized` indicate whether database tooling is ready.
- `tools_for_ai_agent` lists the tool contracts the agent can call later in the workflow.

Usage tips:
- Place this node ahead of the agent so it always has fresh status information.
- If initialization fails, the agent should surface `status.error_detail` instead of attempting tool calls.
