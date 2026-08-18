const AVATAR_MAX_SIDE = 256;

export function isDataAvatar(value: string | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

export function dataUrlBytes(url: string) {
  const comma = url.indexOf(',');
  return comma < 0 ? 0 : Math.ceil((url.length - comma - 1) * 3 / 4);
}

export async function compressAvatar(input: Blob, maxSide = AVATAR_MAX_SIDE): Promise<string> {
  const objectUrl = URL.createObjectURL(input);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The image could not be read.'));
      img.src = objectUrl;
    });
    const naturalSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, maxSide / naturalSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}