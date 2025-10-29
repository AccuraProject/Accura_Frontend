import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { AuthResponse } from '../../models/auth-response.model';
import { CurrentUserResponse } from '../../models/user.model';
import type { SessionSnapshot } from './session.reducer';

export const SessionActions = createActionGroup({
  source: 'Session',
  events: {
    'Login Success': props<{ response: AuthResponse }>(),
    'Restore Session': props<{ session: SessionSnapshot }>(),
    'Load Current User Success': props<{ user: CurrentUserResponse }>(),
    Logout: emptyProps(),
  },
});
