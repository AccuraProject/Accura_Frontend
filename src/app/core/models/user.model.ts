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

export interface UserDetail {
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

export type UserResponse = UserDetail;
export type CurrentUserResponse = UserDetail;

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  current_password?: string;
  role_id?: number;
  is_active?: boolean;
}

export interface ResetPasswordPayload {
  password: string;
}
