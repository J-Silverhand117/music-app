// IndexedDB layer. Everything the app needs offline lives here:
// raw FLAC blobs, parsed metadata, cover art blobs, playlists, prefs.
import { openDB } from 'idb';

let dbp;
function db() {
  return (dbp ??= openDB('nothing-sound', 2, {
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
  const tx = d.transaction(['tracks', 'audio', 'covers'], 'readwrite');
  for (const id of ids) {
    tx.objectStore('tracks').delete(id);
    tx.objectStore('audio').delete(id);
  }
  for (const key of coverKeys) tx.objectStore('covers').delete(key);
  await tx.done;
}

export async function getAllArtistPics() {
  const d = await db();
  const [keys, vals] = await Promise.all([d.getAllKeys('artistPics'), d.getAll('artistPics')]);
  return keys.map((k, i) => [k, vals[i]]);
}
export const putArtistPic = async (key, blob) => (await db()).put('artistPics', blob, key);
export const deleteArtistPic = async key => (await db()).delete('artistPics', key);

export const getPlaylists = async () => (await db()).getAll('playlists');
export const putPlaylist = async pl => (await db()).put('playlists', pl);
export const removePlaylist = async id => (await db()).delete('playlists', id);

export const getPref = async key => (await db()).get('prefs', key);
export const setPref = async (key, value) => (await db()).put('prefs', value, key);
