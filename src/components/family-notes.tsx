import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const noteSchema = z.string().trim().min(1, "Write something first.").max(2000, "Notes are limited to 2000 characters.");

type NoteRow = {
  id: string;
  invite_id: string;
  household: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  is_change_log: boolean;
  created_at: string;
  updated_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Host notes and an automatic change log for one family, kept on the family file. */
export function FamilyNotes({
  household,
  inviteId,
  isOwner,
}: {
  household: string;
  inviteId: string | null;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const key = ["family-notes", household];
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const notes = useQuery({
    queryKey: key,
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_notes")
        .select("*")
        .eq("household", household)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const addNote = async () => {
    if (!inviteId) {
      toast.error("We couldn't find this family's celebration.");
      return;
    }
    const parsed = noteSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "That note isn't valid.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    let authorName = "Host";
    if (userData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      authorName = profile?.full_name || "Host";
    }
    const { error } = await supabase.from("family_notes").insert({
      invite_id: inviteId,
      household,
      body: parsed.data,
      author_id: userData.user?.id ?? null,
      author_name: authorName,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    toast.success("Note added");
    await qc.invalidateQueries({ queryKey: key });
  };

  const saveEdit = async (id: string) => {
    const parsed = noteSchema.safeParse(editDraft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "That note isn't valid.");
      return;
    }
    const { error } = await supabase
      .from("family_notes")
      .update({ body: parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingId(null);
    toast.success("Note updated");
    await qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("family_notes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Note deleted");
    await qc.invalidateQueries({ queryKey: key });
  };

  const rows = notes.data ?? [];

  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <MessageSquare className="size-4 text-primary" /> Host notes
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Private notes between hosts, plus an automatic log of edits made to this family's details.
      </p>

      <div className="mt-4 space-y-2">
        <Textarea
          value={draft}
          maxLength={2000}
          placeholder="Add a note for other hosts…"
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{draft.length}/2000</span>
          <Button size="sm" onClick={addNote} disabled={saving || !draft.trim()}>
            Add note
          </Button>
        </div>
      </div>

      <ul className="mt-6 space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          rows.map((n) => {
            const canEdit = !n.is_change_log && n.author_id === userId;
            const canDelete = !n.is_change_log && (n.author_id === userId || isOwner);
            return (
              <li
                key={n.id}
                className={
                  n.is_change_log
                    ? "rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground"
                    : "rounded-lg border border-border p-3 text-sm"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {n.is_change_log ? "Change log" : n.author_name || "Host"} · {formatDate(n.created_at)}
                  </p>
                  {editingId !== n.id && (canEdit || canDelete) ? (
                    <div className="flex items-center gap-1">
                      {canEdit ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditDraft(n.body);
                          }}
                          aria-label="Edit note"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="size-6" aria-label="Delete note">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                              <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(n.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {editingId === n.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editDraft}
                      maxLength={2000}
                      onChange={(e) => setEditDraft(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(n.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-line">{n.body}</p>
                )}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
