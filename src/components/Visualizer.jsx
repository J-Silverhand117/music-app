import { useEffect, useRef } from 'react';

// Minimal Nothing-style dot-matrix spectrum: columns of tiny white dots that
// light up with the music. Renders a dim idle grid when paused/unsupported.
const COLS = 27;
const ROWS = 5;

export default function Visualizer({ getAnalyser, active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = active ? getAnalyser() : null;
    const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const levels = new Float32Array(COLS); // smoothed 0..1 per column
    let raf = 0;
    let last = 0;

    const draw = now => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return; // ~30fps is plenty for dots
      last = now;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (analyser && active) {
        analyser.getByteFrequencyData(bins);
        // map columns onto the lower ~70% of the spectrum, slightly log-spaced
        const usable = Math.floor(bins.length * 0.7);
        for (let c = 0; c < COLS; c++) {
          const t0 = Math.pow(c / COLS, 1.35);
          const t1 = Math.pow((c + 1) / COLS, 1.35);
          const b0 = Math.floor(t0 * usable);
          const b1 = Math.max(b0 + 1, Math.floor(t1 * usable));
          let sum = 0;
          for (let b = b0; b < b1; b++) sum += bins[b];
          const v = sum / (b1 - b0) / 255;
          levels[c] = Math.max(v, levels[c] * 0.82); // quick attack, soft decay
        }
      } else {
        for (let c = 0; c < COLS; c++) levels[c] *= 0.9; // fade out when paused
      }

      const cellW = w / COLS;
      const cellH = h / ROWS;
      const r = Math.min(cellW, cellH) * 0.22;
      for (let c = 0; c < COLS; c++) {
        const lit = Math.min(ROWS, Math.round(levels[c] * ROWS * 1.25));
        for (let row = 0; row < ROWS; row++) {
          const on = row < lit; // row 0 = bottom
          const x = (c + 0.5) * cellW;
          const y = h - (row + 0.5) * cellH;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = on
            ? row === lit - 1
              ? 'rgba(255,255,255,0.95)' // peak dot brightest
              : 'rgba(255,255,255,0.6)'
            : 'rgba(255,255,255,0.07)';
          ctx.fill();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, getAnalyser]);

  return <canvas className="np-viz" ref={canvasRef} aria-hidden="true" />;
}
