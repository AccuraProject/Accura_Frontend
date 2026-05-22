export interface LoadDetailLoad {
  id: number;
  template_id: number | null;
  user_id: number | null;
  status: string | null;
  file_name: string;
  total_rows: number;
  error_rows: number;
  report_path: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface LoadDetailTemplate {
  id: number;
  user_id: number | null;
  name: string;
  status: string | null;
  description: string | null;
  table_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_active: boolean;
  deleted: boolean;
  deleted_by: number | null;
  deleted_at: string | null;
}

export interface LoadDetailUser {
  id: number;
  name: string | null;
  email: string;
}

export interface LoadDetailResponseItem {
  load: LoadDetailLoad;
  template: LoadDetailTemplate | null;
  user: LoadDetailUser | null;
}
