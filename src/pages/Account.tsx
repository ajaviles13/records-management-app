import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayName, userInitials } from "@/lib/roles";

const LOCKED_NOTE = "You do not have access to change this. Please contact your Project Manager if you need to change this.";

export function AccountPage() {
  const { user, updateProfile, logout } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [abbreviation, setAbbreviation] = useState(user?.abbreviation ?? "");
  const [pending, setPending] = useState(false);

  if (!user) return null;

  const isAnalyst = user.role_access === "Analyst";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await updateProfile(
        isAnalyst
          ? { first_name: firstName, last_name: lastName }
          : { first_name: firstName, last_name: lastName, abbreviation },
      );
      toast.success("Account updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">Profile details stored in the local users CSV.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={user.profile_image || undefined} alt={displayName(user.first_name, user.last_name)} />
            <AvatarFallback>{userInitials(user.first_name, user.last_name)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{displayName(user.first_name, user.last_name)}</CardTitle>
            <CardDescription>
              {user.email} · {user.role_access}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <LockedHint enabled={isAnalyst} label="Abbreviation">
              <Input
                id="abbreviation"
                value={abbreviation}
                disabled={isAnalyst}
                onChange={(e) => setAbbreviation(e.target.value)}
              />
            </LockedHint>
            <LockedHint enabled={isAnalyst} label="Role">
              <Input value={user.role_access} disabled />
            </LockedHint>
            <div className="space-y-2 sm:col-span-2">
              <Label>Last login</Label>
              <Input value={user.last_login || "—"} disabled />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={logout}>
                Sign out
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LockedHint({ enabled, label, children }: { enabled: boolean; label: string; children: ReactNode }) {
  return (
    <div className="group relative space-y-2">
      <Label>{label}</Label>
      {children}
      {enabled ? (
        <div className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden max-w-xs rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md group-hover:block">
          {LOCKED_NOTE}
        </div>
      ) : null}
    </div>
  );
}
