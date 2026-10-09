import { IconName } from '../icon/icon.component';

const ICON_BY_EXT: Record<string, IconName> = {
  pdf: 'file-text', doc: 'file-text', docx: 'file-text',
  xls: 'file-text', xlsx: 'file-text',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  zip: 'archive', rar: 'archive'
};

export function fileIcon(type: string): IconName {
  return ICON_BY_EXT[type.toLowerCase()] || 'paperclip';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Deben coincidir con los límites de la API (pm-pro-api/src/middleware/upload.middleware.ts).
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
