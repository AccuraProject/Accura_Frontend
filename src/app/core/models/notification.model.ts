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
