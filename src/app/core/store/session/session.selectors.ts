import { createSelector } from '@ngrx/store';

import {
  selectIsAuthenticated,
  selectMustChangePassword,
  selectRole,
  selectSessionState,
  SessionState,
} from './session.reducer';

export const selectSession = selectSessionState;
export const selectSessionRole = selectRole;
export const selectSessionIsAuthenticated = selectIsAuthenticated;
export const selectSessionMustChangePassword = selectMustChangePassword;

export const selectIsAdmin = createSelector(selectRole, (role: SessionState['role']) => role === 'admin');
