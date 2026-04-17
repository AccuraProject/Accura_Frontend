export interface TemplateUserAccessResponse {
  id: number,
  template_id: number,
  user_id: number,
  start_date: Date,
  end_date: Date,
  revoked_at: Date,
  revoked_by: number,
  created_at: Date,
  updated_at: Date
}