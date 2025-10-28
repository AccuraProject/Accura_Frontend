import { createFeature, createReducer, on } from '@ngrx/store';

import { AuthResponse } from '../../models/auth-response.model';
import { SessionActions } from './session.actions';

export interface SessionState {
  accessToken: string | null;
  tokenType: string | null;
  role: string | null;
  mustChangePassword: boolean | null;
  isAuthenticated: boolean;
}

export type SessionSnapshot = Omit<SessionState, 'isAuthenticated'>;

const emptySnapshot: SessionSnapshot = {
  accessToken: null,
  tokenType: null,
  role: null,
  mustChangePassword: null,
};

const initialState: SessionState = createStateFromSnapshot(emptySnapshot);

const reducer = createReducer(
  initialState,
  on(
    SessionActions.loginSuccess,
    (_state: SessionState, { response }: { response: AuthResponse }): SessionState =>
      createStateFromSnapshot(mapResponseToSnapshot(response))
  ),
  on(
    SessionActions.restoreSession,
    (_state: SessionState, { session }: { session: SessionSnapshot }): SessionState =>
      createStateFromSnapshot(session)
  ),
  on(SessionActions.logout, (): SessionState => initialState)
);

export const sessionFeature = createFeature({
  name: 'session',
  reducer,
});

export const {
  name: sessionFeatureKey,
  reducer: sessionReducer,
  selectSessionState,
  selectAccessToken,
  selectTokenType,
  selectRole,
  selectMustChangePassword,
  selectIsAuthenticated,
} = sessionFeature;

function mapResponseToSnapshot(response: AuthResponse): SessionSnapshot {
  return {
    accessToken: response.access_token ?? null,
    tokenType: response.token_type ?? null,
    role: response.role ?? null,
    mustChangePassword:
      response.must_change_password === undefined ? null : response.must_change_password,
  };
}

function createStateFromSnapshot(snapshot: SessionSnapshot): SessionState {
  return {
    ...snapshot,
    isAuthenticated: Boolean(snapshot.accessToken),
  };
}

export function createEmptySessionSnapshot(): SessionSnapshot {
  return { ...emptySnapshot };
}

export function createSessionStateFromResponse(response: AuthResponse): SessionState {
  return createStateFromSnapshot(mapResponseToSnapshot(response));
}
