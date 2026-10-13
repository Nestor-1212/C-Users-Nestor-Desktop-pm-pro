import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { driver, Driver } from 'driver.js';
import { AuthService } from '../../core/services/auth.service';

export type TourId = 'inicio' | 'proyectos' | 'proyecto' | 'soporte' | 'aprende';

export interface TourStep {
  /** Selector del elemento a resaltar; sin él, la burbuja sale centrada. */
  element?: string;
  title: string;
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Acción previa para que el elemento exista (abrir un formulario, cambiar de pestaña…). */
  before?: () => void;
  /** Oculta "Anterior" (p. ej. dentro de un modal que no se puede deshacer). */
  noBack?: boolean;
}

export interface TourDef {
  id: TourId;
  steps: TourStep[];
  /** Selector que indica que la pantalla terminó de cargar. */
  ready?: string;
  onEnd?: () => void;
}

/** Existe, tiene tamaño y está dentro del ancho de la pantalla (el menú del celular se esconde desplazándolo). */
const visible = (selector: string) => {
  const r = document.querySelector(selector)?.getBoundingClientRect();
  return !!r && r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
};

/** Espera a que un elemento esté visible (p. ej. el modal tras abrirlo). */
function waitFor(selector: string, timeout = 4000): Promise<boolean> {
  return new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      if (visible(selector)) resolve(true);
      else if (Date.now() - start > timeout) resolve(false);
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * Guías sobre la pantalla real (driver.js) para los módulos del cliente.
 * Cada pantalla se "engancha" con `attach`: la guía arranca sola la primera
 * vez que el usuario entra, y el botón "Guía" de la barra superior la repite.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private auth = inject(AuthService);
  private active: Driver | null = null;
  private activeId: TourId | null = null;

  /** Guía de la pantalla actual (la usa el botón "Guía" del encabezado). */
  readonly current = signal<(() => void) | null>(null);

  private seenKey(id: TourId) { return `pmpro_tour_${id}_${this.auth.currentUser()?.id ?? 'anon'}`; }

  hasSeen(id: TourId): boolean {
    try { return localStorage.getItem(this.seenKey(id)) === '1'; } catch { return true; }
  }

  private markSeen(id: TourId) {
    try { localStorage.setItem(this.seenKey(id), '1'); } catch { /* opcional */ }
  }

  /** Registra la guía de una pantalla del cliente y la arranca si es su primera visita. */
  attach(destroyRef: DestroyRef, id: TourId, start: () => void, opts: { auto?: boolean } = {}) {
    if (!this.auth.isClient()) return;
    this.current.set(start);
    if (opts.auto !== false && !this.hasSeen(id)) queueMicrotask(start);
    destroyRef.onDestroy(() => {
      if (this.current() === start) this.current.set(null);
      if (this.activeId === id) this.stop();
    });
  }

  async run(def: TourDef) {
    this.stop();
    if (def.ready) await waitFor(def.ready, 8000);

    // Los pasos anteriores a la primera acción `before` ya deberían estar en
    // pantalla: si no están (lista vacía, celular…), se quitan para que el
    // contador "x de y" sea exacto. Los posteriores se comprueban al llegar.
    const firstLazy = def.steps.findIndex(s => s.before);
    const steps = def.steps.filter((s, i) => (firstLazy >= 0 && i >= firstLazy) || !s.element || visible(s.element));
    if (!steps.length) return;

    const go = async (from: number, dir: 1 | -1) => {
      for (let j = from + dir; j >= 0 && j < steps.length; j += dir) {
        const s = steps[j];
        s.before?.();
        if (!s.element || await waitFor(s.element, 1500)) { d.moveTo(j); return; }
      }
      if (dir > 0) d.destroy();
    };

    const d = driver({
      steps: steps.map((s, i) => ({
        element: s.element,
        popover: {
          title: s.title,
          description: s.text,
          side: s.side,
          align: s.align ?? 'start',
          ...(s.noBack ? { showButtons: ['next', 'close'] as ('next' | 'close')[] } : {}),
          onNextClick: () => { go(i, 1); },
          onPrevClick: () => { go(i, -1); },
        },
      })),
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Entendido',
      popoverClass: 'pm-tour',
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      smoothScroll: true,
      onDestroyed: () => {
        this.active = null; this.activeId = null;
        this.markSeen(def.id);
        def.onEnd?.();
      },
    });
    this.active = d;
    this.activeId = def.id;
    d.drive(0);
  }

  stop() { this.active?.destroy(); }
}
