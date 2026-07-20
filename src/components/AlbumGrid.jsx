import { useLibrary } from '../state/LibraryContext';
import { useMenu, useAlbumMenu } from './Menu';
import Cover from './Cover';
import { Dots } from './Icons';

export function AlbumCard({ album, onOpen }) {
  const { coverUrls } = useLibrary();
  const { openMenu } = useMenu();
  const albumMenu = useAlbumMenu();
  return (
    <div className="card" onClick={() => onOpen(album.key)} onContextMenu={e => openMenu(e, albumMenu(album))}>
      <div className="cover-box">
        <Cover url={coverUrls[album.key]} title={album.album} />
        <button
          className="cardmenu"
          aria-label="Album menu"
          onClick={e => {
            e.stopPropagation();
            openMenu(e, albumMenu(album));
          }}
        >
          <Dots />
        </button>
      </div>
      <div className="card-name">{album.album}</div>
      <div className="card-sub">
        {album.artist}
        {album.year ? <span className="ndot card-year"> · {album.year}</span> : null}
      </div>
    </div>
  );
}

export default function AlbumGrid({ albums, onOpen }) {
  return (
    <div className="grid">
      {albums.map(a => (
        <AlbumCard key={a.key} album={a} onOpen={onOpen} />
      ))}
    </div>
  );
}
