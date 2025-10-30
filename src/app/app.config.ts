import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideStore, provideState } from '@ngrx/store';

import { routes } from './app.routes';
import { sessionFeature } from './core/store/session/session.reducer';
import { SessionPersistenceService } from './core/services/session-persistence.service';
import { provideStoreDevtools } from '@ngrx/store-devtools';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideStore(),
    provideState(sessionFeature),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeSessionPersistence,
      deps: [SessionPersistenceService],
    },
  ]
};

function initializeSessionPersistence(
  sessionPersistence: SessionPersistenceService,
): () => void {
  return () => sessionPersistence.initialize();
}
