import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { analystLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { choiceOptionsForField, isUrlField, type ChoiceOption } from "@/lib/columnFilters";
import { UrlLink } from "@/components/UrlLink";
import type { DataDictionaryField, FieldOption, FileRecord, LanguageCode, User } from "@/types";

const EMPTY = "__empty__";

const TEXT_FIELDS: { key: keyof FileRecord; label: string }[] = [
  { key: "file_name", label: "File name" },
  { key: "project_number", label: "Project number" },
  { key: "received_at_est", label: "Received (EST)" },
  { key: "delivered_at_est", label: "Delivered (EST)" },
  { key: "status_hours", label: "Status hours" },
  { key: "status_label", label: "Status label" },
  { key: "egnyte_direct_link", label: "Egnyte link" },
  { key: "egnyte_file_path", label: "Egnyte path" },
  { key: "egnyte_file_size_kb", label: "File size (KB)" },
  { key: "dtp_1", label: "DTP 1" },
  { key: "new", label: "New" },
  { key: "fuzzy", label: "Fuzzy" },
  { key: "total", label: "Total" },
  { key: "dtp_2", label: "DTP 2" },
  { key: "pm", label: "PM" },
  { key: "it_eng", label: "IT Eng" },
  { key: "qa", label: "QA" },
];

interface RecordSheetProps {
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
}

export function RecordSheet({
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
}: RecordSheetProps) {
  const lookups = useMemo(
    () => ({ options, users, languageCodes }),
    [options, users, languageCodes],
  );
  const grouped = useMemo(
    () => ({
      language_code: choiceOptionsForField("language_code", dictionary, lookups),
      template_type: choiceOptionsForField("template_type", dictionary, lookups),
      line_of_business: choiceOptionsForField("line_of_business", dictionary, lookups),
      state: choiceOptionsForField("state", dictionary, lookups),
      comment: choiceOptionsForField("comment", dictionary, lookups),
      qa_delivery_by: choiceOptionsForField("qa_delivery_by", dictionary, lookups),
    }),
    [dictionary, lookups],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "New record" : "Record details"}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <StatusBadge record={draft} />
            {draft.record_id ? <span className="font-mono text-xs">{draft.record_id}</span> : null}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 pb-4">
          {TEXT_FIELDS.slice(0, 4).map((field) => (
            <Field
              key={field.key}
              label={field.label}
              disabled={readOnly}
              value={draft[field.key]}
              onChange={(value) => onChange({ [field.key]: value })}
              isUrl={isUrlField(field.key, dictionary)}
            />
          ))}
          <SelectField
            label="Language"
            disabled={readOnly}
            value={draft.language_code}
            onChange={(value) => onChange({ language_code: value })}
            options={grouped.language_code ?? []}
          />
          <SelectField
            label="Template type"
            disabled={readOnly}
            value={draft.template_type}
            onChange={(value) => onChange({ template_type: value })}
            options={grouped.template_type ?? []}
          />
          <SelectField
            label="Line of business"
            disabled={readOnly}
            value={draft.line_of_business}
            onChange={(value) => onChange({ line_of_business: value })}
            options={grouped.line_of_business ?? []}
          />
          <SelectField
            label="State"
            disabled={readOnly}
            value={draft.state}
            onChange={(value) => onChange({ state: value })}
            options={grouped.state ?? []}
          />
          <SelectField
            label="Comment / hold reason"
            disabled={readOnly}
            value={draft.comment}
            onChange={(value) => onChange({ comment: value })}
            options={grouped.comment ?? []}
          />
          <SelectField
            label="QA delivery by"
            disabled={readOnly}
            value={draft.qa_delivery_by}
            onChange={(value) => onChange({ qa_delivery_by: value })}
            options={grouped.qa_delivery_by ?? []}
          />
          <div className="space-y-2">
            <Label>Assigned analyst</Label>
            <Select
              value={draft.assigned_analyst_id || EMPTY}
              onValueChange={(value) => onChange({ assigned_analyst_id: value === EMPTY ? "" : value })}
              disabled={readOnly}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select analyst" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY}>None</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {analystLabel(users, user.user_id)} · {user.role_access}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Urgent</Label>
              <Select value={draft.is_urgent || "NO"} onValueChange={(value) => onChange({ is_urgent: value })} disabled={readOnly}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">Yes</SelectItem>
                  <SelectItem value="NO">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SLA met</Label>
              <Select value={draft.sla_met || EMPTY} onValueChange={(value) => onChange({ sla_met: value === EMPTY ? "" : value })} disabled={readOnly}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Unset</SelectItem>
                  <SelectItem value="Y">Yes</SelectItem>
                  <SelectItem value="N">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {TEXT_FIELDS.slice(4).map((field) => (
            <Field
              key={field.key}
              label={field.label}
              disabled={readOnly}
              value={draft[field.key]}
              onChange={(value) => onChange({ [field.key]: value })}
              isUrl={isUrlField(field.key, dictionary)}
            />
          ))}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {readOnly ? null : (
            <Button onClick={onSave} disabled={pending || !draft.file_name.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  isUrl = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  isUrl?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      {isUrl && value.trim() ? <UrlLink value={value} className="text-sm" /> : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || EMPTY} onValueChange={(next) => onChange(next === EMPTY ? "" : next)} disabled={disabled}>
        <SelectTrigger className="w-full">
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
