import { Directive, ElementRef, EventEmitter, Output, inject, AfterViewInit, OnDestroy, HostListener } from '@angular/core';

/**
 * Directiva ligera de accesibilidad para modales (sin depender de Angular
 * CDK, que no esta instalado en el proyecto):
 * - Guarda el elemento con foco antes de abrir el modal y se lo devuelve al cerrarlo.
 * - Mueve el foco al primer control interactivo del modal al abrirse.
 * - Atrapa la tecla Tab / Shift+Tab dentro del modal.
 * - Emite `closeRequested` al presionar Escape, para que el componente padre
 *   decida como cerrar (normalmente llamando a su propio `closeModal()`).
 *
 * Uso: `<div class="modal" appModalFocusTrap (closeRequested)="closeModal()">`
 */
@Directive({
  selector: '[appModalFocusTrap]',
  standalone: true
})
export class ModalFocusTrapDirective implements AfterViewInit, OnDestroy {
  @Output() closeRequested = new EventEmitter<void>();

  private el = inject(ElementRef) as ElementRef<HTMLElement>;
  private previouslyFocused: HTMLElement | null = null;

  private readonly focusableSelector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  ngAfterViewInit() {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => {
      const focusables = this.getFocusable();
      (focusables[0] ?? this.el.nativeElement).focus();
    });
  }

  ngOnDestroy() {
    this.previouslyFocused?.focus?.();
  }

  @HostListener('keydown.escape', ['$event'])
  onEscape(event: Event) {
    event.stopPropagation();
    this.closeRequested.emit();
  }

  @HostListener('keydown.tab', ['$event'])
  onTab(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    const focusables = this.getFocusable();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (keyboardEvent.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private getFocusable(): HTMLElement[] {
    return Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>(this.focusableSelector))
      .filter(node => node.offsetParent !== null);
  }
}
