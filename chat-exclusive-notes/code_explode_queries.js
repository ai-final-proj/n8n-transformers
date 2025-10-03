// n8n Code node (Run Once for All Items)
// Input: one item with fields like query1, query2, query3 ... (possibly containing prose, fences, or comments)
// Output: one item per read-only SELECT/WITH with fields { index, name, query, params }

const first = $input.first() || { json: {} };
const src = first.json || {};

function getNumericSuffix(k) {
  const m = /^query(\d+)$/i.exec(k);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

function stripFences(s) {
  const text = String(s || '');
  const m = text.match(/```\s*(?:sql)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : text;
}

function extractFirstSelect(s) {
  const text = stripFences(s);
  // Remove leading single-line comments
  const lines = text.split(/\n/);
  const cleaned = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^\s*--/.test(L)) continue;
    cleaned.push(L);
  }
  const body = cleaned.join('\n').trim();
  const idx = body.search(/\bselect\b/i);
  if (idx === -1) return '';
  return body.slice(idx).replace(/;\s*$/, '').trim();
}

function isReadOnly(sql) {
  const t = String(sql || '').trim();
  if (!t) return false;
  if (/^\s*(insert|update|delete|create|alter|drop|truncate)\b/i.test(t)) return false;
  return /^\s*(with|select)\b/i.test(t);
}

// Collect keys query1, query2, ... in numeric order
const keys = Object.keys(src)
  .filter(k => /^query\d+$/i.test(k))
  .sort((a, b) => getNumericSuffix(a) - getNumericSuffix(b));

// Build output items
const out = [];
let includeIndex = 0;

for (let k of keys) {
  const raw = src[k];
  const sql = extractFirstSelect(raw);
  if (!sql) continue;
  if (!isReadOnly(sql)) continue;

  out.push({
    json: {
      index: includeIndex,
      name: 'item' + (includeIndex + 1),
      query: sql,
      params: [],
    },
  });

  includeIndex += 1;
}

if (out.length === 0) {
  return [{ json: { queries: [], note: 'No read-only SELECT/WITH found in input' } }];
}

return out;
