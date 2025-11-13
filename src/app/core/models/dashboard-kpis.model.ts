export interface DashboardKpis {
  active_users: {
    current_month: number;
    previous_month: number;
  };
  templates: {
    total?: number;
    published: number;
    unpublished: number;
    active?: number;
  };
  loads: {
    current_month: number;
    previous_month: number;
  };
  validations: {
    successful: number;
    total: number;
    effectiveness_percentage: number;
  };
}
