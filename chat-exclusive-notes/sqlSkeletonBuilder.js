function buildSqlSkeletonFromLines(lines) {
  const arr = Array.isArray(lines)
    ? lines.map(function (s) { return String(s || '').trim(); }).filter(Boolean)
    : [];

  var count = arr.length;
  if (!count) {
    return 'BEGIN_SQL\nSELECT jsonb_build_object() AS dbResponse, jsonb_build_object() AS summary\nEND_SQL';
  }

  var ctes = [];
  var dbResp = [];
  var summary = [];

  for (var i = 1; i <= count; i++) {
    ctes.push('  item_' + i + ' AS (\n    /* SELECT for item_' + i + ' goes here */\n  )');
    dbResp.push("    'item_" + i + "', COALESCE((SELECT jsonb_agg(row_to_json(i" + i + ")) FROM item_" + i + ' i' + i + "), '[]'::jsonb)");
    summary.push("    'item_" + i + "', jsonb_build_object('row_count', (SELECT COUNT(*) FROM item_" + i + '))');
  }

  return [
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

function extractBeginSqlBlock(text) {
  var t = String(text == null ? '' : text);
  var m = t.match(/BEGIN_SQL\s*([\s\S]*?)\s*END_SQL/);
  return m ? m[1].trim() : '';
}

// Convenience: Return a proper n8n items array with the skeleton string.
function buildSqlSkeletonItems(lines) {
  var skeleton = buildSqlSkeletonFromLines(lines);
  return [{ json: { sqlSkeleton: skeleton } }];
}

// Convenience: explode an array (or string with newlines) to one n8n item per line.
function explodeLinesToItems(linesOrString) {
  var lines = Array.isArray(linesOrString)
    ? linesOrString
    : (typeof linesOrString === 'string'
        ? linesOrString.split(/\n+/)
        : []);
  var clean = lines.map(function (s) { return String(s || '').trim(); }).filter(Boolean);
  return clean.map(function (text, idx) {
    return { json: { index: idx, name: 'item' + (idx + 1), goal: text } };
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    buildSqlSkeletonFromLines: buildSqlSkeletonFromLines,
    extractBeginSqlBlock: extractBeginSqlBlock,
    buildSqlSkeletonItems: buildSqlSkeletonItems,
    explodeLinesToItems: explodeLinesToItems,
  };
}
