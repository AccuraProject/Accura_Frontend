import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { SessionActions } from '../store/session/session.actions';
import {
  SessionSnapshot,
  SessionState,
  createSnapshotFromState,
  selectSessionState,
} from '../store/session/session.reducer';

@Injectable({
  providedIn: 'root',
})
export class SessionPersistenceService {
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storageKey = 'session';
  private readonly isStorageAvailable = this.checkSessionStorageAvailability();
  private initialized = false;

  initialize(): void {
    if (this.initialized || !this.isStorageAvailable) {
      this.initialized = true;
      return;
    }

    this.initialized = true;

    const snapshot = this.readSnapshot();
    if (snapshot) {
      this.store.dispatch(SessionActions.restoreSession({ session: snapshot }));
    }

    this.store
      .select(selectSessionState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state: SessionState) => this.persistState(state));
  }

  private persistState(state: SessionState): void {
    if (!state.isAuthenticated) {
      this.clearSnapshot();
      return;
    }

    const snapshot = createSnapshotFromState(state);
    this.writeSnapshot(snapshot);
  }

  private readSnapshot(): SessionSnapshot | null {
    const raw = window.sessionStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as SessionSnapshot | null;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }

      this.clearSnapshot();
      return null;
    } catch {
      this.clearSnapshot();
      return null;
    }
  }

  private writeSnapshot(snapshot: SessionSnapshot): void {
    window.sessionStorage.setItem(this.storageKey, JSON.stringify(snapshot));
  }

  private clearSnapshot(): void {
    window.sessionStorage.removeItem(this.storageKey);
  }

  private checkSessionStorageAvailability(): boolean {
    if (typeof window === 'undefined' || !('sessionStorage' in window)) {
      return false;
    }

    try {
      const testKey = '__session_persistence_test__';
      window.sessionStorage.setItem(testKey, '1');
      window.sessionStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}
