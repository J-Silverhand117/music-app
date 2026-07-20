import { useEffect, useRef } from 'react';
import { useLibrary } from '../state/LibraryContext';
import { usePlayer } from '../state/PlayerContext';
import { useMenu } from './Menu';
import Cover from './Cover';
import { AlbumCard } from './AlbumGrid';
import { ChevronLeft, Dots } from './Icons';
import { fmtTotal } from '../lib/format';

// Artist profile page: big circular picture, name, stats, play controls,
// then the artist's albums. The photo can be customized via the ⋮ menu
// (stored in IndexedDB, works offline like everything else).
export default function ArtistView({ name, onBack, onOpenAlbum }) {
  const { artists, coverUrls, artistPicUrls, setArtistPic, removeArtistPic } = useLibrary();
  const player = usePlayer();
  const { openMenu } = useMenu();
  const picInput = useRef(null);

  const ar = artists.find(a => a.name.toLowerCase() === name.toLowerCase());
  useEffect(() => {
    if (!ar) onBack();
  }, [ar, onBack]);
  if (!ar) return null;

  const key = ar.name.toLowerCase();
  const albumWithCover = ar.albums.find(al => coverUrls[al.key]);
  const hasCustomPic = !!artistPicUrls[key];
  const pic = artistPicUrls[key] || (albumWithCover ? coverUrls[albumWithCover.key] : null);
  const ids = ar.albums.flatMap(al => al.tracks.map(t => t.id));
  const total = ar.albums.reduce((s, al) => s + al.tracks.reduce((x, t) => x + t.duration, 0), 0);
  const fullAlbums = ar.albums.filter(al => al.kind !== 'single');
  const singles = ar.albums.filter(al => al.kind === 'single');
  const stats = [
    fullAlbums.length && `${fullAlbums.length} ${fullAlbums.length === 1 ? 'ALBUM' : 'ALBUMS'}`,
    singles.length && `${singles.length} ${singles.length === 1 ? 'SINGLE/EP' : 'SINGLES & EPS'}`,
    `${ids.length} TRACKS`,
    fmtTotal(total)
  ].filter(Boolean).join(' · ');

  const menuItems = [
    { label: 'Play next', action: () => player.playNext(ids) },
    { label: 'Add to queue', action: () => player.addToQueue(ids) },
    { label: 'Add to playlist', addIds: ids },
    { label: hasCustomPic ? 'Change photo' : 'Set photo', action: () => picInput.current?.click() },
    ...(hasCustomPic
      ? [{ label: 'Remove photo', danger: true, action: () => removeArtistPic(ar.name) }]
      : [])
  ];

  return (
    <div>
      <button className="back-btn ndot" onClick={onBack}>
        <ChevronLeft /> BACK
      </button>
      <div className="detail-head artist-head-detail">
        <div className="ar-pic" onClick={() => picInput.current?.click()} title="Tap to set photo">
          <Cover url={pic} title={ar.name} />
        </div>
        <div className="dh-meta">
          <h1 className="dh-title ndot">{ar.name}</h1>
          <div className="dh-stats ndot">{stats}</div>
          <div className="dh-actions">
            <button className="btn-red ndot" onClick={() => player.playTracks(ids)}>PLAY ALL</button>
            <button className="btn-ghost ndot" onClick={() => player.playShuffled(ids)}>SHUFFLE</button>
            <button className="iconbtn" aria-label="Artist menu" onClick={e => openMenu(e, menuItems)}>
              <Dots />
            </button>
          </div>
        </div>
      </div>
      {fullAlbums.length > 0 && (
        <section className="rel-sec">
          <div className="sec-head ndot">
            ALBUMS <span className="sec-count">{fullAlbums.length}</span>
          </div>
          <div className="grid grid-sm">
            {fullAlbums.map(al => (
              <AlbumCard key={al.key} album={al} onOpen={onOpenAlbum} />
            ))}
          </div>
        </section>
      )}
      {singles.length > 0 && (
        <section className="rel-sec">
          <div className="sec-head ndot">
            SINGLES &amp; EPS <span className="sec-count">{singles.length}</span>
          </div>
          <div className="grid grid-sm">
            {singles.map(al => (
              <AlbumCard key={al.key} album={al} onOpen={onOpenAlbum} />
            ))}
          </div>
        </section>
      )}
      <input
        ref={picInput}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files?.[0]) setArtistPic(ar.name, e.target.files[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
