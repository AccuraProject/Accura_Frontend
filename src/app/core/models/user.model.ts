export interface CreateUserPayload {
  name: string;
  email: string;
  role_id: number;
}

export interface CreatedUserResponse {
  id: number;
  name: string;
  email: string;
  role_id: number;
  is_active: boolean;
  temporary_password: string;
}

export interface UserRole {
  id: number;
  name: string;
  alias: string;
}

export interface UserCreatedByMeResponse {
  id: number;
  name: string;
  email: string;
  must_change_password: boolean;
  last_login: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  role: UserRole;
}
