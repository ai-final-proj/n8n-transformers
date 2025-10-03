// n8n Code node (Run Once for All Items)
// Builds a BEGIN_SQL…END_SQL skeleton based on upstream normalizedPrompt lines.

const src =
  $items('Edit Fields1', 0, 0)[0]?.json?.normalizedPrompt ??
  $input.first()?.json?.normalizedPrompt ??
  '';

const lines = Array.isArray(src)
  ? src
  : (typeof src === 'string'
      ? src.split(/\n+/).map(s => String(s).trim()).filter(Boolean)
      : []);

const count = lines.length;

let sqlSkeleton;

if (!count) {
  sqlSkeleton = 'BEGIN_SQL\nSELECT jsonb_build_object() AS dbResponse, jsonb_build_object() AS summary\nEND_SQL';
} else {
  const ctes = [];
  const dbResp = [];
  const summary = [];

  for (let i = 1; i <= count; i++) {
    ctes.push(`  item_${i} AS (\n    /* SELECT for item_${i} goes here */\n  )`);
    dbResp.push(`    'item_${i}', COALESCE((SELECT jsonb_agg(row_to_json(i${i})) FROM item_${i} i${i}), '[]'::jsonb)`);
    summary.push(`    'item_${i}', jsonb_build_object('row_count', (SELECT COUNT(*) FROM item_${i}))`);
  }

  sqlSkeleton = [
    'BEGIN_SQL',
    'WITH',
    ctes.join(',\n'),
    'SELECT',
    '  jsonb_build_object(',
    dbResp.join(',\n'),
    '  ) AS dbResponse,',
    '  jsonb_build_object(',
    summary.join(',\n'),
    '  ) AS summary',
    'END_SQL',
  ].join('\n');
}

return [{ json: { sqlSkeleton } }];

