// Compare count-labelled figures and data-defined item states without a vocabulary of inferred states.
export function checkConsistency(html, data) {
  if (!data || typeof data !== 'object' || !Object.keys(data).length) return { note: 'no data to check', mismatches: [] };
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ').replace(/\s+/g, ' ');
  const mismatches = [], counts = [], records = [];
  const visit = (v, key = '') => {
    if (typeof v === 'number') counts.push({ key: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase(), value: String(v) });
    else if (Array.isArray(v)) v.forEach((x) => visit(x, key));
    else if (v && typeof v === 'object') {
      if (typeof v.state === 'string' || typeof v.status === 'string') records.push(v);
      if (typeof v.count === 'number' && Array.isArray(v.items) && v.count !== v.items.length)
        mismatches.push(`source count ${v.count} does not sum to ${v.items.length} items`);
      Object.entries(v).forEach(([k, x]) => visit(x, k));
    }
  };
  visit(data);
  for (const { key, value } of counts) {
    if (!/(count|total|open|plan|landed|queued|waiting|stuck|ready|merge|lane)/.test(key)) continue;
    const label = key.split(' ').filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
    const after = new RegExp(`(?:${label})[^\\d]{0,12}(\\d+)`, 'i').exec(text);
    const before = after ? null : new RegExp(`(\\d+)[^\\d]{0,12}(?:${label})`, 'i').exec(text);
    const drawn = after?.[1] ?? before?.[1];
    if (drawn && drawn !== value) mismatches.push(`${key} count is ${drawn}; source says ${value}`);
  }
  const normalize = (s) => s.toLowerCase().replace(/[-_]+/g, ' ');
  for (const row of records) {
    const item = row.title ?? row.name ?? row.id ?? row.key;
    if (!item) continue;
    const sourceIndex = html.toLowerCase().indexOf(String(item).toLowerCase());
    if (sourceIndex < 0) continue;
    const before = html.slice(0, sourceIndex);
    const heads = [...before.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<[^>]*class=["'][^"']*\bsec-h\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)];
    const heading = (heads.at(-1)?.[1] ?? heads.at(-1)?.[2] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const expected = normalize(row.state ?? row.status);
    if (heading && !heading.includes(expected) && /\d/.test(heading))
      mismatches.push(`state for ${item} should be ${row.state ?? row.status} (drawn under ${heading})`);
  }
  return { note: 'checked', mismatches };
}
