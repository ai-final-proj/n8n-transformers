# AI Agent Tool – Code Executor

**Description for LLM use**
Execute read-only PostgreSQL workloads on behalf of the user. Provide the incoming prompt verbatim in `Prompt__User_Message_`, add a short `Description` of the task, and the tool will validate, extract, and run the SQL using the configured helper functions. The response includes `dbResponse`, which must be relayed to the user without alteration.

Inputs expected by the tool
- `Prompt__User_Message_`: Raw user message, unmodified. Required.
- `Description`: One concise sentence describing the execution request. Required.
- `System_Message` or other internal fields: leave as provided by the workflow unless explicitly instructed to change them.

Outputs
- `dbResponse`: Structured execution report covering summaries, per-query results, and any errors. Relay this payload exactly to the user.
