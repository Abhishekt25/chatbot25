import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../lib/socket";

export type Message = {
  id: string;
  role: "USER" | "AI" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: string;
};

export type SessionStatus = "BOT" | "PENDING_HUMAN" | "HUMAN" | "CLOSED";

export function useChat(sessionId: string, userId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<SessionStatus>("BOT");
  const [connected, setConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId || !userId) return;

    const socket = getSocket();
    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_session", { sessionId, userId });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("session_history", ({ messages: msgs, status: s }) => {
      setMessages(msgs.filter((m: Message) => m.role !== "SYSTEM"));
      setStatus(s);
    });

    socket.on("new_message", (msg: Message) => {
      if (msg.role !== "SYSTEM") {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      // Clear typing indicator when AI or agent replies
      if (msg.role === "AI" || msg.role === "AGENT") {
        setIsTyping(false);
        if (typingTimer.current) clearTimeout(typingTimer.current);
      }
    });

    socket.on("status_change", ({ status: s }: { status: SessionStatus }) => {
      setStatus(s);
    });

    socket.on("agent_joined", ({ message }: { agentName: string; message: string }) => {
      setStatus("HUMAN");
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "SYSTEM",
          content: message,
          createdAt: new Date().toISOString(),
        },
      ]);
    });
    
    socket.on("session_closed", ({ message }: { message: string }) => {
      setStatus("CLOSED");
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "SYSTEM",
          content: message,
          createdAt: new Date().toISOString(),
        },
      ]);
    });

    socket.on("no_agents_available", ({ message }: { message: string }) => {
      setStatus("BOT");
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "SYSTEM",
          content: message,
          createdAt: new Date().toISOString(),
        },
      ]);
    });

    socket.on("error", ({ message }: { message: string }) => {
      console.error("Socket error:", message);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("session_history");
      socket.off("new_message");
      socket.off("status_change");
      socket.off("agent_joined");
      socket.off("no_agents_available");
      socket.off("session_closed");
      socket.off("error");
      socket.disconnect();
    };
  }, [sessionId, userId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      const socket = getSocket();
      setIsTyping(true);
      // Auto-clear typing if no response in 15s
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setIsTyping(false), 15000);
      socket.emit("user_message", { sessionId, content });
    },
    [sessionId]
  );

  const requestHuman = useCallback(() => {
    const socket = getSocket();
    socket.emit("request_human", { sessionId });
    setIsTyping(true);
  }, [sessionId]);

  return { messages, status, connected, isTyping, sendMessage, requestHuman };
}
