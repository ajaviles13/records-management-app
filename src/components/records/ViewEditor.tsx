import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { choiceOptionsForField, filterKindFor, type ChoiceLookups } from "@/lib/columnFilters";
import { canAssignViews, canUseSavedViews } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  conditionPreview,
  operatorNeedsValue,
  operatorUsesChoices,
  operatorsForField,
  viewableFields,
} from "@/lib/viewQuery";
import type {
  DataDictionaryField,
  RoleAccess,
  SavedView,
  User,
  ViewConditionItem,
  ViewConditions,
  ViewDraft,
  ViewOperator,
  ViewSort,
} from "@/types";

type TabId = "information" | "fields" | "conditions" | "sort";

interface ViewEditorProps {
  open: boolean;
  mode: "create" | "edit";
  initial: SavedView;
  dictionary: DataDictionaryField[];
  lookups: ChoiceLookups;
  pending: boolean;
  /** All users, used to populate the User Assignment picker. */
  users: User[];
  /** The signed-in user, whose role decides whether assignment is available at all. */
  currentUser: User | null;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: ViewDraft) => void;
  onDelete?: () => void;
}

export function ViewEditor({
  open,
  mode,
  initial,
  dictionary,
  lookups,
  pending,
  users,
  currentUser,
  onOpenChange,
  onSave,
  onDelete,
}: ViewEditorProps) {
  const [tab, setTab] = useState<TabId>("information");
  const [name, setName] = useState(initial.name);
  const [order, setOrder] = useState(String(initial.order || 9999));
  const [fields, setFields] = useState<string[]>(initial.fields);
  const [join, setJoin] = useState<ViewConditions["join"]>(initial.conditions.join);
  const [items, setItems] = useState<ViewConditionItem[]>(initial.conditions.items);
  const [sorts, setSorts] = useState<ViewSort[]>(initial.sorts);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>(initial.assigned_user_ids);
  const [assignedRoles, setAssignedRoles] = useState<RoleAccess[]>(initial.assigned_roles);
  const [availableQuery, setAvailableQuery] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");
  const [availablePick, setAvailablePick] = useState<string[]>([]);
  const [selectedPick, setSelectedPick] = useState<string[]>([]);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentQuery, setAssignmentQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("information");
    setName(mode === "create" ? "" : initial.name);
    setOrder(String(initial.order || 9999));
    setFields(initial.fields);
    setJoin(initial.conditions.join);
    setItems(initial.conditions.items);
    setSorts(initial.sorts.length ? initial.sorts : [{ field: "received_at_est", direction: "desc" }]);
    setAssignedUserIds(initial.assigned_user_ids);
    setAssignedRoles(initial.assigned_roles);
    setAvailableQuery("");
    setSelectedQuery("");
    setAvailablePick([]);
    setSelectedPick([]);
    setAssignmentOpen(false);
    setAssignmentQuery("");
  }, [open]);

  const allFields = useMemo(() => viewableFields(dictionary), [dictionary]);
  const selectedSet = useMemo(() => new Set(fields), [fields]);
  const available = allFields.filter((field) => !selectedSet.has(field.key));
  const selected = fields
    .map((key) => allFields.find((field) => field.key === key) ?? { key, alias: key })
    .filter((field) => field.alias.toLowerCase().includes(selectedQuery.trim().toLowerCase()));
  const availableFiltered = available.filter((field) =>
    field.alias.toLowerCase().includes(availableQuery.trim().toLowerCase()),
  );
  const conditions: ViewConditions = { join, items };
  const preview = conditionPreview(conditions, dictionary);
  const orderNumber = Number(order);
  const canAssign = currentUser ? canAssignViews(currentUser.role_access) : false;
  const assignmentTargets = useMemo(
    () => users.filter((row) => canUseSavedViews(row.role_access) && row.user_id !== currentUser?.user_id),
    [users, currentUser?.user_id],
  );
  const assignmentSummary = useMemo(() => {
    if (!assignedRoles.length && !assignedUserIds.length) return "Me";
    const parts: string[] = [];
    for (const role of ["Analyst", "Manager", "Administrator"] as RoleAccess[]) {
      if (assignedRoles.includes(role)) parts.push(`All ${role} Users`);
    }
    for (const row of assignmentTargets) {
      if (assignedUserIds.includes(row.user_id)) parts.push(`${row.first_name} ${row.last_name}`);
    }
    return parts.join(", ") || "Me";
  }, [assignedRoles, assignedUserIds, assignmentTargets]);
  const assignmentQueryNormalized = assignmentQuery.trim().toLowerCase();
  const assignmentRoleOptions = (["Analyst", "Manager", "Administrator"] as RoleAccess[]).filter((role) =>
    `assign to all "${role}" users`.includes(assignmentQueryNormalized),
  );
  const assignmentUserOptions = assignmentTargets.filter((row) =>
    `${row.first_name} ${row.last_name} ${row.abbreviation} ${row.role_access}`.toLowerCase().includes(assignmentQueryNormalized),
  );

  function toggleAvailablePick(key: string) {
    setAvailablePick((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function toggleSelectedPick(key: string) {
    setSelectedPick((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function moveToSelected(keys: string[]) {
    const allowed = new Set(available.map((field) => field.key));
    const toAdd = keys.filter((key) => allowed.has(key) && !selectedSet.has(key));
    if (!toAdd.length) return;
    setFields((current) => [...current, ...toAdd]);
    setAvailablePick([]);
    setSelectedPick([]);
  }

  function moveToAvailable(keys: string[]) {
    const toRemove = new Set(keys);
    if (!toRemove.size) return;
    setFields((current) => current.filter((item) => !toRemove.has(item)));
    setSelectedPick([]);
    setAvailablePick([]);
  }

  function moveSelected(direction: -1 | 1) {
    if (!selectedPick.length) return;
    const picked = new Set(selectedPick);
    setFields((current) => {
      const next = [...current];
      if (direction < 0) {
        for (let index = 1; index < next.length; index += 1) {
          if (picked.has(next[index]) && !picked.has(next[index - 1])) {
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
          }
        }
      } else {
        for (let index = next.length - 2; index >= 0; index -= 1) {
          if (picked.has(next[index]) && !picked.has(next[index + 1])) {
            [next[index + 1], next[index]] = [next[index], next[index + 1]];
          }
        }
      }
      return next;
    });
  }

  function updateItem(index: number, patch: Partial<ViewConditionItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function save() {
    if (!name.trim()) return;
    if (!fields.length) return;
    if (!Number.isInteger(orderNumber)) return;
    onSave({
      name: name.trim(),
      order: orderNumber,
      fields,
      conditions,
      sorts: sorts.filter((sort) => sort.field),
      assigned_user_ids: canAssign ? assignedUserIds : [],
      assigned_roles: canAssign ? assignedRoles : [],
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="overflow-hidden">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New View" : "Edit View"}</DialogTitle>
          <DialogDescription>Choose fields, order, and the saved filter for this private view.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 border-b px-6">
          {(
            [
              ["information", "Information"],
              ["fields", "Fields"],
              ["conditions", "Conditions"],
              ["sort", "Sort"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "border-b-2 px-3 py-2 text-sm",
                tab === id ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={cn("min-h-0 flex-1 px-6 py-4", tab === "fields" ? "overflow-hidden" : "overflow-auto")}>
          {tab === "information" ? (
            <div className="grid max-w-md gap-4">
              <div className="space-y-2">
                <Label htmlFor="view-name">Name</Label>
                <Input id="view-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="view-order">Order</Label>
                <Input id="view-order" type="number" step={1} value={order} onChange={(event) => setOrder(event.target.value)} />
                <p className="text-xs text-muted-foreground">Lower numbers appear first in the view dropdown. Default is 9999.</p>
              </div>
              {canAssign ? (
                <div className="space-y-2">
                  <Label>User Assignment</Label>
                  <Popover open={assignmentOpen} onOpenChange={setAssignmentOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate text-left">{assignmentSummary}</span>
                        <ChevronDown className="size-4 shrink-0 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 overflow-hidden p-0">
                      <div className="border-b bg-muted p-1.5">
                        <div className="flex items-center gap-1.5 rounded-sm border border-input bg-background px-2 shadow-xs">
                          <Search className="size-3.5 shrink-0 text-muted-foreground" />
                          <input
                            value={assignmentQuery}
                            onChange={(event) => setAssignmentQuery(event.target.value)}
                            placeholder="Search users"
                            className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-auto p-1">
                        {assignmentRoleOptions.map((role) => (
                          <button
                            key={role}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                            onClick={() =>
                              setAssignedRoles((current) =>
                                current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
                              )
                            }
                          >
                            <Checkbox checked={assignedRoles.includes(role)} className="pointer-events-none" tabIndex={-1} />
                            <span className="truncate">Assign to all &ldquo;{role}&rdquo; Users</span>
                          </button>
                        ))}
                        {assignmentRoleOptions.length && assignmentUserOptions.length ? (
                          <div className="my-1 h-px bg-border" />
                        ) : null}
                        {assignmentUserOptions.map((row) => (
                          <button
                            key={row.user_id}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                            onClick={() =>
                              setAssignedUserIds((current) =>
                                current.includes(row.user_id)
                                  ? current.filter((item) => item !== row.user_id)
                                  : [...current, row.user_id],
                              )
                            }
                          >
                            <Checkbox checked={assignedUserIds.includes(row.user_id)} className="pointer-events-none" tabIndex={-1} />
                            <span className="truncate">
                              {row.first_name} {row.last_name} ({row.abbreviation}) · {row.role_access}
                            </span>
                          </button>
                        ))}
                        {!assignmentRoleOptions.length && !assignmentUserOptions.length ? (
                          <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches.</p>
                        ) : null}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    {assignedRoles.length || assignedUserIds.length
                      ? "Shared with the selections above."
                      : "Private to you (“Me”). Open the picker to share it with specific users or whole roles."}
                  </p>
                </div>
              ) : null}
              {mode === "edit" && onDelete ? (
                <div className="border-t pt-4">
                  <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>
                    <Trash2 className="size-4" />
                    Delete View
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "fields" ? (
            <div className="grid h-full min-h-0 grid-cols-[1fr_auto_1fr_auto] gap-3">
              <FieldList
                title="Available"
                query={availableQuery}
                onQuery={setAvailableQuery}
                items={availableFiltered}
                picked={availablePick}
                onPick={toggleAvailablePick}
                onActivate={(key) => moveToSelected([key])}
              />
              <div className="flex flex-col items-center justify-center gap-1.5 self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="Add all fields"
                  disabled={!available.length}
                  onClick={() => moveToSelected(available.map((field) => field.key))}
                >
                  <ChevronsRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="Add selected fields"
                  disabled={!availablePick.length}
                  onClick={() => moveToSelected(availablePick)}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="Remove selected fields"
                  disabled={!selectedPick.length}
                  onClick={() => moveToAvailable(selectedPick)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="Remove all fields"
                  disabled={!fields.length}
                  onClick={() => moveToAvailable(fields)}
                >
                  <ChevronsLeft className="size-4" />
                </Button>
              </div>
              <FieldList
                title="Selected"
                query={selectedQuery}
                onQuery={setSelectedQuery}
                items={selected}
                picked={selectedPick}
                onPick={toggleSelectedPick}
                onActivate={(key) => moveToAvailable([key])}
              />
              <div className="flex flex-col items-center justify-center gap-1.5 self-center">
                <Button type="button" variant="outline" size="icon-sm" title="Move up" disabled={!selectedPick.length} onClick={() => moveSelected(-1)}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button type="button" variant="outline" size="icon-sm" title="Move down" disabled={!selectedPick.length} onClick={() => moveSelected(1)}>
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {tab === "conditions" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label>Join conditions with</Label>
                <Select value={join} onValueChange={(value) => setJoin(value === "OR" ? "OR" : "AND")}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND</SelectItem>
                    <SelectItem value="OR">OR</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setItems((current) => [
                      ...current,
                      { field: "status", operator: "any_of", value: [] },
                    ])
                  }
                >
                  <Plus className="size-4" />
                  Condition
                </Button>
              </div>
              <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">{preview}</p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conditions. This view will include all records, then any column-header filters.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <ConditionCard
                      key={`${item.field}-${index}`}
                      item={item}
                      dictionary={dictionary}
                      lookups={lookups}
                      fields={allFields}
                      onChange={(patch) => updateItem(index, patch)}
                      onRemove={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === "sort" ? (
            <div className="space-y-3">
              {sorts.map((sort, index) => (
                <div key={`${sort.field}-${index}`} className="flex flex-wrap items-center gap-2">
                  <Select
                    value={sort.field}
                    onValueChange={(value) =>
                      setSorts((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, field: value } : row)))
                    }
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Sort field" />
                    </SelectTrigger>
                    <SelectContent>
                      {allFields.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.alias}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sort.direction}
                    onValueChange={(value) =>
                      setSorts((current) =>
                        current.map((row, rowIndex) => (rowIndex === index ? { ...row, direction: value === "asc" ? "asc" : "desc" } : row)),
                      )
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSorts((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSorts((current) => [...current, { field: allFields[0]?.key ?? "file_name", direction: "asc" }])}
              >
                <Plus className="size-4" />
                Add sort field
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !name.trim() || fields.length === 0 || !Number.isInteger(orderNumber)}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldList({
  title,
  query,
  onQuery,
  items,
  picked,
  onPick,
  onActivate,
}: {
  title: string;
  query: string;
  onQuery: (value: string) => void;
  items: { key: string; alias: string }[];
  picked: string[];
  onPick: (key: string) => void;
  onActivate: (key: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border">
      <div className="shrink-0 border-b px-2 py-1.5 text-xs font-medium">{title}</div>
      <div className="shrink-0 border-b bg-muted p-1.5">
        <div className="flex items-center gap-1.5 rounded-sm border border-input bg-background px-2 shadow-xs">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search fields"
            className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1">
        {items.map((item) => {
          const isPicked = picked.includes(item.key);
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isPicked}
              className={cn(
                "block w-full truncate rounded-sm px-2 py-1 text-left text-sm",
                isPicked ? "bg-accent font-medium" : "hover:bg-muted",
              )}
              onClick={() => onPick(item.key)}
              onDoubleClick={() => onActivate(item.key)}
            >
              {item.alias}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConditionCard({
  item,
  dictionary,
  lookups,
  fields,
  onChange,
  onRemove,
}: {
  item: ViewConditionItem;
  dictionary: DataDictionaryField[];
  lookups: ChoiceLookups;
  fields: { key: string; alias: string }[];
  onChange: (patch: Partial<ViewConditionItem>) => void;
  onRemove: () => void;
}) {
  const operators = operatorsForField(item.field, dictionary);
  const kind = filterKindFor(item.field, dictionary);
  const choices =
    kind === "boolean"
      ? [
          { value: "YES", label: "Yes" },
          { value: "NO", label: "No" },
        ]
      : choiceOptionsForField(item.field, dictionary, lookups);
  const needsValue = operatorNeedsValue(item.operator);
  const usesChoices = operatorUsesChoices(item.operator);

  function setField(field: string) {
    const nextOps = operatorsForField(field, dictionary);
    onChange({ field, operator: nextOps[0]?.value ?? "is", value: [] });
  }

  function setOperator(operator: ViewOperator) {
    onChange({ operator, value: operatorNeedsValue(operator) ? item.value : [] });
  }

  function toggleChoice(value: string) {
    const selected = item.value.includes(value) ? item.value.filter((entry) => entry !== value) : [...item.value, value];
    onChange({ value: selected });
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-start gap-2">
        <Select value={item.field} onValueChange={setField}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fields.map((field) => (
              <SelectItem key={field.key} value={field.key}>
                {field.alias}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={item.operator} onValueChange={(value) => setOperator(value as ViewOperator)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((operator) => (
              <SelectItem key={operator.value} value={operator.value}>
                {operator.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {needsValue && usesChoices ? (
        <div className="max-h-40 overflow-auto rounded-md border p-1">
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
              onClick={() => toggleChoice(choice.value)}
            >
              <Checkbox checked={item.value.includes(choice.value)} className="pointer-events-none" tabIndex={-1} />
              <span className="truncate">{choice.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {needsValue && !usesChoices ? (
        <Input
          type={kind === "number" ? "number" : "text"}
          value={item.value[0] ?? ""}
          onChange={(event) => onChange({ value: [event.target.value] })}
        />
      ) : null}
    </div>
  );
}
