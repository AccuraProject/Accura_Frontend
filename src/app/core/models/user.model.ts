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
