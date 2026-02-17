import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import WorkspaceManager from "./WorkspaceManager";
import CodeEditor from "./Editor";
import Chat from "./Chat";

export default function Layout() {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { user, logout, getAuthHeaders } = useAuth();

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/workspaces", {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (Array.isArray(data)) {
        setWorkspaces(data);
        if (data.length > 0) setActiveWorkspace(data[0]);
      }
    } catch (err) {
      console.error("Error fetching workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
    // Run migration for existing workspaces (one-time operation)
    runMigration();
  }, []);

  const runMigration = async () => {
    try {
      await fetch("http://localhost:5000/api/workspaces/migrate", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      console.log("✅ Workspace migration completed");
    } catch (err) {
      console.log("Migration note:", err);
      // Silent fail - migration is best-effort
    }
  };

  const handleCreateWorkspace = async (name) => {
    const res = await fetch("http://localhost:5000/api/workspaces", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });

    if (!res.ok) throw new Error("Failed to create workspace");

    const newWorkspace = await res.json();
    setWorkspaces((prev) => [...prev, newWorkspace]);
    setActiveWorkspace(newWorkspace);
  };

  const handleDeleteWorkspace = async (id) => {
    const res = await fetch(`http://localhost:5000/api/workspaces/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok) throw new Error("Failed to delete workspace");

    const data = await res.json();

    setWorkspaces((prev) => prev.filter((ws) => ws._id !== id));

    if (activeWorkspace?._id === id) {
      setActiveWorkspace(workspaces[0] || null);
    }

    // Show appropriate message based on action
    if (data.action === "deleted") {
      console.log("✅ Workspace deleted for all members");
    } else if (data.action === "left") {
      console.log("✅ You left the workspace");
    }
  };

  const handleRenameWorkspace = async (id, name) => {
    const res = await fetch(`http://localhost:5000/api/workspaces/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) throw new Error("Failed to rename workspace");

    const updated = await res.json();

    setWorkspaces((prev) =>
      prev.map((ws) => (ws._id === id ? updated : ws))
    );

    if (activeWorkspace?._id === id) {
      setActiveWorkspace(updated);
    }
  };

  const handleJoinRoom = (workspace) => {
    // Add the joined workspace to the list and set it as active
    setWorkspaces((prev) => {
      const exists = prev.some(ws => ws._id === workspace._id);
      if (exists) return prev;
      return [...prev, workspace];
    });
    setActiveWorkspace(workspace);
  };

  if (loading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          gap: "1.5rem",
        }}
      >
        <div className="spinner-lg"></div>
        <div style={{ fontSize: "1.1rem", fontWeight: 500 }}>
          Loading your workspace...
        </div>
      </div>
    );
  }

  return (
    <div
      className="animate-fadeIn"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          padding: "var(--spacing-md) var(--spacing-lg)",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-primary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)" }}>
          <span style={{ fontSize: "1.5rem" }}>💻</span>
          <div>
            <h2
              className="gradient-text"
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                marginBottom: "2px",
              }}
            >
              Code Editor
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Collaborative Workspace
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-lg)" }}>
          {/* User Info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              padding: "var(--spacing-sm) var(--spacing-md)",
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "var(--gradient-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "white",
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {user?.name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="hover-lift"
            style={{
              padding: "var(--spacing-sm) var(--spacing-lg)",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
            }}
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Workspace Sidebar */}
        <div
          className="glass-strong"
          style={{
            width: "280px",
            borderRight: "1px solid var(--border-primary)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            boxShadow: "var(--shadow-lg)",
            position: "relative",
            zIndex: 10,
          }}
        >
          <WorkspaceManager
            workspaces={workspaces}
            active={activeWorkspace}
            onSelect={setActiveWorkspace}
            onCreate={handleCreateWorkspace}
            onDelete={handleDeleteWorkspace}
            onRename={handleRenameWorkspace}
            onJoinRoom={handleJoinRoom}
          />
        </div>

        {/* Code Editor */}
        <div
          style={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <CodeEditor roomId={activeWorkspace?.roomId || "default-room"} />
        </div>

        {/* Chat Sidebar */}
        <div
          className="glass-strong"
          style={{
            width: "340px",
            borderLeft: "1px solid var(--border-primary)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            boxShadow: "var(--shadow-lg)",
            position: "relative",
            zIndex: 10,
          }}
        >
          <Chat roomId={activeWorkspace?.roomId || "default-room"} />
        </div>
      </div>
    </div>
  );
}
