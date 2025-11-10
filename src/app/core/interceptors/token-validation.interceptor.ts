import { HttpBackend, HttpClient, HttpErrorResponse, HttpHeaders, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, catchError, switchMap, take, throwError } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

import { environment } from '../../../environments/environment';
import { SessionActions } from '../store/session/session.actions';
import { selectSessionState } from '../store/session/session.reducer';
import { SessionExpiredDialogComponent } from '../components/session-expired-dialog/session-expired-dialog.component';

interface TokenValidationResponse {
  is_valid: boolean;
}

const API_BASE_URL = environment.apiBaseUrl.replace(/\/$/, '');
const VALIDATE_TOKEN_ENDPOINT = `${API_BASE_URL}/auth/validate-token`;
const PUBLIC_ENDPOINTS = new Set([
  `${API_BASE_URL}/auth/token`,
  `${API_BASE_URL}/auth/forgot-password`,
  `${API_BASE_URL}/auth/reset-password`,
  VALIDATE_TOKEN_ENDPOINT,
]);

let sessionInvalidationInProgress = false;

export const tokenValidationInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url) || isPublicEndpoint(req.url)) {
    return next(req);
  }

  const store = inject(Store);
  const router = inject(Router);
  const dialog = inject(MatDialog);
  const httpBackend = inject(HttpBackend);
  const rawHttpClient = new HttpClient(httpBackend);

  return store.select(selectSessionState).pipe(
    take(1),
    switchMap((session) => {
      if (!session.accessToken) {
        return next(req);
      }

      const tokenType = session.tokenType ?? 'Bearer';
      const authorizationHeader = `${tokenType} ${session.accessToken}`;
      const request = req.clone({
        setHeaders: {
          Authorization: authorizationHeader,
        },
      });

      return validateToken(rawHttpClient, authorizationHeader).pipe(
        switchMap((response) => {
          if (!response.is_valid) {
            handleInvalidSession(store, router, dialog);
            return throwError(() => new Error('Sesión expirada.'));
          }

          return next(request).pipe(
            catchError((error) => handleRequestError(error, store, router, dialog))
          );
        }),
        catchError((error) => handleValidationError(error, store, router, dialog))
      );
    })
  );
};

function validateToken(http: HttpClient, authorizationHeader: string): Observable<TokenValidationResponse> {
  const headers = new HttpHeaders({ Authorization: authorizationHeader });
  return http.get<TokenValidationResponse>(VALIDATE_TOKEN_ENDPOINT, { headers });
}

function handleValidationError(
  error: unknown,
  store: Store,
  router: Router,
  dialog: MatDialog,
): Observable<never> {
  if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
    handleInvalidSession(store, router, dialog);
    return throwError(() => new Error('Sesión expirada.'));
  }

  return throwError(() => error);
}

function handleRequestError(
  error: unknown,
  store: Store,
  router: Router,
  dialog: MatDialog,
): Observable<never> {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    handleInvalidSession(store, router, dialog);
  }

  return throwError(() => error);
}

let sessionInvalidationTimeoutId: ReturnType<typeof setTimeout> | null = null;
let sessionInvalidationDialogRef: MatDialogRef<SessionExpiredDialogComponent> | null = null;

function handleInvalidSession(store: Store, router: Router, dialog: MatDialog): void {
  if (sessionInvalidationInProgress) {
    return;
  }

  sessionInvalidationInProgress = true;

  store.dispatch(SessionActions.logout());

  sessionInvalidationDialogRef = dialog.open(SessionExpiredDialogComponent, {
    disableClose: true,
    panelClass: 'session-expired-dialog',
  });

  sessionInvalidationTimeoutId = setTimeout(() => {
    router
      .navigate(['/login'])
      .finally(() => {
        sessionInvalidationDialogRef?.close();
        sessionInvalidationDialogRef = null;
        sessionInvalidationTimeoutId = null;
        sessionInvalidationInProgress = false;
      });
  }, 5000);
}

function isApiRequest(url: string): boolean {
  return url.startsWith(API_BASE_URL);
}

function isPublicEndpoint(url: string): boolean {
  return PUBLIC_ENDPOINTS.has(url);
}
