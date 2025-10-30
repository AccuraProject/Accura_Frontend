import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest } from 'rxjs';
import { map, take } from 'rxjs/operators';

import {
  selectSessionIsAuthenticated,
  selectSessionMustChangePassword,
} from '../store/session/session.selectors';

export const loginRedirectGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return combineLatest([
    store.select(selectSessionIsAuthenticated),
    store.select(selectSessionMustChangePassword),
  ]).pipe(
    take(1),
    map(([isAuthenticated, mustChangePassword]) => {
      if (!isAuthenticated) {
        return true;
      }

      if (mustChangePassword) {
        return router.createUrlTree(['/cambiar-contrasena']);
      }

      return router.createUrlTree(['/']);
    })
  );
};
