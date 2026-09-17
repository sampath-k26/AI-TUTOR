import { TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { TutorStreamEvent } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { cn } from "../../../lib/utils";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ materialId: string; materialName: string; page: number }>;
  insufficientEvidence?: boolean;
  groundingUncertain?: boolean;
  notice?: string;
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
    setMessages((prev) => [...prev, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setSending(true);

    function updateLastMessage(update: (last: DisplayMessage) => DisplayMessage) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next.at(-1);
        if (last) next[next.length - 1] = update(last);
        return next;
      });
    }

    try {
      await apiClient.postStream<TutorStreamEvent>(`/projects/${project.id}/tutor/messages/stream`, { content: question, conversationId }, (event) => {
        if (event.type === "start") {
          setConversationId(event.conversationId);
        } else if (event.type === "token") {
          updateLastMessage((last) => ({ ...last, content: last.content + event.delta }));
        } else if (event.type === "notice") {
          updateLastMessage((last) => ({ ...last, notice: event.message }));
        } else if (event.type === "done") {
          updateLastMessage((last) => ({
            ...last,
            citations: event.citations,
            insufficientEvidence: event.insufficientEvidence,
            groundingUncertain: event.groundingUncertain,
          }));
        } else if (event.type === "error") {
          setError(event.message);
        }
      });
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
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.citations && m.citations.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px] opacity-80">
                {m.citations.map((c, ci) => (
                  <li key={ci}>
                    Source: {c.materialName} — Page {c.page}
                  </li>
                ))}
              </ul>
            )}
            {m.insufficientEvidence && !m.content && <p className="mt-1.5 text-[12px] italic opacity-80">No confident, grounded answer was available.</p>}
            {m.groundingUncertain && (
              <Alert variant="warning" className="mt-2">
                <TriangleAlert />
                <AlertDescription>{m.notice ?? "This answer's grounding could not be fully verified — treat it with extra caution."}</AlertDescription>
              </Alert>
            )}
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
