"""n8n Code node that extracts SQL SELECT statements using strict JSON-emitter mode rules."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

def numeric_order(key: str) -> int:
    digits = "".join(ch for ch in str(key) if ch.isdigit())
    return int(digits) if digits else 10**6

def strip_sql_comments(sql: str) -> str:
    """Remove SQL comments from the query."""
    # Remove /* */ block comments
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
    # Remove -- line comments
    sql = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
    return sql

def is_read_only_query(sql: str) -> bool:
    """Check if the SQL query is read-only (SELECT or WITH...SELECT)."""
    sql_clean = strip_sql_comments(sql).strip().upper()
    
    # Check for data-changing keywords outside quoted strings
    forbidden_keywords = [
        'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CREATE', 'ALTER', 'DROP', 
        'TRUNCATE', 'GRANT', 'REVOKE', 'COMMENT', 'COPY'
    ]
    
    # Simple check for quoted strings and forbidden keywords
    # This is a basic implementation - for production, use a proper SQL parser
    for keyword in forbidden_keywords:
        if keyword in sql_clean:
            return False
    
    # Check for "SELECT ... INTO" pattern
    if 'SELECT' in sql_clean and 'INTO' in sql_clean:
        return False
    
    # Must start with SELECT or WITH
    return sql_clean.startswith(('SELECT', 'WITH'))

def extract_from_fenced_sql(text: str) -> Optional[str]:
    """Extract SQL from fenced code blocks with sql language tag."""
    pattern = r'```sql\s*\n(.*?)\n```'
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if match:
        sql = match.group(1).strip()
        if sql.endswith(';'):
            sql = sql[:-1]
        return sql
    return None

def extract_from_inline_sql(text: str) -> Optional[str]:
    """Extract SQL from single-backtick inline snippets."""
    pattern = r'`([^`]+)`'
    match = re.search(pattern, text)
    if match:
        sql = match.group(1).strip()
        if sql.endswith(';'):
            sql = sql[:-1]
        return sql
    return None

def extract_from_statement_scan(text: str) -> Optional[str]:
    """Extract SQL using statement scan (WITH...SELECT or SELECT)."""
    text_clean = text.strip()
    
    # Check for WITH...SELECT pattern
    if text_clean.upper().startswith('WITH'):
        # Find the end of the statement (first semicolon not in quotes)
        # This is a simplified approach - for production, use proper SQL parsing
        end_pos = text_clean.find(';')
        if end_pos != -1:
            sql = text_clean[:end_pos].strip()
            if sql.endswith(';'):
                sql = sql[:-1]
            return sql
        return text_clean
    
    # Check for SELECT pattern
    select_pos = text_clean.upper().find('SELECT')
    if select_pos != -1:
        sql = text_clean[select_pos:].strip()
        end_pos = sql.find(';')
        if end_pos != -1:
            sql = sql[:end_pos].strip()
        if sql.endswith(';'):
            sql = sql[:-1]
        return sql
    
    return None

def apply_identifier_correction(sql: str) -> str:
    """Apply the only allowed identifier correction: public.user -> public."user"."""
    return sql.replace('public.user', 'public."user"')

def extract_sql_from_text(text: str) -> Optional[str]:
    """Extract SQL from text using strict precedence rules."""
    if not isinstance(text, str) or not text.strip():
        return None
    
    # Precedence 1: Fenced SQL with language tag
    sql = extract_from_fenced_sql(text)
    if sql and is_read_only_query(sql):
        return apply_identifier_correction(sql)
    
    # Precedence 2: Single-backtick inline SQL
    sql = extract_from_inline_sql(text)
    if sql and is_read_only_query(sql):
        return apply_identifier_correction(sql)
    
    # Precedence 3: Statement scan
    sql = extract_from_statement_scan(text)
    if sql and is_read_only_query(sql):
        return apply_identifier_correction(sql)
    
    return None

def validate_schema_tables(sql: str, schema_text: Optional[str]) -> bool:
    """Validate that referenced tables exist in the schema."""
    if not schema_text:
        return True
    
    # Extract table names from FROM and JOIN clauses
    # This is a simplified approach - for production, use proper SQL parsing
    table_pattern = r'(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_.]*)'
    matches = re.findall(table_pattern, sql, re.IGNORECASE)
    
    # Check if tables exist in schema
    for table in matches:
        if table not in schema_text:
            return False
    
    return True

def extract_queries_strict(input_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extracts SQL queries using strict JSON-emitter mode rules."""
    collected: List[Dict[str, Any]] = []
    
    for item in input_items:
        payload = item.get("json", {}) if isinstance(item, dict) else {}
        
        # Look for "response" array first (primary input format)
        response_array = payload.get("response")
        if isinstance(response_array, list):
            schema_text = payload.get("schema")
            for text in response_array:
                sql = extract_sql_from_text(text)
                if sql and validate_schema_tables(sql, schema_text):
                    collected.append({
                        "query": sql,
                        "params": []
                    })
            continue
        
        # Fallback to legacy formats for backward compatibility
        queries_array = payload.get("queries")
        if isinstance(queries_array, list):
            for entry in queries_array:
                text = (entry or {}).get("query", "")
                sql = extract_sql_from_text(text)
                if sql:
                    collected.append({
                        "query": sql,
                        "params": entry.get("params", []),
                    })
            continue

        data_section = payload.get("data")
        if isinstance(data_section, dict):
            for key in sorted(data_section.keys(), key=numeric_order):
                entry = data_section.get(key) or {}
                text = entry.get("query", "")
                sql = extract_sql_from_text(text)
                if sql:
                    collected.append({
                        "query": sql,
                        "params": entry.get("params", []),
                    })
            continue

        query_keys = [key for key in payload.keys() if key.lower().startswith("query")]
        for key in sorted(query_keys, key=numeric_order):
            text = payload.get(key, "")
            sql = extract_sql_from_text(text)
            if sql:
                collected.append({"query": sql, "params": []})

    return collected

def main(input_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Entry point invoked by n8n when the AI agent calls this tool."""
    tool_args = input_data[0].get("json", {})
    input_items_for_extraction = tool_args.get("input_items")

    if not input_items_for_extraction:
        return [{"json": {"error": "Missing 'input_items' for query extraction."}}]

    extracted_queries = extract_queries_strict(input_items_for_extraction)
    return [{"json": {"extracted_queries": extracted_queries}}]
