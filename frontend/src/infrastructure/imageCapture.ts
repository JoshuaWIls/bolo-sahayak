import type { DocumentImage } from '../domain/types';

/**
 * Shrinks a camera photo before upload: phone photos are 3–12 MB, the model
 * only needs ~1600px to read a form, and rural networks are slow.
 * Re-encoding through a canvas also strips EXIF (GPS location etc.).
 */
export async function prepareImage(file: File, maxSide = 1600, quality = 0.85): Promise<DocumentImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { mediaType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
  } finally {
    bitmap.close();
  }
}
