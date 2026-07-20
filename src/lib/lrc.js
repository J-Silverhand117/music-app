// Minimal .lrc (synced lyrics) parser.
// Supports multiple timestamps per line, [offset:±ms], and 1-3 digit fractions.
// Returns sorted [{ t: seconds, text }].
export function parseLRC(text) {
  const out = [];
  let offset = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const off = raw.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i);
    if (off) {
      offset = parseInt(off[1], 10) / 1000;
      continue;
    }
    const times = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (!times.length) continue;
    const line = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!line) continue;
    for (const m of times) {
      const frac = m[3] ? parseInt((m[3] + '00').slice(0, 3), 10) / 1000 : 0;
      const t = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac - offset;
      if (Number.isFinite(t) && t >= 0) out.push({ t, text: line });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
