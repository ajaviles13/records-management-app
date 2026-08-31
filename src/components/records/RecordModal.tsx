import { useEffect, useMemo, useRef } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { UrlLink } from "@/components/UrlLink";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { choiceOptionsForField, isUrlField, type ChoiceOption } from "@/lib/columnFilters";
import { analystLabel } from "@/lib/format";
import { canAssignRecords } from "@/lib/roles";
import type { DataDictionaryField, FieldOption, FileRecord, LanguageCode, RoleAccess, User } from "@/types";

/** Placeholder value, because a Radix SelectItem cannot hold an empty string. */
const EMPTY = "__empty__";

/** Fields rendered as a dropdown sourced from the data dictionary options. */
const CHOICE_FIELDS = ["language_code", "template_type", "line_of_business", "state", "comment", "qa_delivery_by"];

/** Only these roles can own a document, so only they appear in the assignment dropdown. */
const ASSIGNABLE_ROLES: RoleAccess[] = ["Analyst", "Manager"];

const EFFORT_FIELDS = ["dtp_1", "new", "fuzzy", "total", "dtp_2", "pm", "it_eng", "qa"];

interface Field {
  key: keyof FileRecord;
  label: string;
}

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: "Document",
    fields: [
      { key: "file_name", label: "File name" },
      { key: "project_number", label: "Project number" },
      { key: "language_code", label: "Language" },
      { key: "template_type", label: "Template type" },
    ],
  },
  {
    title: "Timing",
    fields: [
      { key: "received_at_est", label: "Received (EST)" },
      { key: "delivered_at_est", label: "Delivered (EST)" },
      { key: "status_hours", label: "Status hours" },
      { key: "status_label", label: "Status label" },
      { key: "qa_delivery_by", label: "QA delivery by" },
    ],
  },
  {
    title: "Assignment & status",
    fields: [
      { key: "assigned_analyst_id", label: "Assigned analyst" },
      { key: "is_urgent", label: "Urgent" },
      { key: "sla_met", label: "SLA met" },
      { key: "comment", label: "Comment / hold reason" },
      { key: "line_of_business", label: "Line of business" },
      { key: "state", label: "State" },
    ],
  },
  {
    title: "Effort metrics",
    fields: EFFORT_FIELDS.map((key) => ({
      key: key as keyof FileRecord,
      label: key.replace("_", " ").toUpperCase(),
    })),
  },
  {
    title: "Egnyte",
    fields: [
      { key: "egnyte_direct_link", label: "Direct link" },
      { key: "egnyte_file_path", label: "File path" },
      { key: "egnyte_file_size_kb", label: "File size (KB)" },
    ],
  },
];

interface RecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  draft: FileRecord;
  onChange: (patch: Partial<FileRecord>) => void;
  onSave: () => void;
  pending: boolean;
  readOnly: boolean;
  users: User[];
  options: FieldOption[];
  dictionary: DataDictionaryField[];
  languageCodes: LanguageCode[];
  role?: RoleAccess;
}

