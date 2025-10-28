import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';
import { SessionActions } from '../store/session/session.actions';
import { selectSessionIsAuthenticated, selectSessionRole } from '../store/session/session.selectors';

export const authGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const authService = inject(AuthService);

  return combineLatest([
    store.select(selectSessionIsAuthenticated),
    store.select(selectSessionRole),
  ]).pipe(
    take(1),
    map(([isAuthenticated, role]) => {
      if (isAuthenticated) {
        if (role === 'admin') {
          return true;
        }

        authService.clearSession();
        store.dispatch(SessionActions.logout());
        return createLoginUrlTree(router);
      }

      const storedSession = authService.getStoredSession();
      if (storedSession) {
        store.dispatch(SessionActions.restoreSession({ session: storedSession }));

        if (storedSession.role === 'admin') {
          return true;
        }

        authService.clearSession();
        store.dispatch(SessionActions.logout());
      }

      return createLoginUrlTree(router);
    })
  );
};

function createLoginUrlTree(router: Router): UrlTree {
  return router.createUrlTree(['/login']);
}
