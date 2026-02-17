import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const socket = io("http://localhost:5000");

export default function Chat({ roomId }) {
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [joinError, setJoinError] = useState(null);

  const { user } = useAuth();
  const bottomRef = useRef();

  // Join user once
  useEffect(() => {
    const user = localStorage.getItem("username") || "User" + Date.now();
    localStorage.setItem("username", user);

    setUsername(user);
    socket.emit("join_user", user);
  }, []);

  // Join room and listen for chat events
  useEffect(() => {
    if (!roomId || !user?.id) return;

    socket.emit("join_room", roomId, user.id);

    // Reset message state
    setMessages([]);

    // Handle join errors
    socket.on("join_error", ({ error }) => {
      console.error("Join room error:", error);
      setJoinError(error);
    });

    // Receive chat history
    socket.on("chat_history", (msgs) => setMessages(msgs));

    // Receive new messages
    socket.on("receive_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("chat_history");
      socket.off("receive_message");
      socket.off("join_error");
    };
  }, [roomId, user?.id]);

  // Send message
  const send = () => {
    if (input.trim()) {
      socket.emit("send_message", { roomId, text: input });
      setInput("");
    }
  };

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate user avatar gradient
  const getUserGradient = (user) => {
    const hash = user.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue1 = hash % 360;
    const hue2 = (hash + 120) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 60%) 0%, hsl(${hue2}, 70%, 55%) 100%)`;
  };

  // Get initials for avatar
  const getInitials = (user) => {
    return user.substring(0, 2).toUpperCase();
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        color: "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--spacing-lg)",
          borderBottom: "1px solid var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <h2
          className="gradient-text"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            marginBottom: "var(--spacing-xs)",
          }}
        >
          Team Chat
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
            fontSize: "0.875rem",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--accent-cyan)",
              boxShadow: "0 0 10px var(--accent-cyan)",
            }}
            className="animate-pulse"
          ></div>
          <span style={{ color: "var(--text-secondary)" }}>
            Chatting as <strong style={{ color: "var(--accent-cyan)" }}>{username}</strong>
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flexGrow: 1,
          overflowY: "auto",
          padding: "var(--spacing-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-md)",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "var(--spacing-xl)",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "var(--spacing-sm)" }}>
              💬
            </div>
            <p style={{ fontSize: "0.95rem" }}>No messages yet</p>
            <p style={{ fontSize: "0.85rem" }}>Start the conversation!</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isOwn = m.user === username;
            return (
              <div
                key={i}
                className="animate-slideIn"
                style={{
                  display: "flex",
                  gap: "var(--spacing-sm)",
                  flexDirection: isOwn ? "row-reverse" : "row",
                  alignItems: "flex-start",
                  animationDelay: `${i * 30}ms`,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: getUserGradient(m.user),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "white",
                    flexShrink: 0,
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  {getInitials(m.user)}
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: "70%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      paddingLeft: isOwn ? 0 : "var(--spacing-sm)",
                      paddingRight: isOwn ? "var(--spacing-sm)" : 0,
                      textAlign: isOwn ? "right" : "left",
                    }}
                  >
                    {m.user}
                  </div>
                  <div
                    style={{
                      background: isOwn
                        ? "var(--gradient-primary)"
                        : "var(--bg-elevated)",
                      padding: "var(--spacing-sm) var(--spacing-md)",
                      borderRadius: isOwn
                        ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)"
                        : "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
                      boxShadow: "var(--shadow-sm)",
                      border: isOwn ? "none" : "1px solid var(--border-primary)",
                      wordWrap: "break-word",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.9rem",
                        lineHeight: 1.5,
                        color: isOwn ? "white" : "var(--text-primary)",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Box */}
      <div
        style={{
          padding: "var(--spacing-lg)",
          borderTop: "1px solid var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-sm)",
            alignItems: "center",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: "var(--spacing-sm) var(--spacing-md)",
              fontSize: "0.9rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-lg)",
            }}
          />

          <button
            onClick={send}
            disabled={!input.trim()}
            style={{
              background: "var(--gradient-primary)",
              color: "white",
              padding: "var(--spacing-sm) var(--spacing-lg)",
              borderRadius: "var(--radius-lg)",
              fontWeight: 600,
              fontSize: "0.9rem",
              boxShadow: "var(--shadow-md)",
              minWidth: "70px",
            }}
            className="hover-lift"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
