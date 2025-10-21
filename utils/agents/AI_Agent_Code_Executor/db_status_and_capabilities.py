"""n8n Code node logic that publishes database status and tool definitions for the AI agent."""
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

# --- Database setup ---
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSICOPG2_AVAILABLE = True
except ImportError:  # pragma: no cover
    psycopg2 = None
    RealDictCursor = None
    PSICOPG2_AVAILABLE = False

DB_CONFIG: Dict[str, Any] = {
    "host": os.environ.get("POSTGRES_HOST", "host.docker.internal"),
    "port": int(os.environ.get("POSTGRES_PORT", "5432")),
    "database": os.environ.get("POSTGRES_DB", "scheduler"),
    "user": os.environ.get("POSTGRES_USER", "postgres"),
    "password": os.environ.get("POSTGRES_PASSWORD", "postgres"),
    "sslmode": os.environ.get("POSTGRES_SSLMODE", "prefer"),
}

def connect_to_db(config: Dict[str, Any]):
    """Establishes a connection to the PostgreSQL database."""
    if not PSICOPG2_AVAILABLE:
        raise ImportError("psycopg2 is required to connect to PostgreSQL.")
    connection = psycopg2.connect(
        host=config["host"],
        port=config["port"],
        dbname=config["database"],
        user=config["user"],
        password=config["password"],
        sslmode=config.get("sslmode", "prefer"),
    )
    connection.autocommit = False
    cursor_kwargs: Dict[str, Any] = {}
    if RealDictCursor:
        cursor_kwargs["cursor_factory"] = RealDictCursor
    cursor = connection.cursor(**cursor_kwargs)
    return connection, cursor

def numeric_order(key: str) -> int:
    digits = "".join(ch for ch in str(key) if ch.isdigit())
    return int(digits) if digits else 10**6

