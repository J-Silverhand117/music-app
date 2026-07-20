import { useEffect } from 'react';
import { useLibrary } from '../state/LibraryContext';
import { usePlayer } from '../state/PlayerContext';
import { useTrackMenu } from './Menu';
import Cover from './Cover';
import TrackRow from './TrackRow';
import { ChevronLeft } from './Icons';
import { fmtTotal } from '../lib/format';

export default function AlbumView({ albumKey, onBack }) {
  const { albums, coverUrls } = useLibrary();
  const player = usePlayer();
  const trackMenu = useTrackMenu();
  const album = albums.find(a => a.key === albumKey);

  useEffect(() => {
    if (!album) onBack();
  }, [album, onBack]);
  if (!album) return null;

  const ids = album.tracks.map(t => t.id);
  const total = album.tracks.reduce((s, t) => s + t.duration, 0);

  return (
    <div>
      <button className="back-btn ndot" onClick={onBack}>
        <ChevronLeft /> BACK
      </button>
      <div className="detail-head">
        <Cover url={coverUrls[album.key]} title={album.album} className="dh-cover" />
        <div className="dh-meta">
          <h1 className="dh-title ndot">{album.album}</h1>
          <div className="dh-sub">{album.artist}</div>
          <div className="dh-stats ndot">
            {album.year && <span>{album.year} · </span>}
            {album.tracks.length} TRACKS · {fmtTotal(total)}
          </div>
          <div className="dh-actions">
            <button className="btn-red ndot" onClick={() => player.playTracks(ids)}>PLAY</button>
            <button className="btn-ghost ndot" onClick={() => player.playShuffled(ids)}>SHUFFLE</button>
          </div>
        </div>
      </div>
      <div className="tracklist">
        {album.tracks.map((t, i) => (
          <TrackRow
            key={t.id}
            track={t}
            num={t.trackNo || i + 1}
            onPlay={() => player.playTracks(ids, i)}
            items={trackMenu(t)}
          />
        ))}
      </div>
    </div>
  );
}
