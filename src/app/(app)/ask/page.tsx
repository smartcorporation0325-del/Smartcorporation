import { AskChat } from "@/components/ask/ask-chat";

export default function AskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ask Your Calls</h1>
        <p className="text-sm text-muted">
          Ask a question in plain language. We retrieve the relevant calls from your own database first, then send
          only that context to Claude — never the whole dataset.
        </p>
      </div>
      <AskChat />
    </div>
  );
}
