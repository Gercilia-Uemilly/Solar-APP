/**
 * Compress an image file to JPEG with reduced dimensions.
 * Only compresses if > 500KB and is an image type.
 */
export function comprimirImagem(file: File, maxWidth = 1200): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") || file.size <= 500 * 1024) {
      resolve(file);
      return;
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) { resolve(file); return; }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
          // Only use compressed if it's actually smaller
          resolve(compressed.size < file.size ? compressed : file);
        },
        "image/jpeg",
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
