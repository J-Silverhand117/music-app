import { useEffect, useState } from 'react';
import { usePlayer } from '../state/PlayerContext';
import { useLibrary } from '../state/LibraryContext';
import { getPref, setPref } from '../lib/db';
import Cover from './Cover';
import Vinyl from './Vinyl';
import { fmtTime } from '../lib/format';
import { Play, Pause, Prev, Next, Shuffle, Repeat, ChevronDown, Volume, QueueIcon } from './Icons';

export default function NowPlaying({ open, onClose }) {
  const p = usePlayer();
  const { coverUrls } = useLibrary();
  const [view, setView] = useState('flat');
  const [qOpen, setQOpen] = useState(false);

  useEffect(() => {
    getPref('npView').then(v => {
      if (v === 'vinyl' || v === 'flat') setView(v);
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

  return (
    <div className={'np' + (open ? ' open' : '')} aria-hidden={!open}>
      {t && (
        <>
          <header className="np-head">
            <button className="iconbtn" aria-label="Close" onClick={onClose}><ChevronDown /></button>
            <div className="np-toggle">
              <button className={view === 'flat' ? 'on' : ''} onClick={() => pickView('flat')}>FLAT</button>
              <button className={view === 'vinyl' ? 'on' : ''} onClick={() => pickView('vinyl')}>VINYL</button>
            </div>
            <button className="iconbtn" aria-label="Queue" onClick={() => setQOpen(true)}><QueueIcon /></button>
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
          </div>

          <div className="np-seek">
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

          {qOpen && (
            <div className="np-queue-backdrop" onClick={() => setQOpen(false)}>
              <div className="np-queue" onClick={e => e.stopPropagation()}>
                <div className="np-queue-head ndot">UP NEXT — {p.queueTracks.length}</div>
                <div className="np-queue-list">
                  {p.queueTracks.map((qt, i) => (
                    <div key={i} className={'qrow' + (i === p.index ? ' on' : '')} onClick={() => p.jumpTo(i)}>
                      <span className="ndot qnum">{String(i + 1).padStart(2, '0')}</span>
                      <span className="qtitle">{qt.title}</span>
                      <span className="qdur ndot">{fmtTime(qt.duration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
