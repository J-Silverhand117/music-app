import { usePlayer } from '../state/PlayerContext';
import { useLibrary } from '../state/LibraryContext';
import Cover from './Cover';
import { Play, Pause, Prev, Next } from './Icons';

export default function MiniPlayer({ onExpand }) {
  const p = usePlayer();
  const { coverUrls } = useLibrary();
  const t = p.currentTrack;
  if (!t) return null;
  const pct = p.duration ? (p.position / p.duration) * 100 : 0;
  return (
    <div className="mini" onClick={onExpand} role="button" aria-label="Open now playing">
      <div className="mini-progress"><div style={{ width: pct + '%' }} /></div>
      <Cover url={coverUrls[t.albumKey]} title={t.album} className="mini-art" />
      <div className="mini-meta">
        <div className="mini-title">{t.title}</div>
        <div className="mini-artist">{t.artist}</div>
      </div>
      <button
        className="iconbtn desktop-only"
        aria-label="Previous"
        onClick={e => { e.stopPropagation(); p.prev(); }}
      >
        <Prev />
      </button>
      <button
        className="iconbtn mini-play"
        aria-label={p.playing ? 'Pause' : 'Play'}
        onClick={e => { e.stopPropagation(); p.toggle(); }}
      >
        {p.playing ? <Pause /> : <Play />}
      </button>
      <button
        className="iconbtn desktop-only"
        aria-label="Next"
        onClick={e => { e.stopPropagation(); p.next(); }}
      >
        <Next />
      </button>
    </div>
  );
}
