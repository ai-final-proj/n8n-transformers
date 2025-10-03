// n8n Code node (Run Once for All Items)
// Aggregates Postgres node output rows back to the originating query using pairedItem lineage.
// IMPORTANT: replace 'Explode Queries' below with the exact name of your explode node.

const SOURCE_NODE = 'Explode Queries';

const rows = $input.all();

function originOf(item) {
  const p = item.pairedItem;
  const ref = Array.isArray(p) ? p[0] : p;
  const originIdx = (ref && typeof ref.item === 'number') ? ref.item : 0;
  const meta = $items(SOURCE_NODE, 0, 0)[originIdx]?.json || {};
  return meta;
}

const grouped = {}; // key: "0" -> { name, query, rows: [] }
const errors = [];

for (const r of rows) {
  if (r.json && r.json.error) {
    const meta = originOf(r);
    errors.push({ index: meta.index, name: meta.name, error: r.json.error });
    continue;
  }
  const meta = originOf(r);
  const key = String(meta.index);
  if (!grouped[key]) grouped[key] = { name: meta.name, query: meta.query, rows: [] };
  grouped[key].rows.push(r.json);
}

const summary = [];
for (const key of Object.keys(grouped).sort((a,b)=>Number(a)-Number(b))) {
  const g = grouped[key];
  const rowCount = g.rows.length;
  const columns = rowCount ? Object.keys(g.rows[0]) : [];
  summary.push({ index: Number(key), name: g.name, rowCount, columns });
}

return [{ json: { dbResponse: grouped, summary, errors } }];

