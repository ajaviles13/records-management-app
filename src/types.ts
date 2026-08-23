export type RoleAccess = "Analyst" | "Manager" | "Administrator" | "Viewer";

export type DerivedStatus = "In-Review" | "Completed" | "On-Hold";

export interface LanguageCode {
  code_id: string;
  language: string;
  country: string;
}

export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  abbreviation: string;
  role_access: RoleAccess;
  last_login: string;
  created_at: string;
  profile_image: string;
}

export interface FileRecord {
  project_number: string;
  file_name: string;
  line_of_business: string;
  state: string;
  received_at_est: string;
  delivered_at_est: string;
  sla_met: string;
  is_urgent: string;
  qa_delivery_by: string;
  comment: string;
  status_hours: string;
  status_label: string;
  internal: string;
  dtp_1: string;
  new: string;
  fuzzy: string;
  total: string;
  dtp_2: string;
  pm: string;
  it_eng: string;
  qa: string;
  record_id: string;
  assigned_analyst_id: string;
  template_type: string;
  language_code: string;
  received_at_utc: string;
  delivered_at_utc: string;
  egnyte_direct_link: string;
  egnyte_file_path: string;
  egnyte_file_size_kb: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  artifact_id: string;
  old_field_value: string;
  new_field_value: string;
  trigger_source: string;
  user_id: string;
  event_type: string;
}

export interface DataDictionaryField {
  field_id: string;
  related_table_name: string;
  related_field_name: string;
  field_name_alias: string;
  type: string;
  max_char_length: string;
  is_required: string;
  description: string;
  is_linked_to_list: string;
  linked_table_name: string;
  linked_field_name: string;
}

export interface FieldOption {
  option_id: string;
  field_id: string;
  order: string;
  label: string;
  created_by: string;
  modified_by: string;
  created_at: string;
  modified_at: string;
}

export type ViewJoin = "AND" | "OR";

export type ViewOperator =
  | "any_of"
  | "none_of"
  | "is_set"
  | "is_not_set"
  | "is_me"
  | "is_not_me"
  | "is"
  | "contains"
  | "eq"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export interface ViewConditionItem {
  field: string;
  operator: ViewOperator;
  value: string[];
}

export interface ViewConditions {
  join: ViewJoin;
  items: ViewConditionItem[];
}

export interface ViewSort {
  field: string;
  direction: "asc" | "desc";
}

export interface SavedView {
  view_id: string;
  name: string;
  owner_user_id: string;
  object_type: string;
  order: number;
  fields: string[];
  conditions: ViewConditions;
  sorts: ViewSort[];
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}
