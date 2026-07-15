import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useChat, Message } from "../hooks/useChat";

type Props = { sessionId: string; userId: string };

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 14px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 8, height: 8, borderRadius: "50%", background: "#888780",
            animation: `chatDot 1.2s ${i * 0.2}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "USER";
  const isSystem = msg.role === "SYSTEM";

  if (isSystem) {
    return (
      <div style={{ textAlign: "center", margin: "8px 0" }}>
        <span style={{
          fontSize: 12, color: "#5F5E5A", background: "#F1EFE8",
          padding: "4px 12px", borderRadius: 20, border: "1px solid #D3D1C7",
        }}>
          {msg.content}
        </span>
      </div>
    );
  }

  const senderLabel =
    msg.role === "AI" ? "AI Assistant" : msg.role === "AGENT" ? "Support Agent" : "";
  const bubbleBg = isUser ? "#185FA5" : "#F1EFE8";
  const bubbleColor = isUser ? "#fff" : "#2C2C2A";
  const bubbleBorder = isUser ? "none" : "1px solid #D3D1C7";

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{ maxWidth: "78%" }}>
        {!isUser && senderLabel && (
          <div style={{
            fontSize: 11, fontWeight: 600, marginBottom: 3,
            color: msg.role === "AGENT" ? "#0F6E56" : "#534AB7",
          }}>
            {senderLabel}
          </div>
        )}
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: bubbleBg, color: bubbleColor, border: bubbleBorder,
          fontSize: 14, lineHeight: 1.55, wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
        <div style={{
          fontSize: 10, color: "#AAA8A0", marginTop: 3,
          textAlign: isUser ? "right" : "left",
        }}>
          {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit", minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

export function ChatWidget({ sessionId, userId }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, status, connected, isTyping, sendMessage, requestHuman } =
    useChat(sessionId, userId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Auto-open chat when agent closes it so user sees the notification
  useEffect(() => {
    if (status === "CLOSED") setOpen(true);
  }, [status]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || status === "CLOSED") return;
    sendMessage(trimmed);
    setInput("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const statusConfig = {
    BOT:           { label: "AI Assistant · Online",      dot: "#0F6E56" },
    PENDING_HUMAN: { label: "Connecting to agent...",     dot: "#BA7517" },
    HUMAN:         { label: "Live with support agent",    dot: "#0F6E56" },
    CLOSED:        { label: "Chat closed",                dot: "#888780" },
  };
  const { label: statusLabel, dot: dotColor } = statusConfig[status];

  const isClosed = status === "CLOSED";

  return (
    <>
      <style>{`
        @keyframes chatDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
        {open && (
          <div style={{
            width: 360, height: 540,
            background: "#fff", borderRadius: 16,
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column",
            marginBottom: 14, overflow: "hidden",
            border: "1px solid #D3D1C7",
            animation: "chatSlideUp 0.2s ease",
          }}>

            {/* ── Header ─────────────────────────────────────── */}
            <div style={{ background: isClosed ? "#5F5E5A" : "#185FA5", padding: "14px 16px", flexShrink: 0, transition: "background 0.3s" }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
                Support Chat
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
                {statusLabel}
              </div>
            </div>

            {/* ── Messages ───────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", background: "#FAFAF9" }}>
              {messages.length === 0 && !isTyping && (
                <div style={{ textAlign: "center", color: "#888780", fontSize: 14, marginTop: 60 }}>
                  👋 Hi! How can we help you today?
                </div>
              )}
              {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
              {isTyping && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "#F1EFE8", border: "1px solid #D3D1C7", borderRadius: "16px 16px 16px 4px" }}>
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* ── Talk to human link (only when AI is active) ── */}
            {status === "BOT" && (
              <div style={{ padding: "6px 14px", borderTop: "1px solid #EDEBE6", background: "#fff", flexShrink: 0 }}>
                <button
                  onClick={requestHuman}
                  style={{
                    background: "none", border: "none", color: "#185FA5",
                    fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline",
                  }}
                >
                  Talk to a human agent
                </button>
              </div>
            )}

            {/* ── CLOSED: banner + Start New Chat ────────────── */}
            {isClosed && (
              <div style={{
                padding: "18px 16px", borderTop: "1px solid #EDEBE6",
                background: "#E1F5EE", flexShrink: 0, textAlign: "center",
              }}>
                <div style={{ fontSize: 13, color: "#085041", fontWeight: 500, marginBottom: 4 }}>
                  Chat closed by support agent
                </div>
                <div style={{ fontSize: 12, color: "#0F6E56", marginBottom: 14, lineHeight: 1.5 }}>
                  Your transcript has been sent to your email.
                </div>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    background: "#185FA5", color: "#fff", border: "none",
                    borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, width: "100%",
                  }}
                >
                  💬 Start New Chat
                </button>
              </div>
            )}

            {/* ── Input (hidden when closed) ──────────────────── */}
            {!isClosed && (
              <div style={{
                padding: "10px 12px", borderTop: "1px solid #EDEBE6",
                background: "#fff", display: "flex", gap: 8, flexShrink: 0,
              }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={!connected ? "Connecting..." : "Type a message…"}
                  disabled={!connected}
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 8,
                    border: "1px solid #D3D1C7", fontSize: 14, outline: "none",
                    background: !connected ? "#F5F5F3" : "#fff", color: "#2C2C2A",
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!connected || !input.trim()}
                  style={{
                    background: "#185FA5", color: "#fff", border: "none",
                    borderRadius: 8, padding: "9px 16px", cursor: "pointer",
                    fontSize: 14, fontWeight: 500,
                    opacity: !connected || !input.trim() ? 0.45 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  Send
                </button>
              </div>
            )}

          </div>
        )}

        {/* ── Floating button ─────────────────────────────────── */}
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: isClosed ? "#5F5E5A" : "#185FA5",
            color: "#fff", border: "none", cursor: "pointer", fontSize: 22,
            boxShadow: "0 4px 16px rgba(24,95,165,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.3s",
          }}
          title={open ? "Close chat" : "Open chat"}
        >
          {open ? "✕" : "💬"}
        </button>
      </div>
    </>
  );
}