import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../state/PlayerContext';
import { useLibrary } from '../state/LibraryContext';
import { getPref, setPref, getLyrics } from '../lib/db';
import { parseLRC } from '../lib/lrc';
import { useMenu } from './Menu';
import Cover from './Cover';
import Vinyl from './Vinyl';
import Visualizer from './Visualizer';
import { fmtTime } from '../lib/format';
import {
  Play, Pause, Prev, Next, Shuffle, Repeat, ChevronDown,
  Volume, QueueIcon, X, Grip, Clock
} from './Icons';

// Synced .lrc lyrics: current line white, the rest gray; auto-centers the
// active line (paused for a moment if the user scrolls); tap a line to seek.
function LyricsPane() {
  const p = usePlayer();
  const [lines, setLines] = useState(null); // null = loading, [] = none
  const listRef = useRef(null);
  const userScrollRef = useRef(0);
  const id = p.currentTrack?.id;

  useEffect(() => {
    let alive = true;
    setLines(null);
    if (!id) return;
    getLyrics(id).then(text => {
      if (alive) setLines(text ? parseLRC(text) : []);
    });
    return () => { alive = false; };
  }, [id]);

  const active = useMemo(() => {
    if (!lines?.length) return -1;
    let a = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].t <= p.position + 0.25) a = i;
      else break;
    }
    return a;
  }, [lines, p.position]);

  useEffect(() => {
    if (active < 0) return;
    if (Date.now() - userScrollRef.current < 3000) return; // respect manual scrolling
    listRef.current
      ?.querySelector('.lyr-line.on')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active]);

  const markScroll = () => { userScrollRef.current = Date.now(); };

  if (lines === null) return <div className="lyr-pane lyr-empty ndot">…</div>;
  if (!lines.length) {
    return (
      <div className="lyr-pane lyr-empty">
        <div className="ndot">NO LYRICS</div>
        <div className="lyr-hint">
          Import a .lrc file named like the track (e.g. "{p.currentTrack?.fileName?.replace(/\.[^.]+$/, '')}.lrc")
          and it links up automatically.
        </div>
      </div>
    );
  }
  return (
    <div className="lyr-pane" ref={listRef} onWheel={markScroll} onTouchMove={markScroll}>
      <div className="lyr-pad" />
      {lines.map((l, i) => (
        <div
          key={i}
          className={'lyr-line' + (i === active ? ' on' : '')}
          onClick={() => p.seek(l.t)}
        >
          {l.text}
        </div>
      ))}
      <div className="lyr-pad" />
    </div>
  );
}

