"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type Props = {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (next: string) => Promise<void>;
};

export function InlineEditable({ label, value, placeholder, multiline, onSave }: Props) {
  const { toast } = useToast();
  const [v, setV] = useState(value ?? "");
  const prev = useRef(value ?? "");
  const saving = useRef(false);

  useEffect(() => {
    setV(value ?? "");
    prev.current = value ?? "";
  }, [value]);

  async function commit() {
    const next = (v ?? "").trim();
    if (next === (prev.current ?? "").trim()) return;
    if (saving.current) return;

    saving.current = true;
    try {
      await onSave(next);
      prev.current = next;
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? String(e) });
      setV(prev.current);
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {multiline ? (
        <Textarea
          className="rounded-2xl"
          value={v}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <Input
          className="rounded-2xl"
          value={v}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
        />
      )}
    </div>
  );
}