def extract_queries(input_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extracts SQL queries and their parameters from n8n input formats."""
    collected: List[Dict[str, Any]] = []

    for item in input_items:
        payload = item.get("json", {}) if isinstance(item, dict) else {}

        queries_array = payload.get("queries")
        if isinstance(queries_array, list):
            for entry in queries_array:
                text = (entry or {}).get("query", "")
                if isinstance(text, str) and text.strip():
                    collected.append({
                        "query": text,
                        "params": entry.get("params", []),
                    })
            continue

        data_section = payload.get("data")
        if isinstance(data_section, dict):
            for key in sorted(data_section.keys(), key=numeric_order):
                entry = data_section.get(key) or {}
                text = entry.get("query", "")
                if isinstance(text, str) and text.strip():
                    collected.append({
                        "query": text,
                        "params": entry.get("params", []),
                    })
            continue

        query_keys = [key for key in payload.keys() if key.lower().startswith("query")]
        for key in sorted(query_keys, key=numeric_order):
            text = payload.get(key, "")
            if isinstance(text, str) and text.strip():
                collected.append({"query": text, "params": []})

    return collected

def execute_multiple_queries(queries: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    """Executes the provided queries against PostgreSQL and returns metadata."""
    meta = {
        "summary": {
            "startedAt": datetime.utcnow().isoformat() + "Z",
            "totalQueries": len(queries),
        },
        "results": [],
    }

    connection = cursor = None
    try:
        connection, cursor = connect_to_db(config)

        for index, entry in enumerate(queries):
            query = (entry.get("query") or "").strip()
            params = entry.get("params") or []
            started = time.time()

            if not query:
                meta["results"].append({
                    "queryIndex": index,
                    "query": query,
                    "params": params,
                    "success": False,
                    "error": {"message": "Missing SQL statement for this item."},
                    "executionTimeMs": 0,
                })
                continue

            try:
                cursor.execute(query, params)
                rows: List[Dict[str, Any]] = []
                fields: List[Dict[str, Any]] = []

                if cursor.description:
                    raw_rows = cursor.fetchall()
                    if raw_rows and isinstance(raw_rows[0], dict):
                        rows = list(raw_rows)
                        column_names = list(raw_rows[0].keys())
                    else:
                        column_names = [
                            getattr(col, "name", col[0]) for col in cursor.description
                        ]
                        rows = [dict(zip(column_names, row)) for row in raw_rows]

                    fields = [
                        {
                            "name": getattr(col, "name", col[0]),
                            "typeCode": getattr(col, "type_code", col[1] if len(col) > 1 else None),
                        }
                        for col in cursor.description
                    ]
                else:
                    column_names = []

                connection.commit()
                meta["results"].append({
                    "queryIndex": index,
                    "query": query,
                    "params": params,
                    "success": True,
                    "rowCount": cursor.rowcount,
                    "rows": rows,
                    "fields": fields,
                    "columns": column_names,
                    "command": getattr(cursor, "statusmessage", None),
                    "executionTimeMs": int((time.time() - started) * 1000),
                })
            except Exception as error:
                connection.rollback()
                meta["results"].append({
                    "queryIndex": index,
                    "query": query,
                    "params": params,
                    "success": False,
                    "error": {"message": str(error)},
                    "executionTimeMs": int((time.time() - started) * 1000),
                })

        meta["summary"]["finishedAt"] = datetime.utcnow().isoformat() + "Z"
        meta["summary"]["hadErrors"] = any(not result["success"] for result in meta["results"])
        meta["summary"]["durationMs"] = (
            datetime.fromisoformat(meta["summary"]["finishedAt"][:-1]).timestamp()
            - datetime.fromisoformat(meta["summary"]["startedAt"][:-1]).timestamp()
        ) * 1000
        return meta

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

def main(input_data: List[Dict[str, Any]], config: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Publishes database capability metadata and tool schemas for the agent."""
    initialization_status: bool = False
    availability_status: bool = PSICOPG2_AVAILABLE
    error_message: Optional[str] = None

    if not PSICOPG2_AVAILABLE:
        error_message = "psycopg2 library is not available. Please install it in the n8n environment."
    else:
        try:
            connection, cursor = connect_to_db(config or DB_CONFIG)
            connection.close()
            initialization_status = True
        except Exception as exc:
            initialization_status = False
            error_message = f"Database connection failed with configuration: {exc}"

    tools_definitions: List[Dict[str, Any]] = []

    tools_definitions.append({
        "name": "extract_sql_queries",
        "description": (
            "Extracts SQL queries and parameters from raw n8n items. "
            "Supports arrays at `json.queries`, keyed maps under `json.data`, and `queryX` fields."),
        "parameters": {
            "type": "object",
            "properties": {
                "input_items": {
                    "type": "array",
                    "description": (
                        "Raw n8n items (typically `$input.all()`). Each item must expose its payload via `json`."),
                    "items": {
                        "type": "object",
                        "properties": {
                            "json": {
                                "type": "object",
                                "description": "The payload of an n8n item."
                            }
                        },
                        "required": ["json"],
                    },
                },
            },
            "required": ["input_items"],
        },
    })

    tools_definitions.append({
        "name": "execute_db_queries",
        "description": (
            "Runs read-only SQL queries against PostgreSQL and returns per-query results with a summary."),
        "parameters": {
            "type": "object",
            "properties": {
                "queries_to_execute": {
                    "type": "array",
                    "description": (
                        "List of query objects (usually from `extract_sql_queries`). "
                        "Each entry must provide a SQL string and optional parameters."),
                    "items": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "SQL statement to execute.",
                            },
                            "params": {
                                "type": "array",
                                "description": (
                                    "Optional parameters aligned with positional placeholders."),
                                "items": {
                                    "type": ["string", "number", "boolean", "null"],
                                },
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
            "required": ["queries_to_execute"],
        },
    })

    output_payload = {
        "status": {
            "psycopg2_available": availability_status,
            "db_connection_initialized": initialization_status,
            "error_detail": error_message,
        },
        "description_for_ai_agent": (
            "Reports PostgreSQL connector readiness and exposes tools to extract and execute queries. "
            "Always rely on these tools for database work."),
        "tools_for_ai_agent": tools_definitions,
        "example_agent_thought_process": (
            "If `db_connection_initialized` is true, first call `extract_sql_queries` with `$input.all()`. "
            "Then pass the resulting queries to `execute_db_queries` and summarize the response."),
    }

    return [{"json": output_payload}]

if __name__ == "__main__":
    from pprint import pprint

    print("--- Running main with empty sample input (status check) ---")
    sample_input_status_check = [{}]
    pprint(main(sample_input_status_check))

    print("\n--- Simulating psycopg2 not being available for status check ---")
    _original_psycopg2_available = globals().get("PSICOPG2_AVAILABLE")
    globals()["PSICOPG2_AVAILABLE"] = False
    pprint(main(sample_input_status_check))
    globals()["PSICOPG2_AVAILABLE"] = _original_psycopg2_available

    print("\n--- Running main with sample query input (for method understanding demonstration) ---")
    sample_input_for_queries = [{
        "json": {
            "data": {
                "item1": {"query": "SELECT NOW() AS current_timestamp"},
                "item2": {"query": "SELECT 'hello' AS greeting, 123 AS number"},
            }
        }
    }]
    pprint(main(sample_input_for_queries))
