import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function WorkspaceManager({
  workspaces,
  active,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onJoinRoom,
}) {
  const [newWorkspace, setNewWorkspace] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [copiedRoomId, setCopiedRoomId] = useState(null);

  const { user, getAuthHeaders } = useAuth();

  const handleCreate = async () => {
    if (!newWorkspace.trim()) return;
    setLoading(true);
    setError("");

    try {
      await onCreate(newWorkspace);
      setNewWorkspace("");
    } catch (err) {
      console.error("Error creating workspace:", err);
      setError("Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (ws) => {
    if (!renameValue.trim()) return alert("Name cannot be empty");

    try {
      await onRename(ws._id, renameValue);
      setEditingId(null);
      setRenameValue("");
    } catch (err) {
      console.error("Rename failed:", err);
      alert("Rename failed");
    }
  };

  const handleDelete = async (ws) => {
    // Check if user is the owner
    const isOwner = ws.ownerId === user?.id;

    const confirmMessage = isOwner
      ? `Delete workspace "${ws.name}"? This will remove it for all members.`
      : `Leave workspace "${ws.name}"? You can rejoin later with the room ID.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await onDelete(ws._id);
    } catch (err) {
      console.error(isOwner ? "Delete failed:" : "Leave failed:", err);
      alert(isOwner ? "Delete failed" : "Leave failed");
    }
  };

  const handleJoinRoom = async () => {
    if (!joinRoomId.trim()) return;
    setJoinLoading(true);
    setJoinError("");
    setJoinSuccess("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/workspaces/join`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomId: joinRoomId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to join room");
      }

      setJoinSuccess(data.message);
      setJoinRoomId("");

      // Refresh workspaces
      if (onJoinRoom) {
        onJoinRoom(data.workspace);
      }
    } catch (err) {
      console.error("Error joining room:", err);
      setJoinError(err.message);
    } finally {
      setJoinLoading(false);
    }
  };

  const copyRoomId = (roomId) => {
    navigator.clipboard.writeText(roomId);
    setCopiedRoomId(roomId);
    setTimeout(() => setCopiedRoomId(null), 2000);
  };

  return (
    <div style={{ padding: "var(--spacing-lg)", height: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <h2
          className="gradient-text"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            marginBottom: "var(--spacing-xs)",
          }}
        >
          Workspaces
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
          Manage your coding spaces
        </p>
      </div>

      {/* Create Workspace */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-sm)",
          marginBottom: "var(--spacing-lg)",
        }}
      >
        <input
          type="text"
          placeholder="New workspace..."
          value={newWorkspace}
          onChange={(e) => setNewWorkspace(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          style={{
            flex: 1,
            fontSize: "0.9rem",
            padding: "var(--spacing-sm) var(--spacing-md)",
          }}
        />
        <button
          onClick={handleCreate}
          disabled={loading}
          style={{
            background: "var(--gradient-primary)",
            color: "white",
            padding: "var(--spacing-sm) var(--spacing-lg)",
            borderRadius: "var(--radius-md)",
            fontWeight: 600,
            fontSize: "1.1rem",
            minWidth: "45px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-md)",
          }}
          className="hover-lift"
        >
          {loading ? <div className="spinner"></div> : "Create"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            color: "#ef4444",
            padding: "var(--spacing-sm)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            marginBottom: "var(--spacing-md)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Join Room Section */}
      <div
        style={{
          marginBottom: "var(--spacing-lg)",
          padding: "var(--spacing-md)",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <div style={{ marginBottom: "var(--spacing-sm)" }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Join a Room
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
          }}
        >
          <input
            type="text"
            placeholder="Enter room ID..."
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
            style={{
              flex: 1,
              fontSize: "0.85rem",
              padding: "var(--spacing-sm) var(--spacing-md)",
            }}
          />
          <button
            onClick={handleJoinRoom}
            disabled={joinLoading}
            style={{
              background: "var(--gradient-accent)",
              color: "white",
              padding: "var(--spacing-sm) var(--spacing-md)",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              fontSize: "0.85rem",
              minWidth: "70px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            className="hover-lift"
          >
            {joinLoading ? <div className="spinner"></div> : "Join"}
          </button>
        </div>
        {joinError && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              padding: "var(--spacing-xs) var(--spacing-sm)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              marginTop: "var(--spacing-sm)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            {joinError}
          </div>
        )}
        {joinSuccess && (
          <div
            style={{
              background: "rgba(34, 197, 94, 0.1)",
              color: "#22c55e",
              padding: "var(--spacing-xs) var(--spacing-sm)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              marginTop: "var(--spacing-sm)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
            }}
          >
            {joinSuccess}
          </div>
        )}
      </div>

      {/* Workspace List */}
      {workspaces.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "var(--spacing-xl)",
            color: "var(--text-muted)",
            fontSize: "0.9rem",
          }}
        >
          <p style={{ fontWeight: 600 }}>No workspaces yet</p>
          <p style={{ fontSize: "0.8rem", marginTop: "4px" }}>Create one to get started!</p>
        </div>
      ) : (
        <>
          {/* Active Workspace Room ID - Prominent Display */}
          {active && (
            <div
              style={{
                marginBottom: "var(--spacing-lg)",
                padding: "var(--spacing-md)",
                background: "var(--gradient-primary)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              <div style={{ marginBottom: "var(--spacing-sm)" }}>
                <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.8)", marginBottom: "4px" }}>
                  Share Room ID
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "white", marginBottom: "var(--spacing-xs)" }}>
                  {active.name}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--spacing-sm)",
                  alignItems: "stretch",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    background: "rgba(0, 0, 0, 0.3)",
                    padding: "var(--spacing-sm)",
                    borderRadius: "var(--radius-md)",
                    color: "white",
                    fontSize: "0.8rem",
                    wordBreak: "break-all",
                    fontFamily: "'Fira Code', monospace",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {active.roomId}
                </code>
                <button
                  onClick={() => copyRoomId(active.roomId)}
                  style={{
                    background: copiedRoomId === active.roomId
                      ? "rgba(34, 197, 94, 0.4)"
                      : "rgba(255, 255, 255, 0.25)",
                    color: "white",
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    minWidth: "65px",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                  className="hover-lift"
                  title="Copy Room ID"
                >
                  {copiedRoomId === active.roomId ? (
                    <span>Copied</span>
                  ) : (
                    <span>Copy</span>
                  )}
                </button>
              </div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255, 255, 255, 0.7)", marginTop: "var(--spacing-xs)" }}>
                {active.members?.length || 0} member{active.members?.length !== 1 ? 's' : ''} in this room
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            {workspaces.map((ws, index) => (
              <div
                key={ws._id}
                className="hover-scale animate-slideIn"
                style={{
                  background:
                    active?._id === ws._id
                      ? "var(--gradient-primary)"
                      : "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--spacing-md)",
                  cursor: "pointer",
                  border: `1px solid ${active?._id === ws._id
                    ? "transparent"
                    : "var(--border-primary)"
                    }`,
                  boxShadow:
                    active?._id === ws._id
                      ? "var(--shadow-glow)"
                      : "var(--shadow-sm)",
                  transition: "all var(--transition-base)",
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {editingId === ws._id ? (
                  <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        fontSize: "0.9rem",
                      }}
                    />
                    <button
                      onClick={() => handleRename(ws)}
                      style={{
                        background: "var(--accent-cyan)",
                        color: "white",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.85rem",
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        background: "var(--bg-secondary)",
                        color: "var(--text-secondary)",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.85rem",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      onClick={() => onSelect(ws)}
                      style={{ flex: 1, display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: active?._id === ws._id ? 600 : 500,
                            fontSize: "0.95rem",
                            color: active?._id === ws._id ? "white" : "var(--text-primary)",
                          }}
                        >
                          {ws.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: active?._id === ws._id ? "rgba(255, 255, 255, 0.7)" : "var(--text-muted)",
                            marginTop: "2px",
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--spacing-xs)",
                          }}
                        >
                          {active?._id === ws._id && <span>Active • </span>}
                          <span>{ws.members?.length || 0} member{ws.members?.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Room ID display for active workspace */}
                    {active?._id === ws._id && (
                      <div
                        style={{
                          width: "100%",
                          marginTop: "var(--spacing-sm)",
                          padding: "var(--spacing-sm)",
                          background: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.75rem",
                        }}
                      >
                        <div style={{ color: "rgba(255, 255, 255, 0.7)", marginBottom: "4px" }}>
                          Room ID (Share this):
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--spacing-xs)",
                          }}
                        >
                          <code
                            style={{
                              flex: 1,
                              background: "rgba(0, 0, 0, 0.3)",
                              padding: "4px 8px",
                              borderRadius: "var(--radius-xs)",
                              color: "white",
                              fontSize: "0.7rem",
                              wordBreak: "break-all",
                            }}
                          >
                            {ws.roomId}
                          </code>
                          <button
                            onClick={() => copyRoomId(ws.roomId)}
                            style={{
                              background: copiedRoomId === ws.roomId ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 255, 255, 0.2)",
                              color: "white",
                              padding: "4px 8px",
                              borderRadius: "var(--radius-xs)",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                            className="hover-lift"
                            title="Copy Room ID"
                          >
                            {copiedRoomId === ws.roomId ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!editingId && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      width: "100%",
                    }}
                  >
                    <div
                      onClick={() => onSelect(ws)}
                      style={{ flex: 1 }}
                    >
                    </div>

                    <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
                      <button
                        onClick={() => {
                          setEditingId(ws._id);
                          setRenameValue(ws.name);
                        }}
                        style={{
                          background: active?._id === ws._id
                            ? "rgba(255, 255, 255, 0.2)"
                            : "var(--bg-secondary)",
                          color: active?._id === ws._id ? "white" : "var(--text-secondary)",
                          padding: "var(--spacing-xs) var(--spacing-sm)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        className="hover-lift"
                        title="Rename"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ws)}
                        style={{
                          background: active?._id === ws._id
                            ? "rgba(239, 68, 68, 0.3)"
                            : "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                          padding: "var(--spacing-xs) var(--spacing-sm)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        className="hover-lift"
                        title={ws.ownerId === user?.id ? "Delete" : "Leave"}
                      >
                        {ws.ownerId === user?.id ? "Delete" : "Leave"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
