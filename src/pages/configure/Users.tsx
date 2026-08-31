import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { assignableRoles, canAssignRole, displayName } from "@/lib/roles";
import type { NewUserInput, RoleAccess, User } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyDraft(defaultRole: RoleAccess): NewUserInput {
  return { email: "", first_name: "", last_name: "", abbreviation: "", role_access: defaultRole };
}

export function ConfigureUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const roleOptions = useMemo(
    () => (currentUser ? assignableRoles(currentUser.role_access) : []),
    [currentUser],
  );
  const [draft, setDraft] = useState<NewUserInput>(emptyDraft(roleOptions[0] ?? "Analyst"));

  async function load() {
    setLoading(true);
    try {
      const { users: rows } = await api.users();
      setUsers([...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setDraft(emptyDraft(roleOptions[0] ?? "Analyst"));
    setDialogOpen(true);
  }

  function validate(input: NewUserInput): string | null {
    if (!input.email.trim() || !EMAIL_RE.test(input.email.trim())) return "Enter a valid email address.";
    if (!input.first_name.trim()) return "First name is required.";
    if (!input.last_name.trim()) return "Last name is required.";
    const abbreviation = input.abbreviation.trim();
    if (abbreviation.length < 2 || abbreviation.length > 4) return "Abbreviation must be 2-4 characters.";
    if (!roleOptions.includes(input.role_access)) return "Select a valid role.";
    return null;
  }

  async function createUser() {
    const input: NewUserInput = {
      email: draft.email.trim().toLowerCase(),
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      abbreviation: draft.abbreviation.trim().toUpperCase(),
      role_access: draft.role_access,
    };
    const error = validate(input);
    if (error) {
      toast.error(error);
      return;
    }
    setPending(true);
    try {
      await api.createUser(input);
      toast.success(`${displayName(input.first_name, input.last_name)} was added.`);
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setPending(false);
    }
  }

  async function removeUser(target: User) {
    if (!window.confirm(`Remove ${displayName(target.first_name, target.last_name)} (${target.email})? This cannot be undone.`)) {
      return;
    }
    setRemovingId(target.user_id);
    try {
      await api.deleteUser(target.user_id);
      toast.success(`${displayName(target.first_name, target.last_name)} was removed.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove user.");
    } finally {
      setRemovingId(null);
    }
  }

  function removeDisabledReason(target: User): string | null {
    if (!currentUser) return "Not signed in.";
    if (target.user_id === currentUser.user_id) return "You cannot remove your own account.";
    if (!canAssignRole(currentUser.role_access, target.role_access)) {
      return `You do not have permission to remove users with the ${target.role_access} role.`;
    }
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Users</h3>
          <p className="text-sm text-muted-foreground">
            This directory is local-first: there is no password to set here, and every seeded account signs in with the
            shared demo password. A real authentication provider will replace this later.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add user
        </Button>
      </div>
      <div className="overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Abbreviation</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Loading users…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((row) => {
                const reason = removeDisabledReason(row);
                return (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">{displayName(row.first_name, row.last_name)}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.abbreviation}</TableCell>
                    <TableCell>{row.role_access}</TableCell>
                    <TableCell>{formatDateTime(row.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={reason ?? `Remove ${displayName(row.first_name, row.last_name)}`}
                        disabled={!!reason || removingId === row.user_id}
                        onClick={() => removeUser(row)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="h-auto w-[min(28rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              This local-first directory has no password field — everyone signs in with the shared demo password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="user-first-name">First name</Label>
                <Input
                  id="user-first-name"
                  value={draft.first_name}
                  onChange={(event) => setDraft((current) => ({ ...current, first_name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-last-name">Last name</Label>
                <Input
                  id="user-last-name"
                  value={draft.last_name}
                  onChange={(event) => setDraft((current) => ({ ...current, last_name: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={draft.email}
                onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="user-abbreviation">Abbreviation</Label>
                <Input
                  id="user-abbreviation"
                  maxLength={4}
                  value={draft.abbreviation}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, abbreviation: event.target.value.toUpperCase() }))
                  }
                />
                <p className="text-xs text-muted-foreground">2-4 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Role</Label>
                <Select
                  value={draft.role_access}
                  onValueChange={(value) => setDraft((current) => ({ ...current, role_access: value as RoleAccess }))}
                >
                  <SelectTrigger id="user-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createUser} disabled={pending}>
              {pending ? "Adding…" : "Add user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
