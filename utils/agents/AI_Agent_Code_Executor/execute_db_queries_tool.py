"""n8n Code node that executes SQL queries against PostgreSQL."""
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Dict, List

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

def generate_query_summary(result: Dict[str, Any]) -> str:
    """Generate a concise summary of query results."""
    if not result["success"]:
        return f"Query failed: {result['error']['message']}"
    
    row_count = result["rowCount"]
    execution_time = result["executionTimeMs"]
    
    if row_count == 0:
        return f"No rows returned (executed in {execution_time}ms)"
    
    columns = result.get("columns", [])
    if columns:
        column_info = f" with columns: {', '.join(columns[:3])}"
        if len(columns) > 3:
            column_info += f" and {len(columns) - 3} more"
    else:
        column_info = ""
    
    return f"Returned {row_count} rows{column_info} (executed in {execution_time}ms)"

def execute_multiple_queries(queries: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    """Executes a list of SQL queries and returns structured metadata with summaries."""
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
                result = {
                    "queryIndex": index,
                    "query_used": query,
                    "params": params,
                    "success": False,
                    "error": {"message": "Missing SQL statement for this item."},
                    "executionTimeMs": 0,
                }
                result["summary"] = generate_query_summary(result)
                meta["results"].append(result)
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
                result = {
                    "queryIndex": index,
                    "query_used": query,
                    "params": params,
                    "success": True,
                    "rowCount": cursor.rowcount,
                    "rows": rows,
                    "fields": fields,
                    "columns": column_names,
                    "command": getattr(cursor, "statusmessage", None),
                    "executionTimeMs": int((time.time() - started) * 1000),
                }
                result["summary"] = generate_query_summary(result)
                meta["results"].append(result)
            except Exception as error:
                connection.rollback()
                result = {
                    "queryIndex": index,
                    "query_used": query,
                    "params": params,
                    "success": False,
                    "error": {"message": str(error)},
                    "executionTimeMs": int((time.time() - started) * 1000),
                }
                result["summary"] = generate_query_summary(result)
                meta["results"].append(result)

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

def main(input_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Entry point invoked by n8n when the AI agent requests execution."""
    tool_args = input_data[0].get("json", {})
    queries_to_run = tool_args.get("queries_to_execute")

    if not queries_to_run:
        return [{"json": {"error": "Missing 'queries_to_execute' for database execution."}}]

    execution_results = execute_multiple_queries(queries_to_run, DB_CONFIG)
    return [{"json": execution_results}]
