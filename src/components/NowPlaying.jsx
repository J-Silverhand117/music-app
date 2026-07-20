import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../state/PlayerContext';
import { useLibrary } from '../state/LibraryContext';
import { getPref, setPref } from '../lib/db';
import Cover from './Cover';
import Vinyl from './Vinyl';
import Visualizer from './Visualizer';
import { fmtTime } from '../lib/format';
import {
  Play, Pause, Prev, Next, Shuffle, Repeat, ChevronDown,
  Volume, QueueIcon, X, Grip
} from './Icons';

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
      if (v === 'vinyl' || v === 'flat') setView(v);
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
              </div>
              <button
                className={'iconbtn' + (isDesktop && sideOpen ? ' lit' : '')}
                aria-label="Queue"
                onClick={toggleQueue}
              >
                <QueueIcon />
              </button>
            </header>

            <div className="np-art">
              {view === 'flat' ? (
                <div className="np-flat"><Cover url={cover} title={t.album} /></div>
              ) : (
                <Vinyl cover={cover} playing={p.playing} title={t.album} />
              )}
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
              {view === 'flat' && <MiniVinyl cover={cover} playing={p.playing} title={t.album} />}
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
              {view === 'flat' && <div className="mv-balance" aria-hidden="true" />}
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
