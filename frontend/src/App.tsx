import { useState } from "react";
import { StartPage } from "./pages/StartPage";
import { CSATThanksPage } from "./pages/CSATThanksPage";
import { AgentLoginPage } from "./pages/AgentLoginPage";
import { AgentDashboardPage } from "./pages/AgentDashboardPage";
import { AgentChatPage } from "./pages/AgentChatPage";

type AgentInfo = { name: string; email: string };

export default function App() {
  const path = window.location.pathname;

  // ── Agent section (/agent*) ─────────────────────────────────────────
  if (path.startsWith("/agent")) {
    return <AgentSection path={path} />;
  }

  // ── CSAT thank-you page ─────────────────────────────────────────────
  if (path.startsWith("/csat/thanks")) {
    return <CSATThanksPage />;
  }

  // ── User chat (default) ─────────────────────────────────────────────
  return <StartPage />;
}

function AgentSection({ path }: { path: string }) {
  const [token, setToken] = useState<string>(() => localStorage.getItem("agent_token") || "");
  const [agent, setAgent] = useState<AgentInfo | null>(() => {
    try { return JSON.parse(localStorage.getItem("agent_info") || "null"); } catch { return null; }
  });
  // Which session the agent has open (from URL or state)
  const [openSession, setOpenSession] = useState<string | null>(() => {
    // /agent/chat/:sessionId
    const match = path.match(/^\/agent\/chat\/(.+)$/);
    return match ? match[1] : null;
  });

  function handleLogin(t: string, a: AgentInfo) {
    setToken(t);
    setAgent(a);
    // push to dashboard
    window.history.pushState({}, "", "/agent");
  }

  function handleLogout() {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_info");
    setToken("");
    setAgent(null);
    setOpenSession(null);
    window.history.pushState({}, "", "/agent");
  }

  function openChat(sessionId: string) {
    setOpenSession(sessionId);
    window.history.pushState({}, "", `/agent/chat/${sessionId}`);
  }

  function backToDashboard() {
    setOpenSession(null);
    window.history.pushState({}, "", "/agent");
  }

  // Not logged in
  if (!token || !agent) {
    return <AgentLoginPage onLogin={handleLogin} />;
  }

  // Agent has a chat open
  if (openSession) {
    return (
      <AgentChatPage
        sessionId={openSession}
        token={token}
        agent={agent}
        onBack={backToDashboard}
      />
    );
  }

  // Agent dashboard
  return (
    <AgentDashboardPage
      token={token}
      agent={agent}
      onOpenChat={openChat}
      onLogout={handleLogout}
    />
  );
}
