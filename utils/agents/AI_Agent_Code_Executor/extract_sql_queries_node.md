# extract_sql_queries — Node Notes

Purpose: Normalize SQL pulled from raw n8n items into a clean `extracted_queries` list that the executor tool can run.

Inputs:
- `input_items`: the full `$input.all()` array, where each item exposes its payload under `json`.

Outputs:
- `extracted_queries`: array of objects with `query` and optional `params`, preserving the order in which queries were found.

Usage tips:
- Supports `json.queries[]`, `json.data.{key}`, and `json.queryX` patterns without additional setup.
- The agent should call this tool before every execution request to avoid manual SQL parsing.
