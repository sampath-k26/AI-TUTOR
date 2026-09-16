import { useState, type FormEvent } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { TutorReply } from "../../../lib/types";
import { useProjectContext } from "../ProjectLayout";

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
    <div className="tutor-tab">
      <h2>Tutor</h2>
      <div className="tutor-messages">
        {messages.length === 0 && <p>Ask a question about this Project's materials.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`tutor-message tutor-message-${m.role}`}>
            <p>{m.content}</p>
            {m.citations && m.citations.length > 0 && (
              <ul className="tutor-citations">
                {m.citations.map((c, ci) => (
                  <li key={ci}>
                    Source: {c.materialName} — Page {c.page}
                  </li>
                ))}
              </ul>
            )}
            {m.insufficientEvidence && <p className="tutor-insufficient-evidence">No confident, grounded answer was available.</p>}
          </div>
        ))}
      </div>

      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" disabled={sending} />
        <button type="submit" disabled={sending || !input.trim()}>
          {sending ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
