import { useEffect, useState } from 'react';
import { useLibrary } from '../state/LibraryContext';
import { usePlayer } from '../state/PlayerContext';
import { useMenu, useTrackMenu } from './Menu';
import TrackRow from './TrackRow';
import { ChevronLeft, Note, Plus, Dots } from './Icons';
import { fmtTotal } from '../lib/format';

export default function PlaylistsView({ onOpen }) {
  const { playlists, trackMap, createPlaylist, renamePlaylist, deletePlaylist } = useLibrary();
  const { openMenu } = useMenu();
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    await createPlaylist(name);
    setName('');
  };

  return (
    <div>
      <div className="newpl">
        <input
          placeholder="New playlist name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && create()}
        />
        <button className="btn-ghost ndot" onClick={create}><Plus /> CREATE</button>
      </div>
      {playlists.length === 0 && (
        <div className="empty small">
          <div className="empty-title ndot">NO PLAYLISTS</div>
          <div className="empty-sub">Create one above, then add tracks from any album via the ⋮ menu.</div>
        </div>
      )}
      {playlists.map(pl => {
        const total = pl.trackIds.reduce((s, id) => s + (trackMap[id]?.duration || 0), 0);
        const items = [
          {
            label: 'Rename',
            action: () => {
              const n = window.prompt('Rename playlist', pl.name);
              if (n?.trim()) renamePlaylist(pl.id, n);
            }
          },
          {
            label: 'Delete playlist',
            danger: true,
            action: () => {
              if (window.confirm(`Delete playlist "${pl.name}"?`)) deletePlaylist(pl.id);
            }
          }
        ];
        return (
          <div key={pl.id} className="plrow" onClick={() => onOpen(pl.id)} onContextMenu={e => openMenu(e, items)}>
            <div className="pl-icon"><Note /></div>
            <div className="pl-name">{pl.name}</div>
            <div className="pl-count ndot">
              {pl.trackIds.length} TRACKS{pl.trackIds.length ? ` · ${fmtTotal(total)}` : ''}
            </div>
            <button
              className="iconbtn"
              aria-label="Playlist menu"
              onClick={e => {
                e.stopPropagation();
                openMenu(e, items);
              }}
            >
              <Dots />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function PlaylistView({ id, onBack }) {
  const { playlists, trackMap, renamePlaylist, removeFromPlaylist } = useLibrary();
  const player = usePlayer();
  const trackMenu = useTrackMenu();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const pl = playlists.find(p => p.id === id);
  useEffect(() => {
    if (!pl) onBack();
  }, [pl, onBack]);
  if (!pl) return null;
  const tracks = pl.trackIds.map(tid => trackMap[tid]).filter(Boolean);
  const ids = tracks.map(t => t.id);
  const total = tracks.reduce((s, t) => s + t.duration, 0);

  const commitName = () => {
    if (name.trim()) renamePlaylist(pl.id, name);
    setEditing(false);
  };

  return (
    <div>
      <button className="back-btn ndot" onClick={onBack}>
        <ChevronLeft /> BACK
      </button>
      <div className="detail-head">
        <div className="pl-icon big"><Note /></div>
        <div className="dh-meta">
          {editing ? (
            <input
              className="dh-rename"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => e.key === 'Enter' && commitName()}
            />
          ) : (
            <h1
              className="dh-title ndot"
              title="Click to rename"
              onClick={() => {
                setName(pl.name);
                setEditing(true);
              }}
            >
              {pl.name}
            </h1>
          )}
          <div className="dh-stats ndot">
            {tracks.length} TRACKS{tracks.length ? ` · ${fmtTotal(total)}` : ''}
          </div>
          {tracks.length > 0 && (
            <div className="dh-actions">
              <button className="btn-red ndot" onClick={() => player.playTracks(ids)}>PLAY</button>
              <button className="btn-ghost ndot" onClick={() => player.playShuffled(ids)}>SHUFFLE</button>
            </div>
          )}
        </div>
      </div>
      {tracks.length === 0 && (
        <div className="empty small">
          <div className="empty-sub">This playlist is empty. Add tracks from any album or artist via the ⋮ menu.</div>
        </div>
      )}
      <div className="tracklist">
        {tracks.map((t, i) => (
          <TrackRow
            key={`${t.id}-${i}`}
            track={t}
            num={i + 1}
            showArtist
            onPlay={() => player.playTracks(ids, i)}
            items={trackMenu(t, [
              { label: 'Remove from playlist', action: () => removeFromPlaylist(pl.id, t.id) }
            ])}
          />
        ))}
      </div>
    </div>
  );
}
