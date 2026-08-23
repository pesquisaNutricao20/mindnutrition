export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/bmp', 'image/svg+xml'];
export const MAX_IMAGE_SIZE_MB = 12;
export const MAX_MEAL_PHOTOS = 6;
export const DEFAULT_PROFILE_PHOTO = '';

const compressImage = (dataUrl: string, maxWidth = 1200, maxHeight = 1200, quality = 0.82): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = async () => {
    const rawDataUrl = reader.result as string;
    try {
      const compressed = await compressImage(rawDataUrl);
      resolve(compressed);
    } catch {
      resolve(rawDataUrl);
    }
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export async function readValidatedImages(files: FileList | null, currentCount = 0) {
  if (!files || files.length === 0) return { images: [] as string[], error: '' };
  const selected = Array.from(files);
  if (currentCount + selected.length > MAX_MEAL_PHOTOS) {
    return { images: [] as string[], error: `Adicione no máximo ${MAX_MEAL_PHOTOS} fotos por refeição.` };
  }
  const invalid = selected.find(file => file.type && !file.type.startsWith('image/'));
  if (invalid) {
    return { images: [] as string[], error: 'Selecione apenas arquivos de imagem válidos (JPG, PNG, WEBP).' };
  }
  const tooLarge = selected.find(file => file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024);
  if (tooLarge) {
    return { images: [] as string[], error: `Cada imagem deve ter até ${MAX_IMAGE_SIZE_MB}MB.` };
  }
  try {
    const loadedImages = await Promise.all(selected.map(readFileAsDataUrl));
    return { images: loadedImages, error: '' };
  } catch (err) {
    return { images: [] as string[], error: 'Não foi possível carregar as imagens selecionadas. Tente novamente.' };
  }
}

