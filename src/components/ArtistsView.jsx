import { useLibrary } from '../state/LibraryContext';
import { AlbumCard } from './AlbumGrid';

export default function ArtistsView({ onOpenAlbum }) {
  const { artists } = useLibrary();
  return (
    <div>
      {artists.map(ar => {
        const nTracks = ar.albums.reduce((s, a) => s + a.tracks.length, 0);
        return (
          <section className="artist-sec" key={ar.name}>
            <div className="artist-head ndot">
              <span>{ar.name}</span>
              <span className="artist-meta">
                {ar.albums.length} {ar.albums.length === 1 ? 'ALBUM' : 'ALBUMS'} · {nTracks} TRACKS
              </span>
            </div>
            <div className="grid grid-sm">
              {ar.albums.map(a => (
                <AlbumCard key={a.key} album={a} onOpen={onOpenAlbum} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
