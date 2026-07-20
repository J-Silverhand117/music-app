// Media-type helpers plus browser-based probes: duration via a temp <audio>,
// video thumbnail + dimensions via a temp <video> and canvas capture.

export const AUDIO_RE = /\.(flac|mp3|m4a|aac|ogg|opus|wav)$/i;
export const VIDEO_RE = /\.(mp4|m4v|webm|mov)$/i;

const MIME_BY_EXT = {
  flac: 'audio/flac', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/mp4', webm: 'video/webm'
};

export function mimeFor(fileName, fallback = 'application/octet-stream') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return MIME_BY_EXT[ext] || fallback;
}

// Duration for formats whose tags don't carry it (mp3/ogg/wav/aac):
// let the browser's decoder report it.
export function probeDuration(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('audio');
    a.preload = 'metadata';
    let done = false;
    const finish = d => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      a.removeAttribute('src');
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    a.onloadedmetadata = () => finish(a.duration);
    a.onerror = () => finish(0);
    setTimeout(() => finish(0), 8000);
    a.src = url;
  });
}

// Grabs a frame ~25% in as a jpeg thumbnail; also reports duration/dimensions.
export function probeVideo(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    v.playsInline = true;
    let done = false;
    const finish = out => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      resolve(out);
    };
    const fallback = { thumb: null, duration: 0, width: 0, height: 0 };
    v.onloadedmetadata = () => {
      fallback.duration = Number.isFinite(v.duration) ? v.duration : 0;
      fallback.width = v.videoWidth;
      fallback.height = v.videoHeight;
      try {
        v.currentTime = Math.min((v.duration || 4) * 0.25, 30);
      } catch {
        finish(fallback);
      }
    };
    v.onseeked = () => {
      try {
        const w = 480;
        const h = Math.round((w * v.videoHeight) / v.videoWidth) || 270;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(v, 0, 0, w, h);
        c.toBlob(b => finish({ ...fallback, thumb: b }), 'image/jpeg', 0.75);
      } catch {
        finish(fallback);
      }
    };
    v.onerror = () => finish(fallback);
    setTimeout(() => finish(fallback), 12000);
    v.src = url;
  });
}