export function RecordModal({
  open,
  onOpenChange,
  mode,
  draft,
  onChange,
  onSave,
  pending,
  readOnly,
  users,
  options,
  dictionary,
  languageCodes,
  role,
}: RecordModalProps) {
  /** Snapshot of the record as opened, used to detect unsaved edits on close. */
  const baseline = useRef("");
  const lookups = useMemo(() => ({ options, users, languageCodes }), [options, users, languageCodes]);

  const analystOptions = useMemo(() => {
    const eligible = users.filter((user) => ASSIGNABLE_ROLES.includes(user.role_access));
    // Keep whoever currently owns the record selectable even if their role has since
    // changed, so opening the modal never silently drops the assignment.
    const current = draft.assigned_analyst_id;
    if (current && !eligible.some((user) => user.user_id === current)) {
      const owner = users.find((user) => user.user_id === current);
      if (owner) eligible.push(owner);
    }
    return eligible.map((user) => ({ value: user.user_id, label: analystLabel(users, user.user_id) }));
  }, [users, draft.assigned_analyst_id]);

  useEffect(() => {
    // Re-baseline on open only; tracking `draft` here would clear the dirty flag on
    // every keystroke.
    if (open) baseline.current = JSON.stringify(draft);
  }, [open]);

  const dirty = open && baseline.current !== "" && baseline.current !== JSON.stringify(draft);

  function requestClose(next: boolean) {
    if (!next && !readOnly && dirty && !window.confirm("Discard unsaved changes?")) return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="h-[min(52rem,92vh)] max-w-3xl">
        <DialogHeader className="shrink-0 border-b pb-4">
          <DialogTitle>{mode === "create" ? "New record" : "Record details"}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <StatusBadge record={draft} />
            {draft.record_id ? <span className="font-mono text-xs">{draft.record_id}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-3">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <RecordField
                    key={field.key}
                    field={field}
                    draft={draft}
                    onChange={onChange}
                    disabled={
                      readOnly || (field.key === "assigned_analyst_id" && !canAssignRecords(role ?? "Viewer"))
                    }
                    options={
                      field.key === "assigned_analyst_id"
                        ? analystOptions
                        : choiceOptionsForField(field.key, dictionary, lookups)
                    }
                    dictionary={dictionary}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => requestClose(false)}>
            Cancel
          </Button>
          {readOnly ? null : (
            <Button onClick={onSave} disabled={pending || !draft.file_name.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RecordFieldProps {
  field: Field;
  draft: FileRecord;
  onChange: (patch: Partial<FileRecord>) => void;
  disabled: boolean;
  options: ChoiceOption[];
  dictionary: DataDictionaryField[];
}

function RecordField({ field, draft, onChange, disabled, options, dictionary }: RecordFieldProps) {
  const value = draft[field.key];

  function renderControl() {
    if (field.key === "assigned_analyst_id") {
      return (
        <Select
          value={value || EMPTY}
          disabled={disabled}
          onValueChange={(next) => onChange({ assigned_analyst_id: next === EMPTY ? "" : next })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>Unassigned</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.key === "is_urgent") {
      return (
        <Select value={value || "NO"} disabled={disabled} onValueChange={(next) => onChange({ is_urgent: next })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="YES">Yes</SelectItem>
            <SelectItem value="NO">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (field.key === "sla_met") {
      return (
        <Select
          value={value || EMPTY}
          disabled={disabled}
          onValueChange={(next) => onChange({ sla_met: next === EMPTY ? "" : next })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>Not set</SelectItem>
            <SelectItem value="Y">Yes</SelectItem>
            <SelectItem value="N">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (CHOICE_FIELDS.includes(field.key)) {
      return (
        <Select
          value={value || EMPTY}
          disabled={disabled}
          onValueChange={(next) => onChange({ [field.key]: next === EMPTY ? "" : next })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>None</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <>
        <Input value={value} disabled={disabled} onChange={(event) => onChange({ [field.key]: event.target.value })} />
        {isUrlField(field.key, dictionary) && value ? <UrlLink value={value} className="text-xs" /> : null}
      </>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>{field.label}</Label>
      {renderControl()}
    </div>
  );
}

export function emptyRecord(assignedAnalystId = ""): FileRecord {
  return {
    project_number: "",
    file_name: "",
    line_of_business: "",
    state: "",
    received_at_est: "",
    delivered_at_est: "",
    sla_met: "",
    is_urgent: "NO",
    qa_delivery_by: "",
    comment: "",
    status_hours: "",
    status_label: "",
    internal: "",
    dtp_1: "",
    new: "",
    fuzzy: "",
    total: "",
    dtp_2: "",
    pm: "",
    it_eng: "",
    qa: "",
    record_id: "",
    assigned_analyst_id: assignedAnalystId,
    template_type: "",
    language_code: "",
    received_at_utc: "",
    delivered_at_utc: "",
    egnyte_direct_link: "",
    egnyte_file_path: "",
    egnyte_file_size_kb: "",
    created_by: "",
    updated_by: "",
    created_at: "",
    updated_at: "",
  };
}
