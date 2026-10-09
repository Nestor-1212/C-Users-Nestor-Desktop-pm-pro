import { HttpErrorResponse } from '@angular/common/http';

/** Mensaje legible para el usuario a partir de un error de la API (que ya responde en español). */
export function apiErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No se pudo conectar con el servidor. Verifica que la API esté en ejecución.';
    const message = err.error?.error;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

/** Carga en paralelo los datos que muestra una página; si algo falla, avisa con un toast. */
export function loadPageData(notify: { error(msg: string): void }, ...loads: Promise<unknown>[]): Promise<void> {
  return Promise.all(loads).then(() => undefined, err => notify.error(apiErrorMessage(err, 'No se pudieron cargar los datos.')));
}
