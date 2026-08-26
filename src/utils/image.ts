// Downscales a screenshot and encodes it as a JPEG data URL for the vision AI
// review path. Runs only in the browser (uses <canvas>); resolves to '' if the
// image can't be read/encoded so callers can fall back to text-only review.
const MAX_DIMENSION = 1600; // longest edge; keeps small text legible while capping payload
const JPEG_QUALITY = 0.82;

export const imageToDataUrl = (
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY,
): Promise<string> =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return resolve('');
      context.drawImage(image, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve('');
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve('');
    };

    image.src = objectUrl;
  });
