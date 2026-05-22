export type RuleExample = Record<string, unknown>;

export interface RulePayload {
  'Nombre de la regla': string;
  'Tipo de dato': string;
  'Campo obligatorio': boolean;
  Header: string[];
  'Header rule': string[];
  'Mensaje de error': string;
  Descripción: string;
  Ejemplo: RuleExample;
  Regla: Record<string, unknown>;
}

export interface RuleResponse {
  rule: RulePayload;
  id: number;
  created_by: number;
  created_at: string;
  updated_by: number | null;
  updated_at: string | null;
  is_active: boolean;
  status: string;
  deleted: boolean;
  deleted_by: number | null;
  deleted_at: string | null;
}
