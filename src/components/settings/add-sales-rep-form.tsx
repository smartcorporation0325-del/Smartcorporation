"use client";

import { useRef, useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addSalesRepAction } from "@/app/(app)/settings/reps/actions";

export function AddSalesRepForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await addSalesRepAction(formData);
      setMessage(result.message);
      if (result.status === "success") formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="text-sm font-semibold">Add a sales rep</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Name</Label>
          <Input name="name" placeholder="Federico Nardelli" required />
        </div>
        <div>
          <Label>Email</Label>
          <Input name="email" type="email" placeholder="name@example.com" />
        </div>
        <div>
          <Label>Quo user ID</Label>
          <Input name="quoUserId" placeholder="US..." />
        </div>
        <div>
          <Label>HubSpot owner ID</Label>
          <Input name="hubspotOwnerId" placeholder="e.g. 448587540" />
        </div>
      </div>
      <p className="text-xs text-muted">
        Matched by name (case-insensitive) — if a rep with this name already exists, this fills in/updates their
        Quo and HubSpot IDs instead of creating a duplicate.
      </p>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save rep"}
      </Button>
      {message && <p className="text-xs text-muted">{message}</p>}
    </form>
  );
}
