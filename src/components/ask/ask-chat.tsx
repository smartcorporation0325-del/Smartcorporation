"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { askQuestionAction } from "@/app/(app)/ask/actions";

const SUGGESTIONS = [
  "What are the top objections from the last 30 days?",
  "Why are clients not closing?",
  "Show me calls where Federico handled price objections poorly.",
  "What should I coach Federico on this week?",
  "Compare won and lost deals.",
  "Which calls had strong buying intent but no closing attempt?",
];

interface Exchange {
  question: string;
  answer: string;
  callsUsed: { id: string; name: string }[];
}

export function AskChat() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pending, startTransition] = useTransition();

  function ask(q: string) {
    if (!q.trim()) return;
    startTransition(async () => {
      const res = await askQuestionAction(q);
      setHistory((h) => [{ question: q, ...res }, ...h]);
      setQuestion("");
    });
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your calls..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
          />
          <Button onClick={() => ask(question)} disabled={pending}>
            {pending ? "Thinking…" : "Ask"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:bg-black/[0.03] hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        {history.map((h, i) => (
          <Card key={i} className="p-5">
            <div className="mb-2 text-sm font-semibold">{h.question}</div>
            <p className="whitespace-pre-wrap text-sm text-foreground/80">{h.answer}</p>
            {h.callsUsed.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <span className="text-xs text-muted">Based on:</span>
                {h.callsUsed.map((c) => (
                  <Link key={c.id} href={`/calls/${c.id}`} className="text-xs text-accent underline underline-offset-2">
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
