# execute_db_queries — Node Notes

Purpose: Run the prepared SQL against PostgreSQL and report row data, counts, and errors in a structured format.

Inputs:
- `queries_to_execute`: list of objects (from `extract_sql_queries`) with `query` strings and optional `params` arrays.

Outputs:
- A JSON payload containing a `summary` (timestamps, totals, error flag) and detailed `results` per query.

Usage tips:
- The tool commits after each successful statement and rolls back on failures to isolate errors.
- Designed for read-only workloads; instruct the agent to decline non-SELECT requests or flag them as unsupported.
