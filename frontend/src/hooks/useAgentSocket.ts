import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../lib/socket";
import { Message } from "./useChat";

export function useAgentSocket(token: string, sessionId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [newChats, setNewChats] = useState<{ sessionId: string; userMessage: string }[]>([]);
  const joinedSession = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("agent_online", { token });
      // If we already have a sessionId (agent opened a chat), join it
      if (sessionId && joinedSession.current !== sessionId) {
        socket.emit("agent_join_session", { token, sessionId });
        joinedSession.current = sessionId;
      }
    });

    socket.on("disconnect", () => setConnected(false));

    // Agent receives new chat notification
    socket.on("new_chat_assigned", (data: { sessionId: string; userMessage: string }) => {
      setNewChats(prev => {
        if (prev.find(c => c.sessionId === data.sessionId)) return prev;
        return [...prev, data];
      });
    });

    // Messages in the current session
    socket.on("session_history", ({ messages: msgs }: { messages: Message[] }) => {
      setMessages(msgs.filter(m => m.role !== "SYSTEM"));
    });

    socket.on("new_message", (msg: Message) => {
      if (msg.role === "SYSTEM") return;
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("new_chat_assigned");
      socket.off("session_history");
      socket.off("new_message");
      socket.disconnect();
      joinedSession.current = null;
    };
  }, [token, sessionId]);

  // Join a specific session to start chatting
  const joinSession = useCallback((sid: string) => {
    const socket = getSocket();
    setMessages([]);
    socket.emit("agent_join_session", { token, sessionId: sid });
    joinedSession.current = sid;
  }, [token]);

  const sendMessage = useCallback((sid: string, content: string) => {
    if (!content.trim()) return;
    const socket = getSocket();
    socket.emit("agent_message", { sessionId: sid, content });
  }, []);

  const dismissNewChat = useCallback((sid: string) => {
    setNewChats(prev => prev.filter(c => c.sessionId !== sid));
  }, []);

  return { messages, connected, newChats, joinSession, sendMessage, dismissNewChat };
}
