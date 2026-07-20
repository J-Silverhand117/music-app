// IndexedDB layer. Everything the app needs offline lives here:
// raw FLAC blobs, parsed metadata, cover art blobs, playlists, prefs.
import { openDB } from 'idb';

let dbp;
function db() {
  return (dbp ??= openDB('nothing-sound', 5, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        const tracks = d.createObjectStore('tracks', { keyPath: 'id' });
        tracks.createIndex('albumKey', 'albumKey');
        d.createObjectStore('audio');     // id -> FLAC blob
        d.createObjectStore('covers');    // albumKey -> image blob
        d.createObjectStore('playlists', { keyPath: 'id' });
        d.createObjectStore('prefs');     // key -> value
      }
      if (oldVersion < 2) {
        d.createObjectStore('artistPics'); // artistName(lower) -> image blob
      }
      if (oldVersion < 3) {
        d.createObjectStore('playlistPics'); // playlistId -> image blob
      }
      if (oldVersion < 4) {
        d.createObjectStore('videos', { keyPath: 'id' }); // video metadata
        d.createObjectStore('thumbs'); // videoId -> thumbnail blob
      }
      if (oldVersion < 5) {
        d.createObjectStore('lyrics'); // trackId -> raw .lrc text
      }
    }
  }));
}

export const getTracks = async () => (await db()).getAll('tracks');
export const getAudio = async id => (await db()).get('audio', id);

export async function getAllCovers() {
  const d = await db();
  const [keys, vals] = await Promise.all([d.getAllKeys('covers'), d.getAll('covers')]);
  return keys.map((k, i) => [k, vals[i]]);
}

export async function addTrack(track, audioBlob, coverBlob) {
  const d = await db();
  const tx = d.transaction(['tracks', 'audio', 'covers'], 'readwrite');
  tx.objectStore('tracks').put(track);
  tx.objectStore('audio').put(audioBlob, track.id);
  let coverAdded = false;
  if (coverBlob) {
    const existing = await tx.objectStore('covers').get(track.albumKey);
    if (!existing) {
      tx.objectStore('covers').put(coverBlob, track.albumKey);
      coverAdded = true;
    }
  }
  await tx.done;
  return coverAdded;
}

export async function deleteTracks(ids, coverKeys = []) {
  const d = await db();
  const tx = d.transaction(['tracks', 'audio', 'covers', 'lyrics'], 'readwrite');
  for (const id of ids) {
    tx.objectStore('tracks').delete(id);
    tx.objectStore('audio').delete(id);
    tx.objectStore('lyrics').delete(id);
  }
  for (const key of coverKeys) tx.objectStore('covers').delete(key);
  await tx.done;
}

export const getLyrics = async trackId => (await db()).get('lyrics', trackId);
export const putLyrics = async (trackId, text) => (await db()).put('lyrics', text, trackId);

export async function getAllArtistPics() {
  const d = await db();
  const [keys, vals] = await Promise.all([d.getAllKeys('artistPics'), d.getAll('artistPics')]);
  return keys.map((k, i) => [k, vals[i]]);
}
export const putArtistPic = async (key, blob) => (await db()).put('artistPics', blob, key);
export const deleteArtistPic = async key => (await db()).delete('artistPics', key);

export async function getAllPlaylistPics() {
  const d = await db();
  const [keys, vals] = await Promise.all([d.getAllKeys('playlistPics'), d.getAll('playlistPics')]);
  return keys.map((k, i) => [k, vals[i]]);
}
export const putPlaylistPic = async (id, blob) => (await db()).put('playlistPics', blob, id);
export const deletePlaylistPic = async id => (await db()).delete('playlistPics', id);

export const getVideos = async () => (await db()).getAll('videos');
export async function addVideo(video, blob, thumb) {
  const d = await db();
  const tx = d.transaction(['videos', 'audio', 'thumbs'], 'readwrite');
  tx.objectStore('videos').put(video);
  tx.objectStore('audio').put(blob, video.id);
  if (thumb) tx.objectStore('thumbs').put(thumb, video.id);
  await tx.done;
}
export async function deleteVideos(ids) {
  const d = await db();
  const tx = d.transaction(['videos', 'audio', 'thumbs'], 'readwrite');
  for (const id of ids) {
    tx.objectStore('videos').delete(id);
    tx.objectStore('audio').delete(id);
    tx.objectStore('thumbs').delete(id);
  }
  await tx.done;
}
export async function getAllThumbs() {
  const d = await db();
  const [keys, vals] = await Promise.all([d.getAllKeys('thumbs'), d.getAll('thumbs')]);
  return keys.map((k, i) => [k, vals[i]]);
}

export const getPlaylists = async () => (await db()).getAll('playlists');
export const putPlaylist = async pl => (await db()).put('playlists', pl);
export const removePlaylist = async id => (await db()).delete('playlists', id);

export const getPref = async key => (await db()).get('prefs', key);
export const setPref = async (key, value) => (await db()).put('prefs', value, key);