// Queue rows with hold-and-drag reordering (grip handle) and remove.
// Used by both the desktop side panel and the mobile bottom sheet.
function QueueList() {
  const p = usePlayer();
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const justDraggedRef = useRef(false);

  const rows = () => [...listRef.current.querySelectorAll('.qrow')];

  const applyShifts = d => {
    rows().forEach((r, j) => {
      if (j === d.from) return;
      let shift = 0;
      if (d.from < d.to && j > d.from && j <= d.to) shift = -d.rowH;
      else if (d.from > d.to && j >= d.to && j < d.from) shift = d.rowH;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };

  const onGripDown = (e, i) => {
    e.preventDefault();
    e.stopPropagation();
    const list = listRef.current;
    const rowEls = rows();
    if (!rowEls[i]) return;
    dragRef.current = {
      from: i,
      to: i,
      rowH: rowEls[i].offsetHeight || 48,
      startY: e.clientY,
      scrollStart: list.scrollTop,
      moved: false
    };
    rowEls[i].classList.add('dragging');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  };

  const onGripMove = e => {
    const d = dragRef.current;
    if (!d) return;
    const list = listRef.current;
    // auto-scroll when dragging near the top/bottom of the list
    const rect = list.getBoundingClientRect();
    if (e.clientY < rect.top + 46) list.scrollTop -= 9;
    else if (e.clientY > rect.bottom - 46) list.scrollTop += 9;
    const dy = e.clientY - d.startY + (list.scrollTop - d.scrollStart);
    if (Math.abs(dy) > 4) d.moved = true;
    const rowEls = rows();
    if (rowEls[d.from]) rowEls[d.from].style.transform = `translateY(${dy}px)`;
    const to = Math.max(0, Math.min(rowEls.length - 1, d.from + Math.round(dy / d.rowH)));
    if (to !== d.to) {
      d.to = to;
      applyShifts(d);
    }
  };

  const onGripUp = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    const list = listRef.current;
    list.classList.add('no-anim');
    rows().forEach(r => {
      r.style.transform = '';
      r.classList.remove('dragging');
    });
    requestAnimationFrame(() => list?.classList.remove('no-anim'));
    if (d.moved) {
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 150);
      if (d.to !== d.from) p.moveInQueue(d.from, d.to);
    }
  };

  return (
    <div className="np-queue-list" ref={listRef}>
      {p.queueTracks.map((qt, i) => (
        <div
          key={i}
          className={'qrow' + (i === p.index ? ' on' : '')}
          onClick={() => { if (!justDraggedRef.current) p.jumpTo(i); }}
        >
          <span className="ndot qnum">{String(i + 1).padStart(2, '0')}</span>
          <div className="qmeta">
            <div className="qtitle">{qt.title}</div>
            <div className="qartist">{qt.artist}</div>
          </div>
          <div className="qbtns" onClick={e => e.stopPropagation()}>
            <button
              className="qbtn qgrip"
              aria-label="Hold and drag to reorder"
              onPointerDown={e => onGripDown(e, i)}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
              onPointerCancel={onGripUp}
            >
              <Grip />
            </button>
            <button className="qbtn qx" aria-label="Remove from queue" onClick={() => p.removeFromQueue(i)}>
              <X />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniVinyl({ cover, playing, title }) {
  return (
    <div className={'mini-vinyl' + (playing ? ' spin' : '')} aria-hidden="true">
      <div className="mv-label">
        <Cover url={cover} title={title} />
      </div>
      <div className="mv-spindle" />
    </div>
  );
}

const desktopQuery = '(min-width: 900px)';

export default function NowPlaying({ open, onClose }) {
  const p = usePlayer();
  const { coverUrls } = useLibrary();
  const { openMenu } = useMenu();
  const [view, setView] = useState('flat');
  const [qOpen, setQOpen] = useState(false);       // mobile bottom sheet
  const [sideOpen, setSideOpen] = useState(true);  // desktop side panel
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(desktopQuery).matches);

  useEffect(() => {
    const mq = window.matchMedia(desktopQuery);
    const onChange = e => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    getPref('npView').then(v => {
      if (v === 'vinyl' || v === 'flat' || v === 'lyrics') setView(v);
    });
    getPref('npSide').then(v => {
      if (typeof v === 'boolean') setSideOpen(v);
    });
  }, []);
  useEffect(() => {
    if (!open) setQOpen(false);
  }, [open]);

  const t = p.currentTrack;
  // if the playing track disappears (e.g. deleted) while open, close the overlay
  useEffect(() => {
    if (open && !t) onClose();
  }, [open, t, onClose]);

  const cover = t ? coverUrls[t.albumKey] : null;
  const pct = p.duration ? (p.position / p.duration) * 100 : 0;
  const pickView = v => {
    setView(v);
    setPref('npView', v);
  };
  const toggleQueue = () => {
    if (isDesktop) {
      setSideOpen(s => {
        setPref('npSide', !s);
        return !s;
      });
    } else setQOpen(true);
  };

  const openSleepMenu = e => {
    const items = [15, 30, 45, 60].map(min => ({
      label: `${min} minutes`,
      action: () => p.setSleep(min)
    }));
    items.push({
      label: 'Custom…',
      action: () => {
        const v = parseInt(window.prompt('Sleep timer (minutes)', '20') || '', 10);
        if (Number.isFinite(v) && v > 0 && v <= 24 * 60) p.setSleep(v);
      }
    });
    if (p.sleepRemaining > 0) {
      items.push({ label: 'Cancel timer', danger: true, action: () => p.setSleep(null) });
    }
    openMenu(e, items);
  };

  return (
    <div className={'np' + (open ? ' open' : '')} aria-hidden={!open}>
      {t && (
        <>
          <div className="np-main">
            <header className="np-head">
              <button className="iconbtn" aria-label="Close" onClick={onClose}><ChevronDown /></button>
              <div className="np-toggle">
                <button className={view === 'flat' ? 'on' : ''} onClick={() => pickView('flat')}>FLAT</button>
                <button className={view === 'vinyl' ? 'on' : ''} onClick={() => pickView('vinyl')}>VINYL</button>
                <button className={view === 'lyrics' ? 'on' : ''} onClick={() => pickView('lyrics')}>LYRICS</button>
              </div>
              <div className="np-hr">
                {p.sleepRemaining > 0 && (
                  <span className="sleep-count ndot">{fmtTime(p.sleepRemaining)}</span>
                )}
                <button
                  className={'iconbtn' + (p.sleepRemaining > 0 ? ' lit' : '')}
                  aria-label="Sleep timer"
                  onClick={openSleepMenu}
                >
                  <Clock />
                </button>
                <button
                  className={'iconbtn' + (isDesktop && sideOpen ? ' lit' : '')}
                  aria-label="Queue"
                  onClick={toggleQueue}
                >
                  <QueueIcon />
                </button>
              </div>
            </header>

            <div className="np-art">
              {view === 'flat' && <div className="np-flat"><Cover url={cover} title={t.album} /></div>}
              {view === 'vinyl' && <Vinyl cover={cover} playing={p.playing} title={t.album} />}
              {view === 'lyrics' && <LyricsPane />}
            </div>

            <div className="np-info">
              <div className="np-title">{t.title}</div>
              <div className="np-sub">{t.artist} — {t.album}</div>
              {(t.bps > 0 || t.sampleRate > 0) && (
                <div className="np-quality ndot">
                  FLAC
                  {t.bps > 0 && <> · {t.bps}-BIT</>}
                  {t.sampleRate > 0 && <> / {(t.sampleRate / 1000).toString().replace(/(\.\d)\d+$/, '$1')} KHZ</>}
                  <span className="reddot"> ● </span>LOSSLESS
                </div>
              )}
            </div>

            <div className="np-seek">
              <Visualizer getAnalyser={p.getAnalyser} active={open && p.playing} />
              <input
                type="range"
                min="0"
                max={p.duration || 1}
                step="0.25"
                value={Math.min(p.position, p.duration || 1)}
                style={{ '--fill': pct + '%' }}
                onChange={e => p.seek(+e.target.value)}
                aria-label="Seek"
              />
              <div className="np-times ndot">
                <span>{fmtTime(p.position)}</span>
                <span>{p.duration ? fmtTime(p.duration) : '--:--'}</span>
              </div>
            </div>

            <div className="np-controls">
              <button className={'iconbtn' + (p.shuffle ? ' lit' : '')} aria-label="Shuffle" onClick={p.toggleShuffle}>
                <Shuffle />
              </button>
              <button className="iconbtn big" aria-label="Previous" onClick={p.prev}><Prev /></button>
              <button className="np-play" aria-label={p.playing ? 'Pause' : 'Play'} onClick={p.toggle}>
                {p.playing ? <Pause /> : <Play />}
              </button>
              <button className="iconbtn big" aria-label="Next" onClick={() => p.next()}><Next /></button>
              <button className={'iconbtn' + (p.repeat !== 'off' ? ' lit' : '')} aria-label="Repeat" onClick={p.cycleRepeat}>
                <Repeat one={p.repeat === 'one'} />
              </button>
            </div>

            <div className="np-bottom">
              {view !== 'vinyl' && <MiniVinyl cover={cover} playing={p.playing} title={t.album} />}
              <div className="np-vol">
                <Volume />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={p.volume}
                  style={{ '--fill': p.volume * 100 + '%' }}
                  onChange={e => p.setVolume(+e.target.value)}
                  aria-label="Volume"
                />
              </div>
              {view !== 'vinyl' && <div className="mv-balance" aria-hidden="true" />}
            </div>
          </div>

          {isDesktop && sideOpen && (
            <aside className="np-side">
              <div className="np-side-head">
                <span className="ndot">UP NEXT — {p.queueTracks.length}</span>
                <button className="iconbtn" aria-label="Hide queue" onClick={toggleQueue}><X /></button>
              </div>
              <QueueList />
            </aside>
          )}

          {qOpen && !isDesktop && (
            <div className="np-queue-backdrop" onClick={() => setQOpen(false)}>
              <div className="np-queue" onClick={e => e.stopPropagation()}>
                <div className="np-queue-head ndot">UP NEXT — {p.queueTracks.length}</div>
                <QueueList />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
