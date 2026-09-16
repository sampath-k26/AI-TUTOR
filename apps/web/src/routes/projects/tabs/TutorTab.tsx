import { useState, type FormEvent } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { TutorReply } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  citations?: TutorReply["citations"];
  insufficientEvidence?: boolean;
}

export function TutorTab() {
  const project = useProjectContext();
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const question = input;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setSending(true);

    try {
      const reply = await apiClient.post<TutorReply>(`/projects/${project.id}/tutor/messages`, {
        content: question,
        conversationId,
      });
      setConversationId(reply.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply.answer, citations: reply.citations, insufficientEvidence: reply.insufficientEvidence },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Tutor didn't respond");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {messages.length === 0 && <p className="text-[13.5px] text-muted-foreground">Ask a question about this Project's materials.</p>}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-[13.5px]",
              m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-surface-2 text-foreground",
            )}
          >
            <p>{m.content}</p>
            {m.citations && m.citations.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px] opacity-80">
                {m.citations.map((c, ci) => (
                  <li key={ci}>
                    Source: {c.materialName} — Page {c.page}
                  </li>
                ))}
              </ul>
            )}
            {m.insufficientEvidence && <p className="mt-1.5 text-[12px] italic opacity-80">No confident, grounded answer was available.</p>}
          </div>
        ))}
      </div>

      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" disabled={sending} className="flex-1" />
        <Button type="submit" disabled={sending || !input.trim()}>
          {sending ? "Thinking…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
