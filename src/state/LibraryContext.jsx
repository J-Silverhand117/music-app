import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as db from '../lib/db';
import { parseFlac, trackFromMeta } from '../lib/flac';
import { parseMediaTags } from '../lib/tags';
import { AUDIO_RE, VIDEO_RE, probeDuration, probeVideo } from '../lib/media';
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
  const [videos, setVideos] = useState([]);
  const [coverUrls, setCoverUrls] = useState({});
  const [thumbUrls, setThumbUrls] = useState({});
  const [artistPicUrls, setArtistPicUrls] = useState({});
  const [playlistPicUrls, setPlaylistPicUrls] = useState({});
  const [playlists, setPlaylists] = useState([]);
  const [importing, setImporting] = useState(null); // {done,total,current,errors,finished}
  const [ready, setReady] = useState(false);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const videosRef = useRef(videos);
  videosRef.current = videos;

  useEffect(() => {
    (async () => {
      const [ts, vids, pls, covers, pics, plPics, thumbs] = await Promise.all([
        db.getTracks(), db.getVideos(), db.getPlaylists(), db.getAllCovers(),
        db.getAllArtistPics(), db.getAllPlaylistPics(), db.getAllThumbs()
      ]);
      setTracks(ts.sort(byAlbumOrder));
      setVideos(vids.sort((a, b) => a.title.localeCompare(b.title)));
      const tUrls = {};
      for (const [k, blob] of thumbs) if (blob) tUrls[k] = URL.createObjectURL(blob);
      setThumbUrls(tUrls);
      setPlaylists(pls.sort((a, b) => a.createdAt - b.createdAt));
      const urls = {};
      for (const [k, blob] of covers) if (blob) urls[k] = URL.createObjectURL(blob);
      setCoverUrls(urls);
      const picUrls = {};
      for (const [k, blob] of pics) if (blob) picUrls[k] = URL.createObjectURL(blob);
      setArtistPicUrls(picUrls);
      const plPicUrls = {};
      for (const [k, blob] of plPics) if (blob) plPicUrls[k] = URL.createObjectURL(blob);
      setPlaylistPicUrls(plPicUrls);
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

  const setPlaylistPic = useCallback(async (id, file) => {
    const blob = await downscaleSquare(file);
    await db.putPlaylistPic(id, blob);
    setPlaylistPicUrls(u => {
      if (u[id]) URL.revokeObjectURL(u[id]);
      return { ...u, [id]: URL.createObjectURL(blob) };
    });
  }, []);

  const removePlaylistPic = useCallback(async id => {
    await db.deletePlaylistPic(id);
    setPlaylistPicUrls(u => {
      if (!u[id]) return u;
      URL.revokeObjectURL(u[id]);
      const copy = { ...u };
      delete copy[id];
      return copy;
    });
  }, []);

  // Accepts either a flat array/FileList of File objects, or an array of
  // { file, path } entries (see lib/scan.js) produced by a folder picker or
  // a recursive drag-and-drop of directories. Audio goes to the music library,
  // video files to the Videos tab; anything else inside a scanned folder
  // (cover.jpg, .cue, .log, etc.) is skipped silently. Returns the ids of
  // what was added so callers (e.g. OS "open with") can start playback.
  const importFiles = useCallback(async rawList => {
    const entries = [...rawList].map(e =>
      e instanceof File ? { file: e, path: e.webkitRelativePath || e.name } : e
    );
    const files = entries.filter(({ file: f }) => AUDIO_RE.test(f.name) || VIDEO_RE.test(f.name));
    const lrcEntries = entries.filter(({ file: f }) => /\.lrc$/i.test(f.name));
    if (!files.length && !lrcEntries.length) return { audioIds: [], videoIds: [] };

    // ask the browser to never evict our IndexedDB data
    try { await navigator.storage?.persist?.(); } catch { /* best effort */ }

    const errors = [];
    const existing = new Set([
      ...tracksRef.current.map(t => `${t.filePath || t.fileName}|${t.size}`),
      ...videosRef.current.map(v => `${v.filePath || v.fileName}|${v.size}`)
    ]);
    const addedTracks = [];
    const addedVideos = [];
    const newCovers = {};
    const newThumbs = {};
    for (let i = 0; i < files.length; i++) {
      const { file: f, path } = files[i];
      setImporting({ done: i, total: files.length, current: f.name, errors, finished: false });
      try {
        const sig = `${path}|${f.size}`;
        if (existing.has(sig)) { errors.push(`${path} — already in library`); continue; }
        if (VIDEO_RE.test(f.name)) {
          const [tagMeta, probe] = [await parseMediaTags(f), await probeVideo(f)];
          const video = {
            id: crypto.randomUUID(),
            title: tagMeta.tags.TITLE || f.name.replace(/\.[^.]+$/, ''),
            duration: probe.duration || tagMeta.duration || 0,
            width: probe.width,
            height: probe.height,
            fileName: f.name,
            filePath: path,
            size: f.size,
            addedAt: Date.now()
          };
          await db.addVideo(video, f, probe.thumb);
          if (probe.thumb) newThumbs[video.id] = URL.createObjectURL(probe.thumb);
          existing.add(sig);
          addedVideos.push(video);
        } else {
          const meta = /\.flac$/i.test(f.name) ? await parseFlac(f) : await parseMediaTags(f);
          if (!meta.duration) meta.duration = await probeDuration(f);
          const track = trackFromMeta(f, meta, path);
          const coverAdded = await db.addTrack(track, f, meta.picture);
          if (coverAdded && meta.picture) newCovers[track.albumKey] = URL.createObjectURL(meta.picture);
          existing.add(sig);
          addedTracks.push(track);
        }
      } catch (e) {
        errors.push(`${path} — ${e.message}`);
      }
    }
    // match .lrc lyric files to tracks (same path or same filename, minus extension)
    let lyricsAdded = 0;
    if (lrcEntries.length) {
      const stripExt = s => String(s).replace(/\.[^.]+$/, '').toLowerCase();
      const all = [...tracksRef.current, ...addedTracks];
      for (const { file: f, path } of lrcEntries) {
        // matches both "Song.lrc" and "Song.flac.lrc" naming, path first then bare filename
        const byPath = stripExt(path);
        const byName = stripExt(f.name);
        const pathNoLrc = path.replace(/\.lrc$/i, '').toLowerCase();
        const nameNoLrc = f.name.replace(/\.lrc$/i, '').toLowerCase();
        const track =
          all.find(t => stripExt(t.filePath || t.fileName) === byPath) ||
          all.find(t => (t.filePath || t.fileName).toLowerCase() === pathNoLrc) ||
          all.find(t => stripExt(t.fileName) === byName) ||
          all.find(t => t.fileName.toLowerCase() === nameNoLrc);
        if (track) {
          try {
            await db.putLyrics(track.id, await f.text());
            lyricsAdded++;
          } catch (e) {
            errors.push(`${path} — ${e.message}`);
          }
        } else {
          errors.push(`${path} — no matching track for lyrics`);
        }
      }
    }
    if (addedTracks.length) {
      setTracks(ts => [...ts, ...addedTracks].sort(byAlbumOrder));
      setCoverUrls(u => ({ ...u, ...newCovers }));
    }
    if (addedVideos.length) {
      setVideos(vs => [...vs, ...addedVideos].sort((a, b) => a.title.localeCompare(b.title)));
      setThumbUrls(u => ({ ...u, ...newThumbs }));
    }
    setImporting({
      done: files.length, total: Math.max(files.length, 1), current: '', errors, finished: true,
      added: addedTracks.length + addedVideos.length, lyrics: lyricsAdded
    });
    setTimeout(() => setImporting(cur => (cur?.finished ? null : cur)), 6000);
    return { audioIds: addedTracks.map(t => t.id), videoIds: addedVideos.map(v => v.id) };
  }, []);

  const deleteVideos = useCallback(async ids => {
    await db.deleteVideos(ids);
    const set = new Set(ids);
    setVideos(vs => vs.filter(v => !set.has(v.id)));
    setThumbUrls(u => {
      const copy = { ...u };
      for (const id of ids) {
        if (copy[id]) URL.revokeObjectURL(copy[id]);
        delete copy[id];
      }
      return copy;
    });
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
    await db.deletePlaylistPic(id);
    setPlaylists(pls => pls.filter(pl => pl.id !== id));
    setPlaylistPicUrls(u => {
      if (!u[id]) return u;
      URL.revokeObjectURL(u[id]);
      const copy = { ...u };
      delete copy[id];
      return copy;
    });
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
    const list = [...map.values()];
    // classify releases as album vs single/EP:
    // 1. a "Singles & EPs"-style folder in the import path always wins;
    // 2. names ending in EP/(Single) count as singles;
    // 3. otherwise, folder-organized releases are albums, and folderless
    //    imports fall back to the ≤3-tracks heuristic.
    const SINGLE_SEG = /^(singles?|eps?|singles?\s*(&|and|\+)\s*eps?)$/i;
    const SINGLE_NAME = /(\s|\()ep\)?\s*$|(\s|\()single\)?\s*$|-\s*(ep|single)\s*$/i;
    for (const a of list) {
      const hasFolders = a.tracks.some(t => (t.filePath || '').includes('/'));
      const folderHit = a.tracks.some(t =>
        (t.filePath || '').split('/').slice(1, -1).some(seg => SINGLE_SEG.test(seg.trim()))
      );
      const nameHit = SINGLE_NAME.test(a.album);
      a.kind = folderHit || nameHit
        ? 'single'
        : hasFolders
          ? 'album'
          : a.tracks.length <= 3
            ? 'single'
            : 'album';
    }
    return list;
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
    ready, tracks, trackMap, albums, artists, videos, coverUrls, thumbUrls,
    artistPicUrls, playlistPicUrls, playlists, importing,
    importFiles, deleteTracks, deleteVideos, setArtistPic, removeArtistPic,
    setPlaylistPic, removePlaylistPic,
    createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
