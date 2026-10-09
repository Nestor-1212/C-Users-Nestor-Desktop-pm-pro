export const API_BASE_URL = 'http://localhost:3000';
export const API_URL = `${API_BASE_URL}/api/v1`;

/** La API devuelve rutas relativas de archivos (/uploads/...); el navegador necesita la URL completa. */
export function fileUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return /^https?:\/\//.test(path) ? path : API_BASE_URL + path;
}
