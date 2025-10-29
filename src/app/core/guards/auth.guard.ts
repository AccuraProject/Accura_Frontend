import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { SessionActions } from '../store/session/session.actions';
import { selectSessionIsAuthenticated, selectSessionRole } from '../store/session/session.selectors';

type AllowedRole = 'admin' | 'user';

export const authGuard: CanActivateFn = (route) => {
  const store = inject(Store);
  const router = inject(Router);

  return combineLatest([
    store.select(selectSessionIsAuthenticated),
    store.select(selectSessionRole),
  ]).pipe(
    take(1),
    map(([isAuthenticated, role]) => {
      if (isAuthenticated && role) {
        if (!isAllowedRole(role)) {
          logout(store);
          return createLoginUrlTree(router);
        }

        return ensureRoleAccess(route, role, router);
      }

      return createLoginUrlTree(router);
    })
  );
};

function createLoginUrlTree(router: Router): UrlTree {
  return router.createUrlTree(['/login']);
}

function isAllowedRole(role: string): role is AllowedRole {
  return role === 'admin' || role === 'user';
}

function ensureRoleAccess(
  route: ActivatedRouteSnapshot,
  role: AllowedRole,
  router: Router,
): boolean | UrlTree {
  const requiredRoles = resolveRequiredRoles(route);

  if (!requiredRoles || requiredRoles.length === 0 || requiredRoles.includes(role)) {
    return true;
  }

  return router.createUrlTree(['/']);
}

function resolveRequiredRoles(route: ActivatedRouteSnapshot): AllowedRole[] | undefined {
  let target: ActivatedRouteSnapshot | null = route;

  while (target?.firstChild) {
    target = target.firstChild;
  }

  const roles = target?.data?.['roles'];

  if (!Array.isArray(roles)) {
    return undefined;
  }

  return roles.filter(isAllowedRole);
}

function logout(store: Store): void {
  store.dispatch(SessionActions.logout());
}
