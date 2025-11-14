import { LoadDetailLoad, LoadDetailTemplate, LoadDetailUser } from './load-detail.model';

export interface NotificationEvent {
  id: number;
  user_id: number;
  event_type: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export interface NotificationUpdatesLoadEventData {
  event_type: string;
  stage: string;
  load: LoadDetailLoad;
  template: LoadDetailTemplate | null | undefined;
  user: LoadDetailUser | null | undefined;
}

export interface NotificationUpdatesNotificationEvent {
  type: 'notification';
  data: NotificationEvent[];
}

export interface NotificationUpdatesLoadEvent {
  type: 'load-event';
  data: NotificationUpdatesLoadEventData;
}

export type NotificationUpdatesEvent =
  | NotificationUpdatesNotificationEvent
  | NotificationUpdatesLoadEvent;
