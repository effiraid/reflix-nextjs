export const MIN_THUMBNAIL_SIZE = 0;
export const MAX_THUMBNAIL_SIZE = 4;

export function clampThumbnailSize(size: number): number {
  return Math.min(MAX_THUMBNAIL_SIZE, Math.max(MIN_THUMBNAIL_SIZE, size));
}

export function getColumnCountFromThumbnailSize(size: number): number {
  return 5 - clampThumbnailSize(size);
}
