import { createContext, useCallback, useContext, useState } from 'react';
import { useLibrary } from '../state/LibraryContext';
import { usePlayer } from '../state/PlayerContext';

const Ctx = createContext(null);
export const useMenu = () => useContext(Ctx);

export function MenuProvider({ children }) {
  const [menu, setMenu] = useState(null); // { x, y, items }
  const [page, setPage] = useState('root'); // root | playlists
  const [addIds, setAddIds] = useState([]);
  const [newName, setNewName] = useState('');
  const { playlists, createPlaylist, addToPlaylist } = useLibrary();

  const openMenu = useCallback((e, items) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    setPage('root');
    setNewName('');
    setMenu({ x: e.clientX ?? 0, y: e.clientY ?? 0, items });
  }, []);

  const close = () => setMenu(null);

  const pick = item => {
    if (item.addIds) {
      setAddIds(item.addIds);
      setPage('playlists');
      return;
    }
    close();
    item.action?.();
  };

  const addTo = async plId => {
    await addToPlaylist(plId, addIds);
    close();
  };

  const createAndAdd = async () => {
    if (!newName.trim()) return;
    const pl = await createPlaylist(newName);
    await addToPlaylist(pl.id, addIds);
    close();
  };

  let style;
  if (menu) {
    const est = 12 + (page === 'root' ? menu.items.length : playlists.length + 2) * 42;
    style = {
      left: Math.max(8, Math.min(menu.x, window.innerWidth - 240)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - est - 8))
    };
  }

  return (
    <Ctx.Provider value={{ openMenu }}>
      {children}
      {menu && (
        <div className="menu-backdrop" onClick={close} onContextMenu={e => e.preventDefault()}>
          <div className="menu" style={style} onClick={e => e.stopPropagation()}>
            {page === 'root' ? (
              menu.items.map((it, i) => (
                <button key={i} className={'menu-item' + (it.danger ? ' danger' : '')} onClick={() => pick(it)}>
                  {it.label}
                </button>
              ))
            ) : (
              <>
                <div className="menu-head">ADD TO PLAYLIST</div>
                {playlists.map(pl => (
                  <button key={pl.id} className="menu-item" onClick={() => addTo(pl.id)}>
                    {pl.name}
                  </button>
                ))}
                <div className="newpl-inline">
                  <input
                    placeholder="New playlist"
                    value={newName}
                    autoFocus={playlists.length === 0}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createAndAdd()}
                  />
                  <button className="menu-item red" onClick={createAndAdd}>ADD</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

// shared menu builders
export function useTrackMenu() {
  const player = usePlayer();
  const { deleteTracks } = useLibrary();
  return useCallback(
    (track, extra = []) => [
      { label: 'Play next', action: () => player.playNext([track.id]) },
      { label: 'Add to queue', action: () => player.addToQueue([track.id]) },
      { label: 'Add to playlist', addIds: [track.id] },
      ...extra,
      {
        label: 'Delete from library',
        danger: true,
        action: () => {
          if (window.confirm(`Delete "${track.title}" from your library?`)) {
            player.purge([track.id]);
            deleteTracks([track.id]);
          }
        }
      }
    ],
    [player, deleteTracks]
  );
}

export function useAlbumMenu() {
  const player = usePlayer();
  const { deleteTracks } = useLibrary();
  return useCallback(
    album => {
      const ids = album.tracks.map(t => t.id);
      return [
        { label: 'Play', action: () => player.playTracks(ids) },
        { label: 'Play next', action: () => player.playNext(ids) },
        { label: 'Add to queue', action: () => player.addToQueue(ids) },
        { label: 'Add to playlist', addIds: ids },
        {
          label: 'Delete album',
          danger: true,
          action: () => {
            if (window.confirm(`Delete "${album.album}" (${ids.length} tracks) from your library?`)) {
              player.purge(ids);
              deleteTracks(ids);
            }
          }
        }
      ];
    },
    [player, deleteTracks]
  );
}
