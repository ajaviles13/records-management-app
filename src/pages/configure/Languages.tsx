import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LanguageCode, NewLanguageInput } from "@/types";

const emptyDraft = (): NewLanguageInput => ({ code_id: "", language: "", country: "" });

export function ConfigureLanguagesPage() {
  const [languages, setLanguages] = useState<LanguageCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<NewLanguageInput>(emptyDraft());

  async function load() {
    setLoading(true);
    try {
      const { languages: rows } = await api.languageCodes();
      setLanguages([...rows].sort((a, b) => a.code_id.localeCompare(b.code_id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load language codes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function validate(input: NewLanguageInput): string | null {
    if (!input.code_id.trim()) return "Language code is required.";
    if (!/^[A-Za-z0-9]{1,12}$/.test(input.code_id.trim())) {
      return "Language code must be 1–12 letters or numbers with no spaces.";
    }
    if (!input.language.trim()) return "Language name is required.";
    return null;
  }

  async function createLanguage() {
    const input: NewLanguageInput = {
      code_id: draft.code_id.trim().toUpperCase(),
      language: draft.language.trim(),
      country: draft.country.trim(),
    };
    const error = validate(input);
    if (error) {
      toast.error(error);
      return;
    }
    setPending(true);
    try {
      await api.createLanguage(input);
      toast.success(`Added ${input.code_id}.`);
      setDialogOpen(false);
      setDraft(emptyDraft());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the language code.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Languages</h3>
          <p className="text-sm text-muted-foreground">
            Codes used on records. Each code_id must be unique.
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyDraft());
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add language
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Country</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  Loading languages…
                </TableCell>
              </TableRow>
            ) : languages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No language codes yet.
                </TableCell>
              </TableRow>
            ) : (
              languages.map((row) => (
                <TableRow key={row.code_id}>
                  <TableCell className="font-mono">{row.code_id}</TableCell>
                  <TableCell>{row.language}</TableCell>
                  <TableCell>{row.country || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="h-auto max-w-md">
          <DialogHeader>
            <DialogTitle>Add language</DialogTitle>
            <DialogDescription>
              The code is stored in language-codes.csv and must not already exist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="lang-code">Code</Label>
              <Input
                id="lang-code"
                value={draft.code_id}
                onChange={(event) => setDraft((current) => ({ ...current, code_id: event.target.value }))}
                placeholder="ES"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lang-name">Language</Label>
              <Input
                id="lang-name"
                value={draft.language}
                onChange={(event) => setDraft((current) => ({ ...current, language: event.target.value }))}
                placeholder="Spanish"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lang-country">Country</Label>
              <Input
                id="lang-country"
                value={draft.country}
                onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createLanguage()} disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
