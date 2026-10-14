import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  router.navigate(['/login']);
  return false;
};

/** El dashboard no es para el técnico: su punto de entrada son los tickets. */
export const notTechnicianGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isTechnician()) return true;
  router.navigate(['/tickets']);
  return false;
};

export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isOwner()) return true;
  router.navigate(['/dashboard']);
  return false;
};

/** Un colaborador interno solo entra a las solicitudes internas: cualquier otra ruta lo lleva ahí. */
export const collaboratorScopeGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isCollaborator() || state.url.startsWith('/internas')) return true;
  return router.createUrlTree(['/internas']);
};

/** Solicitudes internas: personal con departamento y el Propietario. */
export const internalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.canUseInternal()) return true;
  return router.createUrlTree([auth.isTechnician() ? '/tickets' : '/dashboard']);
};
