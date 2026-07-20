import { memo } from 'react';

// Deterministic dot-matrix placeholder for albums without embedded art.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default memo(function Cover({ url, title = '', className = '' }) {
  if (url) {
    return (
      <div className={'cover-wrap ' + className}>
        <img className="cover" src={url} alt={title} loading="lazy" draggable="false" />
      </div>
    );
  }
  const rand = rng(hashStr(title || 'untitled'));
  const N = 7;
  const redI = Math.floor(rand() * N * N);
  const dots = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const on = rand() < 0.42;
      const shade = rand() < 0.3 ? '#3d3d3d' : '#262626';
      if (!on && i !== redI) continue;
      dots.push(
        <circle
          key={i}
          cx={16.1 + c * 11.3}
          cy={16.1 + r * 11.3}
          r={i === redI ? 3.2 : 2.5}
          fill={i === redI ? '#D71921' : shade}
        />
      );
    }
  }
  return (
    <div className={'cover-wrap ' + className}>
      <svg className="cover" viewBox="0 0 100 100" role="img" aria-label={title}>
        <rect width="100" height="100" fill="#0b0b0b" />
        {dots}
      </svg>
    </div>
  );
});
