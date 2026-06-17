export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_MB = 4;
export const MAX_MEAL_PHOTOS = 6;
export const DEFAULT_PROFILE_PHOTO = '';

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export async function readValidatedImages(files: FileList | null, currentCount = 0) {
  if (!files || files.length === 0) return { images: [] as string[], error: '' };
  const selected = Array.from(files);
  if (currentCount + selected.length > MAX_MEAL_PHOTOS) {
    return { images: [] as string[], error: `Adicione no máximo ${MAX_MEAL_PHOTOS} fotos por refeição.` };
  }
  const invalid = selected.find(file => !ACCEPTED_IMAGE_TYPES.includes(file.type));
  if (invalid) {
    return { images: [] as string[], error: 'Use imagens JPG, PNG ou WEBP.' };
  }
  const tooLarge = selected.find(file => file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024);
  if (tooLarge) {
    return { images: [] as string[], error: `Cada imagem deve ter até ${MAX_IMAGE_SIZE_MB}MB.` };
  }
  return { images: await Promise.all(selected.map(readFileAsDataUrl)), error: '' };
}
