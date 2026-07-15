import { useState, useEffect } from "react";
import { apiGet } from "../lib/api";
import { useAgentSocket } from "../hooks/useAgentSocket";

type Session = {
  id: string;
  status: string;
  updatedAt: string;
  user: { name: string | null; email: string | null };
  agent: { name: string } | null;
  messages: { content: string; role: string }[];
};

type Props = {
  token: string;
  agent: { name: string; email: string };
  onOpenChat: (sessionId: string) => void;
  onLogout: () => void;
};

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  BOT:          { bg: "#E1F5EE", color: "#0F6E56", label: "AI Chat" },
  PENDING_HUMAN:{ bg: "#FFF3CD", color: "#856404", label: "Waiting" },
  HUMAN:        { bg: "#D1E7FF", color: "#0A3D7A", label: "Live" },
  CLOSED:       { bg: "#F1EFE8", color: "#5F5E5A", label: "Closed" },
};

export function AgentDashboardPage({ token, agent, onOpenChat, onLogout }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const { connected, newChats, dismissNewChat } = useAgentSocket(token);

  async function loadSessions() {
    try {
      const status = filter === "ALL" ? "" : `?status=${filter}`;
      const data = await apiGet<{ sessions: Session[] }>(`/api/sessions${status}`, token);
      setSessions(data.sessions);
    } catch (err) {
      console.error("Failed to load sessions", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSessions(); }, [filter]);

  // Refresh when new chat comes in
  useEffect(() => {
    if (newChats.length > 0) loadSessions();
  }, [newChats]);

  // Auto-refresh every 15s
  useEffect(() => {
    const t = setInterval(loadSessions, 15000);
    return () => clearInterval(t);
  }, [filter]);

  const filters = ["ALL", "PENDING_HUMAN", "HUMAN", "BOT", "CLOSED"];

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F3" }}>
      {/* Header */}
      <div style={{ background: "#185FA5", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>🎧 Agent Dashboard</h1>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#4ade80" : "#f87171", display: "inline-block", marginRight: 5 }} />
            {connected ? `Online as ${agent.name}` : "Connecting..."}
          </div>
        </div>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>
          Sign out
        </button>
      </div>

      {/* New chat notifications */}
      {newChats.map(nc => (
        <div key={nc.sessionId} style={{ background: "#0F6E56", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <strong>🔔 New chat assigned!</strong>
            <span style={{ marginLeft: 10, fontSize: 13, opacity: 0.9 }}>"{nc.userMessage.slice(0, 60)}..."</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onOpenChat(nc.sessionId); dismissNewChat(nc.sessionId); }}
              style={{ background: "#fff", color: "#0F6E56", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              Open Chat
            </button>
            <button onClick={() => dismissNewChat(nc.sessionId)}
              style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>
              ✕
            </button>
          </div>
        </div>
      ))}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 20, border: "1px solid #D3D1C7", cursor: "pointer", fontSize: 13, fontWeight: 500,
              background: filter === f ? "#185FA5" : "#fff", color: filter === f ? "#fff" : "#5F5E5A",
            }}>
              {f === "ALL" ? "All Chats" : statusColors[f]?.label || f}
            </button>
          ))}
          <button onClick={loadSessions} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 20, border: "1px solid #D3D1C7", cursor: "pointer", fontSize: 13, background: "#fff", color: "#5F5E5A" }}>
            ↻ Refresh
          </button>
        </div>

        {/* Sessions list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#888780" }}>Loading chats...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#888780" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            No chats yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.map(s => {
              const sc = statusColors[s.status] || statusColors.CLOSED;
              const lastMsg = s.messages[0];
              const time = new Date(s.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
              return (
                <div key={s.id} onClick={() => onOpenChat(s.id)}
                  style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #D3D1C7", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "box-shadow 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: "#2C2C2A", fontSize: 15 }}>
                        {s.user.name || "Guest"}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                        {sc.label}
                      </span>
                      {s.agent && <span style={{ fontSize: 12, color: "#888780" }}>→ {s.agent.name}</span>}
                    </div>
                    {s.user.email && <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{s.user.email}</div>}
                    {lastMsg && (
                      <div style={{ fontSize: 13, color: "#5F5E5A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#888780", marginRight: 4 }}>
                          {lastMsg.role === "USER" ? "User:" : lastMsg.role === "AI" ? "AI:" : "Agent:"}
                        </span>
                        {lastMsg.content}
                      </div>
                    )}
                  </div>
                  <div style={{ marginLeft: 16, flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#888780" }}>{time}</div>
                    {s.status === "PENDING_HUMAN" && (
                      <div style={{ fontSize: 12, color: "#856404", fontWeight: 600, marginTop: 4 }}>⚠ Needs agent</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
