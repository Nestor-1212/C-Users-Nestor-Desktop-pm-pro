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

export const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024; // 2MB, razonable para localStorage
