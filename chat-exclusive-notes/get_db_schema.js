// n8n Function Node - Get PostgreSQL Database Schema
// Returns the complete database schema including tables, columns, and indexes

const { Client } = require('pg');

async function getDatabaseSchema() {
  const client = new Client({
    host: 'host.docker.internal',
    port: 5432,
    database: 'scheduler',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database for schema retrieval');

    // Get all tables in the public schema
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const tablesResult = await client.query(tablesQuery);
    const tables = tablesResult.rows;

    const schema = {};

    // For each table, get columns and indexes
    for (const tableRow of tables) {
      const tableName = tableRow.table_name;
      schema[tableName] = {};

      // Get columns
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      const columnsResult = await client.query(columnsQuery, [tableName]);
      schema[tableName].columns = columnsResult.rows.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
        maxLength: col.character_maximum_length
      }));

      // Get indexes
      const indexesQuery = `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1 AND schemaname = 'public'
      `;

      const indexesResult = await client.query(indexesQuery, [tableName]);
      schema[tableName].indexes = indexesResult.rows.map(idx => ({
        name: idx.indexname,
        definition: idx.indexdef
      }));

      // Get primary keys
      const pkQuery = `
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary
      `;

      const pkResult = await client.query(pkQuery, [tableName]);
      schema[tableName].primaryKeys = pkResult.rows.map(row => row.column_name);

      // Get foreign keys
      const fkQuery = `
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND tc.table_schema = 'public'
      `;

      const fkResult = await client.query(fkQuery, [tableName]);
      schema[tableName].foreignKeys = fkResult.rows;
    }

    return {
      success: true,
      schema: schema,
      tableCount: tables.length,
      tables: tables.map(t => t.table_name)
    };

  } catch (error) {
    console.error('Error retrieving database schema:', error);
    return {
      success: false,
      error: error.message,
      details: error
    };
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// Main function for n8n
return (async () => {
  return [{ json: await getDatabaseSchema() }];
})();

