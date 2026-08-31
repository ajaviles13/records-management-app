import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConnectorStatus } from "@/types";

const MASKED_SECRET_PLACEHOLDER = "••••••••";

export function ConfigureConnectorsPage() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { connector } = await api.connector();
      setStatus(connector);
      setClientId(connector.client_id);
      setClientSecret("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the Egnyte connector.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setPending(true);
    try {
      const { connector } = await api.saveConnector({ client_id: clientId.trim(), client_secret: clientSecret.trim() });
      setStatus(connector);
      setClientSecret("");
      toast.success("Egnyte connector saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the Egnyte connector.");
    } finally {
      setPending(false);
    }
  }

  const configured = !!status?.has_client_id && !!status?.has_client_secret;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Connectors</h3>
        <p className="text-sm text-muted-foreground">Manage credentials for external systems this app integrates with.</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          These credentials are stored so this form has something to persist to, but nothing in the app uses them yet.
          The production design will read them from{" "}
          <span className="font-medium">AWS Systems Manager Parameter Store</span> inside backend Lambdas, and the
          secret will never be sent to the browser again once that lands.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Egnyte File Share</CardTitle>
              <CardDescription>Client credentials used to connect to Egnyte for file storage.</CardDescription>
            </div>
            {loading ? null : configured ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" />
                Configured
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <CircleAlert className="size-3.5" />
                Not configured
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="egnyte-client-id">Key</Label>
            <Input
              id="egnyte-client-id"
              placeholder="CLIENT_ID"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="egnyte-client-secret">Secret</Label>
            <Input
              id="egnyte-client-secret"
              type="password"
              placeholder={status?.has_client_secret ? MASKED_SECRET_PLACEHOLDER : "CLIENT_SECRET"}
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              disabled={loading}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {status?.has_client_secret
                ? "A secret is configured. Leave this blank to keep it, or type a new one to replace it."
                : "No secret configured yet."}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={pending || loading}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
