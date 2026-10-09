import { AbstractControl } from '@angular/forms';

/**
 * Determina si un control debe mostrarse como invalido en la UI.
 * Solo se considera "invalido visible" despues de que el usuario interactuo
 * con el campo (touched) o lo modifico (dirty) -- evita mostrar errores en
 * rojo apenas se abre un formulario vacio.
 */
export function isControlInvalid(control: AbstractControl | null | undefined): boolean {
  if (!control) return false;
  return control.invalid && (control.touched || control.dirty);
}
