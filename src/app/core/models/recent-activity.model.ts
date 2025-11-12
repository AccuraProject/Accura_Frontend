export interface RecentActivityEvent {
  event_id: string;
  event_type: string;
  summary: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}
