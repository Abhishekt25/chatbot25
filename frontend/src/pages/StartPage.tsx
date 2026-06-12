import { useState } from "react";
import { apiPost } from "../lib/api";
import { ChatWidget } from "../components/ChatWidget";

type Session = { sessionId: string; userId: string; userName: string };

export function StartPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startChat() {
    setLoading(true);
    setError("");
    try {
      const data = await apiPost<Session>("/api/sessions", {
        name: name.trim() || "Guest",
        email: email.trim() || undefined,
      });
      setSession(data);
    } catch (err: any) {
      setError(err.message || "Could not connect. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F3", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <h1 style={{ color: "#2C2C2A", fontSize: 28, fontWeight: 700, margin: 0 }}>Support Chat</h1>
          <p style={{ color: "#5F5E5A", marginTop: 8, fontSize: 15 }}>
            Talk to our AI assistant — or get connected to a real person.
          </p>
        </div>

        {!session ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #D3D1C7", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h2 style={{ margin: "0 0 20px", color: "#2C2C2A", fontSize: 18 }}>Start a conversation</h2>

            <label style={{ display: "block", fontSize: 13, color: "#5F5E5A", marginBottom: 6 }}>
              Your name (optional)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul"
              style={inputStyle}
            />

            <label style={{ display: "block", fontSize: 13, color: "#5F5E5A", marginBottom: 6, marginTop: 14 }}>
              Email (optional — we'll send you the chat transcript)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul@example.com"
              onKeyDown={(e) => e.key === "Enter" && startChat()}
              style={inputStyle}
            />

            {error && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#FDE8E8", borderRadius: 8, color: "#B91C1C", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              onClick={startChat}
              disabled={loading}
              style={{
                marginTop: 20, width: "100%", padding: "13px 0",
                background: "#185FA5", color: "#fff", border: "none",
                borderRadius: 10, fontSize: 15, fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
              }}
            >
              {loading ? "Starting..." : "Start Chat →"}
            </button>
          </div>
        ) : (
          <div style={{ background: "#E1F5EE", borderRadius: 16, padding: 24, border: "1px solid #9FE1CB", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <h2 style={{ color: "#085041", margin: "0 0 8px" }}>
              Hi {session.userName}!
            </h2>
            <p style={{ color: "#085041", fontSize: 14, margin: 0 }}>
              Your chat is ready. Open the <strong>💬 button</strong> in the bottom-right corner to start talking.
            </p>
            {email && (
              <p style={{ color: "#0F6E56", fontSize: 13, marginTop: 10 }}>
                We'll send the transcript to <strong>{email}</strong> when you're done.
              </p>
            )}
          </div>
        )}
      </div>

      {session && (
        <ChatWidget sessionId={session.sessionId} userId={session.userId} />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid #D3D1C7", fontSize: 14, outline: "none",
  color: "#2C2C2A", background: "#FAFAF9", boxSizing: "border-box",
};
