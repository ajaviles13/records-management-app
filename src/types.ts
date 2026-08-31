export type RoleAccess = "Analyst" | "Manager" | "Administrator" | "Viewer";

export type DerivedStatus = "In-Review" | "Completed" | "On-Hold";

export interface LanguageCode {
  code_id: string;
  language: string;
  country: string;
}

/** Payload a Manager or Administrator submits to add a language code. */
export interface NewLanguageInput {
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
  /** Primary key of the changed row, within `artifact_table`. */
  artifact_id: string;
  /**
   * Which store the change landed in: `sla-file-records`, `sla-users`, or `connectors`.
   * The audit log is no longer records-only, so this is what disambiguates `artifact_id`.
   */
  artifact_table: string;
  /** The column whose value changed, which `old_field_value` and `new_field_value` describe. */
  artifact_name: string;
  old_field_value: string;
  new_field_value: string;
  trigger_source: string;
  user_id: string;
  /** `Created`, `Updated`, or `Deleted`. */
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
  /**
   * Individual users this view is shared with, beyond `owner_user_id`. Recipients can
   * select the view but cannot edit or delete it.
   */
  assigned_user_ids: string[];
  /**
   * Roles this view is shared with. Every user holding one of these roles inherits the
   * view. "Viewer" is never a valid entry because Viewers have no access to saved views.
   */
  assigned_roles: RoleAccess[];
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

/** The mutable slice of a saved view submitted by the view editor. */
export type ViewDraft = Pick<
  SavedView,
  "name" | "order" | "fields" | "conditions" | "sorts" | "assigned_user_ids" | "assigned_roles"
>;

/** Payload a Manager or Administrator submits to create a user from the Configure tab. */
export interface NewUserInput {
  email: string;
  first_name: string;
  last_name: string;
  abbreviation: string;
  role_access: RoleAccess;
}

/**
 * Egnyte file share credentials captured on the Configure > Connectors tab.
 *
 * Local-first placeholder only. Nothing consumes these values yet; they are written to
 * the gitignored `.env` so the form round-trips during development. The production
 * design stores them in AWS Systems Manager Parameter Store, read by backend Lambdas,
 * and they will never be served to the browser.
 */
export interface ConnectorStatus {
  connector_id: "egnyte";
  /** Whether a CLIENT_ID is currently present in the environment. */
  has_client_id: boolean;
  /** Whether a CLIENT_SECRET is currently present in the environment. */
  has_client_secret: boolean;
  /** The CLIENT_ID, safe to display. The secret is never returned to the client. */
  client_id: string;
  updated_at: string;
}

/** Rows shown per page in the Records table. */
export type PageSize = 25 | 50 | 100 | 500 | 1000;

/** Which slice of the active view an export covers. */
export type ExportScope = "page" | "view";

export type ExportFormat = "csv" | "xlsx";

/**
 * Which record timestamps a My Snapshot date range applies to. "both" means a record
 * qualifies when either `received_at_est` or `delivered_at_est` falls inside the range.
 */
export type SnapshotDateBasis = "received" | "delivered" | "both";

export type SnapshotRangePreset = "all" | "today" | "week" | "month" | "year" | "custom";

export interface SnapshotDateRange {
  preset: SnapshotRangePreset;
  basis: SnapshotDateBasis;
  /** Inclusive start, `YYYY-MM-DD`. Empty for the "all" preset. */
  from: string;
  /** Inclusive end, `YYYY-MM-DD`. Empty for the "all" preset. */
  to: string;
}
