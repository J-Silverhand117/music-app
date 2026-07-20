// Turns a plain file picker, a webkitdirectory picker, or a drag-and-drop
// of folders into a flat list of { file, path } — path is the file's
// position inside the imported tree (e.g. "Artist/Album/01 Track.flac"),
// used as a metadata fallback when a FLAC's own tags are missing.

export function fromFileList(fileList) {
  return [...fileList].map(file => ({
    file,
    path: file.webkitRelativePath || file.name
  }));
}

function readAllEntries(reader) {
  return new Promise((resolve, reject) => {
    const all = [];
    const readBatch = () => {
      reader.readEntries(batch => {
        if (!batch.length) return resolve(all);
        all.push(...batch);
        readBatch(); // directory readers cap ~100 entries per call
      }, reject);
    };
    readBatch();
  });
}

async function walk(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, path: prefix + entry.name });
  } else if (entry.isDirectory) {
    const children = await readAllEntries(entry.createReader());
    for (const child of children) await walk(child, prefix + entry.name + '/', out);
  }
}

// Recursively expands folders dropped via drag-and-drop (Chrome/Edge/Firefox
// desktop support the FileSystem entry API; Safari/mobile fall back to a
// flat file list with no nested folders, which is still fine for single files).
export async function fromDataTransferItems(items) {
  const entries = [...items].map(it => it.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return null;
  const out = [];
  for (const entry of entries) await walk(entry, '', out);
  return out;
}
