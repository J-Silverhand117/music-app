export function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function fmtTotal(s) {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} MIN`;
  return `${Math.floor(m / 60)} HR ${m % 60} MIN`;
}
