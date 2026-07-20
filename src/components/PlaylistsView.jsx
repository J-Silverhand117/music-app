import { useEffect, useRef, useState } from 'react';
import { useLibrary } from '../state/LibraryContext';
import { usePlayer } from '../state/PlayerContext';
import { useMenu, useTrackMenu } from './Menu';
import Cover from './Cover';
import TrackRow from './TrackRow';
import { ChevronLeft, Plus, Dots } from './Icons';
import { fmtTotal } from '../lib/format';

export default function PlaylistsView({ onOpen }) {
  const {
    playlists, trackMap, playlistPicUrls,
    createPlaylist, renamePlaylist, deletePlaylist, setPlaylistPic, removePlaylistPic
  } = useLibrary();
  const { openMenu } = useMenu();
  const [name, setName] = useState('');
  const picInput = useRef(null);
  const pendingPicId = useRef(null); // which playlist the photo picker is for

  const create = async () => {
    if (!name.trim()) return;
    await createPlaylist(name);
    setName('');
  };

  const pickPhotoFor = id => {
    pendingPicId.current = id;
    picInput.current?.click();
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
        const hasPic = !!playlistPicUrls[pl.id];
        const items = [
          {
            label: 'Rename',
            action: () => {
              const n = window.prompt('Rename playlist', pl.name);
              if (n?.trim()) renamePlaylist(pl.id, n);
            }
          },
          { label: hasPic ? 'Change photo' : 'Set photo', action: () => pickPhotoFor(pl.id) },
          ...(hasPic ? [{ label: 'Remove photo', action: () => removePlaylistPic(pl.id) }] : []),
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
            <div className="pl-icon">
              <Cover url={playlistPicUrls[pl.id]} title={'playlist:' + pl.name} />
            </div>
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
      <input
        ref={picInput}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files?.[0] && pendingPicId.current) {
            setPlaylistPic(pendingPicId.current, e.target.files[0]);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function PlaylistView({ id, onBack }) {
  const {
    playlists, trackMap, playlistPicUrls,
    renamePlaylist, removeFromPlaylist, setPlaylistPic, removePlaylistPic
  } = useLibrary();
  const player = usePlayer();
  const { openMenu } = useMenu();
  const trackMenu = useTrackMenu();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const picInput = useRef(null);

  const pl = playlists.find(p => p.id === id);
  useEffect(() => {
    if (!pl) onBack();
  }, [pl, onBack]);
  if (!pl) return null;

  const tracks = pl.trackIds.map(tid => trackMap[tid]).filter(Boolean);
  const ids = tracks.map(t => t.id);
  const total = tracks.reduce((s, t) => s + t.duration, 0);
  const hasPic = !!playlistPicUrls[pl.id];

  const commitName = () => {
    if (name.trim()) renamePlaylist(pl.id, name);
    setEditing(false);
  };

  const plMenu = [
    ...(ids.length
      ? [
          { label: 'Play next', action: () => player.playNext(ids) },
          { label: 'Add to queue', action: () => player.addToQueue(ids) }
        ]
      : []),
    { label: 'Rename', action: () => { setName(pl.name); setEditing(true); } },
    { label: hasPic ? 'Change photo' : 'Set photo', action: () => picInput.current?.click() },
    ...(hasPic ? [{ label: 'Remove photo', action: () => removePlaylistPic(pl.id) }] : [])
  ];

  return (
    <div>
      <button className="back-btn ndot" onClick={onBack}>
        <ChevronLeft /> BACK
      </button>
      <div className="detail-head">
        <div className="pl-cover" onClick={() => picInput.current?.click()} title="Tap to set photo">
          <Cover url={playlistPicUrls[pl.id]} title={'playlist:' + pl.name} />
        </div>
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
          <div className="dh-actions">
            {tracks.length > 0 && (
              <>
                <button className="btn-red ndot" onClick={() => player.playTracks(ids)}>PLAY</button>
                <button className="btn-ghost ndot" onClick={() => player.playShuffled(ids)}>SHUFFLE</button>
              </>
            )}
            <button className="iconbtn" aria-label="Playlist menu" onClick={e => openMenu(e, plMenu)}>
              <Dots />
            </button>
          </div>
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
      <input
        ref={picInput}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files?.[0]) setPlaylistPic(pl.id, e.target.files[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
