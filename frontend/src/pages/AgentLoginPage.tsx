import { useState } from "react";
import { apiPost } from "../lib/api";

type Props = { onLogin: (token: string, agent: any) => void };

export function AgentLoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email || !password) { setError("Both fields are required"); return; }
    setLoading(true); setError("");
    try {
      const data = await apiPost<{ token: string; agent: any }>("/api/auth/login", { email, password });
      localStorage.setItem("agent_token", data.token);
      localStorage.setItem("agent_info", JSON.stringify(data.agent));
      onLogin(data.token, data.agent);
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F3", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎧</div>
          <h1 style={{ color: "#2C2C2A", fontSize: 24, fontWeight: 700, margin: 0 }}>Agent Login</h1>
          <p style={{ color: "#5F5E5A", marginTop: 6, fontSize: 14 }}>Sign in to access your support dashboard</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #D3D1C7", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="agent@company.com"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
          <input
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={inputStyle}
          />

          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#FDE8E8", borderRadius: 8, color: "#B91C1C", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin} disabled={loading}
            style={{ marginTop: 20, width: "100%", padding: "13px 0", background: "#185FA5", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, color: "#5F5E5A", marginBottom: 6, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", color: "#2C2C2A", background: "#FAFAF9", boxSizing: "border-box" };
