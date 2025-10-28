export interface AuthResponse {
  access_token: string;
  token_type: string;
  role?: string;
  must_change_password?: boolean;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}