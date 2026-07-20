import { useLibrary } from '../state/LibraryContext';
import Cover from './Cover';

// Spotify-style artist grid: circular picture with the name underneath.
// Picture priority: custom uploaded photo > first album cover > dot placeholder.
export default function ArtistsView({ onOpenArtist }) {
  const { artists, coverUrls, artistPicUrls } = useLibrary();
  return (
    <div className="grid artist-grid">
      {artists.map(ar => {
        const key = ar.name.toLowerCase();
        const albumWithCover = ar.albums.find(al => coverUrls[al.key]);
        const pic = artistPicUrls[key] || (albumWithCover ? coverUrls[albumWithCover.key] : null);
        const nTracks = ar.albums.reduce((s, a) => s + a.tracks.length, 0);
        return (
          <div key={key} className="artist-card" onClick={() => onOpenArtist(ar.name)}>
            <div className="artist-pic">
              <Cover url={pic} title={ar.name} />
            </div>
            <div className="card-name center">{ar.name}</div>
            <div className="artist-count ndot">
              {ar.albums.length} {ar.albums.length === 1 ? 'ALBUM' : 'ALBUMS'} · {nTracks} TRACKS
            </div>
          </div>
        );
      })}
    </div>
  );
}
