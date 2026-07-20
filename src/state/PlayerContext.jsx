import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAudio, getPref, setPref } from '../lib/db';
import { mimeFor } from '../lib/media';
import { useLibrary } from './LibraryContext';

const Ctx = createContext(null);
export const usePlayer = () => useContext(Ctx);

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PlayerProvider({ children }) {
  const { trackMap, coverUrls, ready } = useLibrary();
  const audioRef = useRef(null);
  if (!audioRef.current) {
    const a = new Audio();
    a.preload = 'auto';
    audioRef.current = a;
  }

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // off | all | one

  const refs = useRef({});
  refs.current = { queue, index, playing, shuffle, repeat, trackMap };
  const originalRef = useRef([]); // pre-shuffle order
  const urlRef = useRef(null);
  const preloadRef = useRef(null); // { id, url } — next track, ready to swap in
  const lastSaveRef = useRef(0);
  const lastPosSyncRef = useRef(0);
  const fnRef = useRef({});

  const load = useCallback(async (id, { autoplay = true, startAt = 0 } = {}) => {
    let blob;
    try { blob = await getAudio(id); } catch { blob = null; }
    if (!blob) return false;
    if (!blob.type) {
      const t = refs.current.trackMap[id];
      blob = new Blob([blob], { type: mimeFor(t?.fileName || '', 'audio/flac') });
    }
    const a = audioRef.current;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    a.src = urlRef.current;
    if (startAt > 0) {
      const seekOnce = () => {
        a.currentTime = startAt;
        a.removeEventListener('loadedmetadata', seekOnce);
      };
      a.addEventListener('loadedmetadata', seekOnce);
    }
    setPosition(startAt);
    setDuration(0);
    if (autoplay) a.play().catch(() => {});
    return true;
  }, []);

  // Pre-decode the upcoming track into an object URL so the switch at song
  // end is synchronous. Without this, the async IndexedDB fetch leaves a
  // silent gap in which Android freezes a backgrounded page — which is what
  // kills both auto-advance and the media notification.
  const preloadNext = useCallback(async () => {
    const { queue: q, index: i, repeat } = refs.current;
    let nextId = null;
    if (q.length) {
      if (i + 1 < q.length) nextId = q[i + 1];
      else if (repeat === 'all') nextId = q[0];
    }
    if (preloadRef.current?.id === nextId) return;
    if (preloadRef.current) {
      URL.revokeObjectURL(preloadRef.current.url);
      preloadRef.current = null;
    }
    if (!nextId) return;
    try {
      let blob = await getAudio(nextId);
      if (!blob) return;
      if (!blob.type) {
        const t = refs.current.trackMap[nextId];
        blob = new Blob([blob], { type: mimeFor(t?.fileName || '', 'audio/flac') });
      }
      preloadRef.current = { id: nextId, url: URL.createObjectURL(blob) };
    } catch { /* best effort */ }
  }, []);

  useEffect(() => {
    preloadNext();
  }, [queue, index, repeat, preloadNext]);

  // jump to queue position; skips over tracks whose audio is missing
  const jump = useCallback(async (i, opts) => {
    const q = refs.current.queue;
    for (let k = 0; k < q.length; k++) {
      const j = i + k;
      if (j >= q.length) break;
      if (await load(q[j], opts)) {
        setIndex(j);
        setPref('lastQueue', { ids: q, index: j });
        return true;
      }
    }
    return false;
  }, [load]);

  const playTracks = useCallback((ids, start = 0) => {
    if (!ids.length) return;
    let q = ids.slice();
    originalRef.current = ids.slice();
    if (refs.current.shuffle) {
      const [first] = q.splice(start, 1);
      q = [first, ...shuffleArr(q)];
      start = 0;
    }
    setQueue(q);
    refs.current.queue = q;
    jump(start);
  }, [jump]);

  const playShuffled = useCallback(ids => {
    if (!ids.length) return;
    setShuffle(true);
    setPref('shuffle', true);
    refs.current.shuffle = true;
    playTracks(ids, Math.floor(Math.random() * ids.length));
  }, [playTracks]);

  const playNext = useCallback(ids => {
    const { queue: q, index: i } = refs.current;
    if (!q.length) return playTracks(ids);
    const copy = q.slice();
    copy.splice(i + 1, 0, ...ids);
    setQueue(copy);
    const o = originalRef.current;
    originalRef.current = [...o, ...ids.filter(x => !o.includes(x))];
    setPref('lastQueue', { ids: copy, index: i });
  }, [playTracks]);

  const addToQueue = useCallback(ids => {
    const { queue: q, index: i } = refs.current;
    if (!q.length) return playTracks(ids);
    const copy = [...q, ...ids];
    setQueue(copy);
    const o = originalRef.current;
    originalRef.current = [...o, ...ids.filter(x => !o.includes(x))];
    setPref('lastQueue', { ids: copy, index: i });
  }, [playTracks]);

  const next = useCallback((fromEnded = false) => {
    const { queue: q, index: i, repeat: rp } = refs.current;
    if (!q.length) return;
    let ni = -1;
    if (i + 1 < q.length) ni = i + 1;
    else if (rp === 'all') ni = 0;
    if (ni === -1) {
      if (fromEnded) setPlaying(false);
      return;
    }
    // use the preloaded blob when available — synchronous swap, no silent
    // gap for Android to freeze the page in (notification next included)
    const pre = preloadRef.current;
    const a = audioRef.current;
    if (pre && pre.id === q[ni]) {
      preloadRef.current = null;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = pre.url;
      a.src = pre.url;
      a.play().catch(() => {});
      setIndex(ni);
      setPosition(0);
      setDuration(0);
      setPref('lastQueue', { ids: q, index: ni });
      window.__lastSwap = 'preload';
    } else {
      window.__lastSwap = 'fallback';
      jump(ni);
    }
  }, [jump]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    const { queue: q, index: i, repeat: rp } = refs.current;
    if (a.currentTime > 3 || (i <= 0 && rp !== 'all')) {
      a.currentTime = 0;
      return;
    }
    jump(i > 0 ? i - 1 : q.length - 1);
  }, [jump]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    const { queue: q, index: i, playing: pl } = refs.current;
    if (pl) return a.pause();
    if (a.src) return void a.play().catch(() => {});
    if (q.length) jump(i >= 0 ? i : 0);
  }, [jump]);

  const seek = useCallback(t => {
    const a = audioRef.current;
    a.currentTime = t;
    setPosition(t);
  }, []);

  const setVolume = useCallback(v => {
    setVolumeState(v);
    audioRef.current.volume = v;
    setPref('volume', v);
  }, []);

  const toggleShuffle = useCallback(() => {
    const { queue: q, index: i, shuffle: sh } = refs.current;
    if (!sh) {
      originalRef.current = originalRef.current.length ? originalRef.current : q.slice();
      if (q.length && i >= 0) {
        const cur = q[i];
        const rest = q.filter((_, j) => j !== i);
        const nq = [cur, ...shuffleArr(rest)];
        setQueue(nq);
        setIndex(0);
        setPref('lastQueue', { ids: nq, index: 0 });
      } else if (q.length) {
        const nq = shuffleArr(q);
        setQueue(nq);
        setPref('lastQueue', { ids: nq, index: i });
      }
      setShuffle(true);
      setPref('shuffle', true);
    } else {
      const inQ = new Set(q);
      let nq = originalRef.current.filter(id => inQ.has(id));
      for (const id of q) if (!nq.includes(id)) nq.push(id);
      const cur = i >= 0 ? q[i] : null;
      const ni = cur ? nq.indexOf(cur) : -1;
      setQueue(nq);
      setIndex(ni);
      setPref('lastQueue', { ids: nq, index: ni });
      setShuffle(false);
      setPref('shuffle', false);
    }
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat(r => {
      const nr = r === 'off' ? 'all' : r === 'all' ? 'one' : 'off';
      setPref('repeat', nr);
      return nr;
    });
  }, []);

  const jumpTo = useCallback(i => { jump(i); }, [jump]);

  // move a queue entry (used by the up/down buttons in the queue panel)
  const moveInQueue = useCallback((from, to) => {
    const { queue: q, index: i } = refs.current;
    if (from < 0 || from >= q.length || to < 0 || to >= q.length || from === to) return;
    const copy = q.slice();
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    let ni = i;
    if (from === i) ni = to;
    else if (from < i && to >= i) ni = i - 1;
    else if (from > i && to <= i) ni = i + 1;
    setQueue(copy);
    setIndex(ni);
    setPref('lastQueue', { ids: copy, index: ni });
  }, []);

  const removeFromQueue = useCallback(idx => {
    const { queue: q, index: i, playing: pl } = refs.current;
    if (idx < 0 || idx >= q.length) return;
    const copy = q.slice();
    copy.splice(idx, 1);
    const a = audioRef.current;
    if (!copy.length) {
      a.pause();
      a.removeAttribute('src');
      setQueue([]); setIndex(-1); setPlaying(false); setPosition(0); setDuration(0);
      setPref('lastQueue', { ids: [], index: -1 });
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      return;
    }
    if (idx === i) {
      // removed the playing track — advance to whatever is now in its slot
      setQueue(copy);
      refs.current.queue = copy;
      jump(Math.min(idx, copy.length - 1), { autoplay: pl });
    } else {
      const ni = idx < i ? i - 1 : i;
      setQueue(copy);
      setIndex(ni);
      setPref('lastQueue', { ids: copy, index: ni });
    }
  }, [jump]);

  // Sleep timer: pauses playback (with a short fade) when it expires.
  const [sleepAt, setSleepAt] = useState(null);
  const [, setSleepTick] = useState(0);
  useEffect(() => {
    if (!sleepAt) return;
    const iv = setInterval(() => {
      setSleepTick(t => t + 1); // re-render the countdown
      if (Date.now() < sleepAt) return;
      clearInterval(iv);
      setSleepAt(null);
      const a = audioRef.current;
      if (a.paused) return;
      const v0 = a.volume;
      let step = 0;
      const fade = setInterval(() => {
        step++;
        a.volume = Math.max(0, v0 * (1 - step / 15));
        if (step >= 15) {
          clearInterval(fade);
          a.pause();
          a.volume = v0;
        }
      }, 200);
    }, 1000);
    return () => clearInterval(iv);
  }, [sleepAt]);
  const setSleep = useCallback(minutes => {
    setSleepAt(minutes ? Date.now() + minutes * 60000 : null);
  }, []);
  useEffect(() => { window.__setSleep = setSleep; }, [setSleep]); // debugging hook
  const sleepRemaining = sleepAt ? Math.max(0, Math.round((sleepAt - Date.now()) / 1000)) : 0;

  // Passive analyser tap for the visualizer. This adds NO processing to the
  // audio (no gain, no EQ, no effects) — the signal passes through untouched,
  // so system-level EQ and USB DAC output behave exactly as before.
  const audioGraphRef = useRef(null);
  const getAnalyser = useCallback(() => {
    if (audioGraphRef.current) return audioGraphRef.current.analyser;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      audioGraphRef.current = { analyser: null };
      return null;
    }
    let ctx;
    try {
      ctx = new AC();
      const src = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      audioGraphRef.current = { ctx, src, analyser };
      window.__graph = audioGraphRef.current; // debugging hook
      if (refs.current.playing) ctx.resume().catch(() => {});
      return analyser;
    } catch {
      // never let a failed graph mute playback
      try { audioGraphRef.current?.src?.connect(ctx.destination); } catch { /* no-op */ }
      audioGraphRef.current = { analyser: null };
      return null;
    }
  }, []);

  // remove deleted tracks from the queue
  const purge = useCallback(ids => {
    const set = new Set(ids);
    const { queue: q, index: i, playing: pl } = refs.current;
    if (!q.some(id => set.has(id))) return;
    const a = audioRef.current;
    const currentGone = set.has(q[i]);
    let ni = i;
    const nq = [];
    q.forEach((id, j) => {
      if (set.has(id)) { if (j < i) ni--; }
      else nq.push(id);
    });
    originalRef.current = originalRef.current.filter(id => !set.has(id));
    if (!nq.length) {
      a.pause();
      a.removeAttribute('src');
      setQueue([]); setIndex(-1); setPlaying(false); setPosition(0); setDuration(0);
      setPref('lastQueue', { ids: [], index: -1 });
    } else {
      setQueue(nq);
      refs.current.queue = nq;
      if (currentGone) {
        const target = Math.min(Math.max(ni, 0), nq.length - 1);
        if (pl) jump(target);
        else { a.pause(); a.removeAttribute('src'); setIndex(target); setPosition(0); setDuration(0); }
      } else {
        setIndex(ni);
        setPref('lastQueue', { ids: nq, index: ni });
      }
    }
  }, [jump]);

  fnRef.current = { next, prev, toggle };

  // audio element event wiring (once)
  useEffect(() => {
    const a = audioRef.current;
    window.__audio = a; // debugging hook
    const savePos = () => {
      const { queue: q, index: i } = refs.current;
      if (q[i]) setPref('lastPos', { id: q[i], t: a.currentTime || 0 });
    };
    const syncMediaPos = () => {
      if (!('mediaSession' in navigator) || !Number.isFinite(a.duration)) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: a.duration,
          playbackRate: a.playbackRate,
          position: Math.min(a.currentTime, a.duration)
        });
      } catch { /* not supported everywhere */ }
    };
    const onTime = () => {
      setPosition(a.currentTime);
      if (Date.now() - lastSaveRef.current > 5000) {
        lastSaveRef.current = Date.now();
        savePos();
      }
      // keep the OS media notification's position fresh (helps Samsung keep it visible)
      if (Date.now() - lastPosSyncRef.current > 1000) {
        lastPosSyncRef.current = Date.now();
        syncMediaPos();
      }
    };
    const onDur = () => { setDuration(a.duration || 0); syncMediaPos(); };
    const onPlay = () => {
      setPlaying(true);
      audioGraphRef.current?.ctx?.resume?.().catch(() => {});
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    const onPause = () => {
      setPlaying(false);
      savePos();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };
    const onEnded = () => {
      if (refs.current.repeat === 'one') {
        a.currentTime = 0;
        a.play().catch(() => {});
        return;
      }
      // next() swaps in the preloaded blob synchronously when available
      fnRef.current.next(true);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') savePos();
      else if ('mediaSession' in navigator) {
        // re-assert state when coming back — some Android skins drop it
        navigator.mediaSession.playbackState = a.paused ? 'paused' : 'playing';
        syncMediaPos();
      }
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', savePos);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', savePos);
    };
  }, []);

  // desktop: spacebar toggles play/pause (unless typing or focused on a control)
  useEffect(() => {
    const onKey = e => {
      if (e.code !== 'Space') return;
      if (e.target.closest?.('input, textarea, select, button, [contenteditable]')) return;
      e.preventDefault();
      fnRef.current.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // restore last session once the library is loaded
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!ready || restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      const [q, pos, vol, sh, rp] = await Promise.all([
        getPref('lastQueue'), getPref('lastPos'), getPref('volume'), getPref('shuffle'), getPref('repeat')
      ]);
      if (typeof vol === 'number') { setVolumeState(vol); audioRef.current.volume = vol; }
      if (sh) setShuffle(true);
      if (rp === 'all' || rp === 'one') setRepeat(rp);
      const ids = (q?.ids || []).filter(id => refs.current.trackMap[id]);
      if (ids.length) {
        const idx = Math.min(Math.max(q.index ?? 0, 0), ids.length - 1);
        setQueue(ids);
        originalRef.current = ids.slice();
        setIndex(idx);
        const id = ids[idx];
        await load(id, { autoplay: false, startAt: pos?.id === id ? pos.t : 0 });
      }
    })();
  }, [ready, load]);

  const currentId = index >= 0 ? queue[index] : null;
  const currentTrack = currentId ? trackMap[currentId] ?? null : null;

  // Media Session (lock screen / hardware keys)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (currentTrack) {
      const art = coverUrls[currentTrack.albumKey];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: art
          ? [
              { src: art, sizes: '96x96' },
              { src: art, sizes: '192x192' },
              { src: art, sizes: '512x512' }
            ]
          : []
      });
    }
  }, [currentTrack, coverUrls]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const a = audioRef.current;
    try {
      ms.setActionHandler('play', () => a.play().catch(() => {}));
      ms.setActionHandler('pause', () => a.pause());
      ms.setActionHandler('previoustrack', () => fnRef.current.prev());
      ms.setActionHandler('nexttrack', () => fnRef.current.next());
      ms.setActionHandler('seekto', d => { if (d.seekTime != null) { a.currentTime = d.seekTime; } });
      ms.setActionHandler('seekbackward', d => {
        a.currentTime = Math.max(0, a.currentTime - (d.seekOffset || 10));
      });
      ms.setActionHandler('seekforward', d => {
        a.currentTime = Math.min(a.duration || a.currentTime + 10, a.currentTime + (d.seekOffset || 10));
      });
    } catch { /* some handlers unsupported */ }
  }, []);

  const queueTracks = useMemo(
    () => queue.map(id => trackMap[id]).filter(Boolean),
    [queue, trackMap]
  );

  const value = {
    currentTrack, queue, queueTracks, index, playing, position, duration,
    volume, shuffle, repeat,
    playTracks, playShuffled, playNext, addToQueue, jumpTo, moveInQueue, removeFromQueue,
    toggle, next, prev, seek,
    setVolume, toggleShuffle, cycleRepeat, purge, getAnalyser,
    sleepRemaining, setSleep
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
