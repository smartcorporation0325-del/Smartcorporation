"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { associateContactAction } from "@/app/(app)/calls/[id]/actions";

export function AssociateContact({ callId, hasContact }: { callId: string; hasContact: boolean }) {
  const [open, setOpen] = useState(!hasContact);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleAssociate() {
    setMessage(null);
    startTransition(async () => {
      const result = await associateContactAction(callId, phone, email);
      setMessage(result.detail);
      if (result.matched) setOpen(false);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Associate HubSpot contact / deal</div>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : hasContact ? "Change match" : "Associate manually"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">
            Matching priority: phone number, then email. Finds the HubSpot contact and any associated
            deals, and links them to this call — HubSpot itself is never modified.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15555550123" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
          </div>
          <Button size="sm" onClick={handleAssociate} disabled={pending || (!phone && !email)}>
            {pending ? "Searching…" : "Search & associate"}
          </Button>
          {message && <p className="text-xs text-muted">{message}</p>}
        </div>
      )}
    </div>
  );
}
