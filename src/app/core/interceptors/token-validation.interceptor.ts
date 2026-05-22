import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, switchMap, take } from 'rxjs';
import { throwError } from 'rxjs';
import { DialogService } from 'primeng/dynamicdialog';  // Asegúrate de importar DialogService de PrimeNG
import { SessionExpiredDialogComponent } from '../components/session-expired-dialog/session-expired-dialog.component';
import { SessionExpiredService } from '../components/session-expired-dialog/session-expired.service';
import { SessionActions } from '../store/session/session.actions';
import { selectSessionState } from '../store/session/session.reducer';
import { environment } from '../../../environments/environment';

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

let sessionInvalidationTimeoutId: ReturnType<typeof setTimeout> | null = null;
let sessionInvalidationDialogRef: any | null = null;

export const tokenValidationInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url) || isPublicEndpoint(req.url)) {
    return next(req);
  }

  const store = inject(Store);
  const router = inject(Router);
  const dialogService = inject(DialogService);
  const sessionExpiredService = inject(SessionExpiredService);
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
            handleInvalidSession(store, router, dialogService, sessionExpiredService); // Llamamos al servicio para abrir el modal
            return throwError(() => new Error('Sesión expirada.'));
          }

          return next(request).pipe(
            catchError((error) => handleRequestError(error, store, router, dialogService, sessionExpiredService)),
          );
        }),
        catchError((error) => handleValidationError(error, store, router, dialogService, sessionExpiredService)),
      );
    }),
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
  dialogService: DialogService,
  sessionExpiredService: SessionExpiredService,
): Observable<never> {
  if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
    handleInvalidSession(store, router, dialogService, sessionExpiredService);
    return throwError(() => new Error('Sesión expirada.'));
  }

  return throwError(() => error);
}

function handleRequestError(
  error: unknown,
  store: Store,
  router: Router,
  dialogService: DialogService,
  sessionExpiredService: SessionExpiredService,
): Observable<never> {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    handleInvalidSession(store, router, dialogService, sessionExpiredService);
  }

  return throwError(() => error);
}

let sessionInvalidationInProgress = false;

function handleInvalidSession(
  store: Store,
  router: Router,
  dialogService: DialogService,
  sessionExpiredService: SessionExpiredService,
): void {
  if (sessionInvalidationInProgress) {
    return;
  }

  sessionInvalidationInProgress = true;

  store.dispatch(SessionActions.logout());

  sessionExpiredService.openSessionExpiredDialog();

  sessionInvalidationTimeoutId = setTimeout(() => {
    router.navigate(['/login']).finally(() => {
      sessionExpiredService.closeSessionExpiredDialog();
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