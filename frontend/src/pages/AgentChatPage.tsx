import { useState, useRef, useEffect } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useAgentSocket } from "../hooks/useAgentSocket";
import { Message } from "../hooks/useChat";

type Props = {
  sessionId: string;
  token: string;
  agent: { name: string };
  onBack: () => void;
};

type SessionInfo = {
  status: string;
  user: { name: string | null; email: string | null };
};

const roleBg: Record<string, string> = {
  USER: "#185FA5", AI: "#534AB7", AGENT: "#0F6E56",
};

function Bubble({ msg, agentName }: { msg: Message; agentName: string }) {
  const isUser = msg.role === "USER";
  const isSystem = msg.role === "SYSTEM";

  if (isSystem) {
    return (
      <div style={{ textAlign: "center", margin: "8px 0" }}>
        <span style={{ fontSize: 12, color: "#5F5E5A", background: "#F1EFE8", padding: "4px 12px", borderRadius: 20, border: "1px solid #D3D1C7" }}>
          {msg.content}
        </span>
      </div>
    );
  }

  const isAgent = msg.role === "AGENT";
  const isRight = isAgent; // agent messages on right
  const label = isUser ? "User" : msg.role === "AI" ? "AI Bot" : agentName;

  return (
    <div style={{ display: "flex", justifyContent: isRight ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{ maxWidth: "75%" }}>
        {!isRight && (
          <div style={{ fontSize: 11, fontWeight: 600, color: roleBg[msg.role] || "#888", marginBottom: 3 }}>{label}</div>
        )}
        <div style={{
          padding: "10px 14px", fontSize: 14, lineHeight: 1.55, wordBreak: "break-word",
          borderRadius: isRight ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isRight ? "#0F6E56" : "#F1EFE8",
          color: isRight ? "#fff" : "#2C2C2A",
          border: isRight ? "none" : "1px solid #D3D1C7",
        }}>
          {msg.content}
        </div>
        <div style={{ fontSize: 10, color: "#AAA8A0", marginTop: 3, textAlign: isRight ? "right" : "left" }}>
          {new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

export function AgentChatPage({ sessionId, token, agent, onBack }: Props) {
  const [input, setInput] = useState("");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, connected, joinSession, sendMessage } = useAgentSocket(token, sessionId);

  useEffect(() => {
    joinSession(sessionId);
    // Load session info
    apiGet<{ session: SessionInfo }>(`/api/sessions/${sessionId}`, token)
      .then(d => setSessionInfo(d.session))
      .catch(console.error);
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || closed) return;
    sendMessage(sessionId, input.trim());
    setInput("");
  }

  async function handleClose() {
    if (!confirm("Close this chat and send transcript to user?")) return;
    setClosing(true);
    try {
      await apiPost(`/api/sessions/${sessionId}/close`, {}, token);
      setClosed(true);
    } catch (err) {
      alert("Failed to close session");
    } finally {
      setClosing(false);
    }
  }

  const statusLabel = closed ? "Closed" : sessionInfo?.status === "HUMAN" ? "Live" : sessionInfo?.status === "PENDING_HUMAN" ? "Waiting for you" : sessionInfo?.status || "Loading...";

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F3", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#0F6E56", padding: "13px 20px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
            {sessionInfo?.user.name || "Guest"}
            {sessionInfo?.user.email && <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 8, opacity: 0.8 }}>{sessionInfo.user.email}</span>}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#4ade80" : "#f87171", display: "inline-block", marginRight: 5 }} />
            {statusLabel}
          </div>
        </div>
        {!closed && (
          <button onClick={handleClose} disabled={closing} style={{ background: "#B91C1C", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            {closing ? "Closing..." : "Close Chat"}
          </button>
        )}
      </div>

      {/* Chat history — shows full AI + agent conversation */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", maxWidth: 700, width: "100%", margin: "0 auto" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#888780", fontSize: 14, marginTop: 60 }}>Loading conversation...</div>
        )}
        {messages.map(m => <Bubble key={m.id} msg={m} agentName={agent.name} />)}
        <div ref={bottomRef} />
      </div>

      {/* Closed banner */}
      {closed && (
        <div style={{ background: "#E1F5EE", padding: "12px 20px", textAlign: "center", color: "#085041", fontSize: 14, fontWeight: 500 }}>
           Chat closed — transcript & CSAT email sent to user.
        </div>
      )}

      {/* Input */}
      {!closed && (
        <div style={{ borderTop: "1px solid #D3D1C7", background: "#fff", padding: "12px 20px", display: "flex", gap: 10, maxWidth: 700, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type your reply…"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 14, outline: "none" }}
          />
          <button onClick={handleSend} disabled={!input.trim()} style={{
            background: "#0F6E56", color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 500,
            opacity: !input.trim() ? 0.5 : 1,
          }}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}
