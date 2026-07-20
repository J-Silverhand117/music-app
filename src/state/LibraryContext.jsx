import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as db from '../lib/db';
import { parseFlac, trackFromMeta } from '../lib/flac';
import { downscaleSquare } from '../lib/img';

const Ctx = createContext(null);
export const useLibrary = () => useContext(Ctx);

const byAlbumOrder = (a, b) =>
  a.albumArtist.localeCompare(b.albumArtist) ||
  a.album.localeCompare(b.album) ||
  a.discNo - b.discNo ||
  a.trackNo - b.trackNo ||
  a.title.localeCompare(b.title);

export function LibraryProvider({ children }) {
  const [tracks, setTracks] = useState([]);
  const [coverUrls, setCoverUrls] = useState({});
  const [artistPicUrls, setArtistPicUrls] = useState({});
  const [playlists, setPlaylists] = useState([]);
  const [importing, setImporting] = useState(null); // {done,total,current,errors,finished}
  const [ready, setReady] = useState(false);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(() => {
    (async () => {
      const [ts, pls, covers, pics] = await Promise.all([
        db.getTracks(), db.getPlaylists(), db.getAllCovers(), db.getAllArtistPics()
      ]);
      setTracks(ts.sort(byAlbumOrder));
      setPlaylists(pls.sort((a, b) => a.createdAt - b.createdAt));
      const urls = {};
      for (const [k, blob] of covers) if (blob) urls[k] = URL.createObjectURL(blob);
      setCoverUrls(urls);
      const picUrls = {};
      for (const [k, blob] of pics) if (blob) picUrls[k] = URL.createObjectURL(blob);
      setArtistPicUrls(picUrls);
      setReady(true);
    })();
  }, []);

  const setArtistPic = useCallback(async (name, file) => {
    const key = name.toLowerCase();
    const blob = await downscaleSquare(file);
    await db.putArtistPic(key, blob);
    setArtistPicUrls(u => {
      if (u[key]) URL.revokeObjectURL(u[key]);
      return { ...u, [key]: URL.createObjectURL(blob) };
    });
  }, []);

  const removeArtistPic = useCallback(async name => {
    const key = name.toLowerCase();
    await db.deleteArtistPic(key);
    setArtistPicUrls(u => {
      if (!u[key]) return u;
      URL.revokeObjectURL(u[key]);
      const copy = { ...u };
      delete copy[key];
      return copy;
    });
  }, []);

  // Accepts either a flat array/FileList of File objects, or an array of
  // { file, path } entries (see lib/scan.js) produced by a folder picker or
  // a recursive drag-and-drop of directories. Non-FLAC files inside a
  // scanned folder (cover.jpg, .cue, .log, etc.) are skipped silently —
  // only genuine parse failures and duplicates are reported.
  const importFiles = useCallback(async rawList => {
    const entries = [...rawList].map(e =>
      e instanceof File ? { file: e, path: e.webkitRelativePath || e.name } : e
    );
    const files = entries.filter(
      ({ file: f }) => /\.flac$/i.test(f.name) || f.type === 'audio/flac' || f.type === 'audio/x-flac'
    );
    if (!files.length) return;

    // ask the browser to never evict our IndexedDB data
    try { await navigator.storage?.persist?.(); } catch { /* best effort */ }

    const errors = [];
    const existing = new Set(tracksRef.current.map(t => `${t.filePath || t.fileName}|${t.size}`));
    const added = [];
    const newCovers = {};
    for (let i = 0; i < files.length; i++) {
      const { file: f, path } = files[i];
      setImporting({ done: i, total: files.length, current: f.name, errors, finished: false });
      try {
        const sig = `${path}|${f.size}`;
        if (existing.has(sig)) { errors.push(`${path} — already in library`); continue; }
        const meta = await parseFlac(f);
        const track = trackFromMeta(f, meta, path);
        const coverAdded = await db.addTrack(track, f, meta.picture);
        if (coverAdded && meta.picture) newCovers[track.albumKey] = URL.createObjectURL(meta.picture);
        existing.add(sig);
        added.push(track);
      } catch (e) {
        errors.push(`${path} — ${e.message}`);
      }
    }
    if (added.length) {
      setTracks(ts => [...ts, ...added].sort(byAlbumOrder));
      setCoverUrls(u => ({ ...u, ...newCovers }));
    }
    setImporting({ done: files.length, total: files.length, current: '', errors, finished: true, added: added.length });
    setTimeout(() => setImporting(cur => (cur?.finished ? null : cur)), 6000);
  }, []);

  const deleteTracks = useCallback(async ids => {
    const set = new Set(ids);
    const remaining = tracksRef.current.filter(t => !set.has(t.id));
    const remainingKeys = new Set(remaining.map(t => t.albumKey));
    const goneKeys = [...new Set(tracksRef.current.filter(t => set.has(t.id)).map(t => t.albumKey))]
      .filter(k => !remainingKeys.has(k));
    await db.deleteTracks(ids, goneKeys);
    setTracks(remaining);
    setCoverUrls(u => {
      const copy = { ...u };
      for (const k of goneKeys) {
        if (copy[k]) URL.revokeObjectURL(copy[k]);
        delete copy[k];
      }
      return copy;
    });
    // scrub playlists
    setPlaylists(pls => {
      const out = pls.map(pl => {
        const trackIds = pl.trackIds.filter(id => !set.has(id));
        if (trackIds.length !== pl.trackIds.length) {
          const upd = { ...pl, trackIds };
          db.putPlaylist(upd);
          return upd;
        }
        return pl;
      });
      return out;
    });
  }, []);

  const createPlaylist = useCallback(async name => {
    const pl = { id: crypto.randomUUID(), name: name.trim() || 'Playlist', trackIds: [], createdAt: Date.now() };
    await db.putPlaylist(pl);
    setPlaylists(p => [...p, pl]);
    return pl;
  }, []);

  const renamePlaylist = useCallback(async (id, name) => {
    setPlaylists(pls => pls.map(pl => {
      if (pl.id !== id) return pl;
      const upd = { ...pl, name: name.trim() || pl.name };
      db.putPlaylist(upd);
      return upd;
    }));
  }, []);

  const deletePlaylist = useCallback(async id => {
    await db.removePlaylist(id);
    setPlaylists(pls => pls.filter(pl => pl.id !== id));
  }, []);

  const addToPlaylist = useCallback(async (id, ids) => {
    setPlaylists(pls => pls.map(pl => {
      if (pl.id !== id) return pl;
      const have = new Set(pl.trackIds);
      const upd = { ...pl, trackIds: [...pl.trackIds, ...ids.filter(x => !have.has(x))] };
      db.putPlaylist(upd);
      return upd;
    }));
  }, []);

  const removeFromPlaylist = useCallback(async (id, trackId) => {
    setPlaylists(pls => pls.map(pl => {
      if (pl.id !== id) return pl;
      const upd = { ...pl, trackIds: pl.trackIds.filter(x => x !== trackId) };
      db.putPlaylist(upd);
      return upd;
    }));
  }, []);

  const trackMap = useMemo(() => Object.fromEntries(tracks.map(t => [t.id, t])), [tracks]);

  const albums = useMemo(() => {
    const map = new Map();
    for (const t of tracks) {
      let a = map.get(t.albumKey);
      if (!a) {
        a = { key: t.albumKey, album: t.album, artist: t.albumArtist, year: t.year, tracks: [] };
        map.set(t.albumKey, a);
      }
      if (!a.year && t.year) a.year = t.year;
      a.tracks.push(t);
    }
    return [...map.values()];
  }, [tracks]);

  const artists = useMemo(() => {
    const map = new Map();
    for (const al of albums) {
      const name = al.artist;
      let a = map.get(name.toLowerCase());
      if (!a) { a = { name, albums: [] }; map.set(name.toLowerCase(), a); }
      a.albums.push(al);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [albums]);

  const value = {
    ready, tracks, trackMap, albums, artists, coverUrls, artistPicUrls, playlists, importing,
    importFiles, deleteTracks, setArtistPic, removeArtistPic,
    createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
