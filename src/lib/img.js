// Center-crops an image file to a square and downscales it so custom artist
// photos stay small in IndexedDB. Falls back to the original file if the
// browser can't decode it.
export async function downscaleSquare(file, size = 512) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    bmp.close?.();
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob || file;
  } catch {
    return file;
  }
}
