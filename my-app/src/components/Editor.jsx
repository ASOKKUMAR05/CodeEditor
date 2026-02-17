import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const socket = io("http://localhost:5000", { transports: ["websocket"] });

const CodeEditor = ({ roomId = "default-room" }) => {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("Output will appear here...");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [joinError, setJoinError] = useState(null);

  const { user } = useAuth();

  const usernameRef = useRef("");
  const editorRef = useRef(null);
  const decorationsRef = useRef({});
  const monacoRef = useRef(null);
  const isRemoteChange = useRef(false);
  const cursorTimers = useRef({});

  const templates = {
    python: `# Python code
print("Hello, Python!")`,

    javascript: `// JavaScript code
console.log("Hello, JavaScript!");`,

    java: `// Java code
public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, Java!");
  }
}`,

    c: `// C code
#include <stdio.h>

int main() {
  printf("Hello, C!\\n");
  return 0;
}`,

    cpp: `// C++ code
#include <iostream>
using namespace std;

int main() {
  cout << "Hello, C++!" << endl;
  return 0;
}`,
  };

  const languageIcons = {
    python: "",
    javascript: "",
    java: "",
    c: "",
    cpp: "",
  };

  // Assign random username
  useEffect(() => {
    let stored = localStorage.getItem("username");
    if (!stored) {
      stored = "User" + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem("username", stored);
    }
    usernameRef.current = stored;
    socket.emit("join_user", stored);
  }, []);

  // Join room and setup socket listeners
  useEffect(() => {
    if (!user?.id) return;

    socket.emit("join_room", roomId, user.id);

    // Handle join errors
    socket.on("join_error", ({ error }) => {
      console.error("Join room error:", error);
      setJoinError(error);
    });

    socket.on("code_sync", (updatedCode) => {
      isRemoteChange.current = true;
      setCode(updatedCode);
    });

    socket.on("users_in_room", (usersObj) => {
      setUsers(Object.keys(usersObj));

      Object.entries(usersObj).forEach(([user, data]) => {
        addCursorCSS(user, data.color);

        decorationsRef.current[user] = decorationsRef.current[user] || {
          color: data.color,
          ids: [],
        };
      });
    });

    socket.on("user_joined", ({ user, color }) => {
      setUsers((prev) => (prev.includes(user) ? prev : [...prev, user]));

      addCursorCSS(user, color);
      decorationsRef.current[user] = { color, ids: [] };
    });

    socket.on("user_left", ({ user }) => {
      setUsers((prev) => prev.filter((u) => u !== user));

      if (editorRef.current && decorationsRef.current[user]?.ids) {
        editorRef.current.deltaDecorations(decorationsRef.current[user].ids, []);
      }

      delete decorationsRef.current[user];
    });

    // Cursor update
    socket.on("cursor_update", ({ user, cursor }) => {
      if (!editorRef.current || !monacoRef.current) return;
      if (user === usernameRef.current) return;

      const editor = editorRef.current;
      const monaco = monacoRef.current;

      clearTimeout(cursorTimers.current[user]);

      cursorTimers.current[user] = setTimeout(() => {
        const model = editor.getModel();
        if (!model) return;

        const maxLines = model.getLineCount();

        const line = Math.min(cursor.position.lineNumber, maxLines);
        const column = Math.min(
          cursor.position.column,
          model.getLineMaxColumn(line)
        );

        const color = decorationsRef.current[user]?.color || "#ff0000";

        const range = cursor.selection
          ? new monaco.Range(
            Math.min(cursor.selection.startLineNumber, maxLines),
            Math.min(
              cursor.selection.startColumn,
              model.getLineMaxColumn(line)
            ),
            Math.min(cursor.selection.endLineNumber, maxLines),
            Math.min(
              cursor.selection.endColumn,
              model.getLineMaxColumn(line)
            )
          )
          : new monaco.Range(line, column, line, column);

        decorationsRef.current[user].ids = editor.deltaDecorations(
          decorationsRef.current[user].ids || [],
          [
            {
              range,
              options: {
                className: `cursor-${user}`,
                inlineClassName: `cursor-${user}`,
                afterContentClassName: `label-${user}`,
              },
            },
          ]
        );
      }, 50);
    });

    return () => {
      socket.off("code_sync");
      socket.off("cursor_update");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("users_in_room");
      socket.off("join_error");
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    setCode(templates[language]);
  }, [language]);

  // Inject CSS for each user's cursor + label
  const addCursorCSS = (user, color) => {
    if (document.getElementById(`cursor-style-${user}`)) return;

    const style = document.createElement("style");
    style.id = `cursor-style-${user}`;

    style.innerHTML = `
      .cursor-${user} {
        border-left: 2px solid ${color} !important;
        border-radius: 2px;
      }
      .label-${user}::after {
        content: "${user}";
        background: ${color};
        color: white;
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 3px;
        margin-left: 4px;
      }
    `;

    document.head.appendChild(style);
  };

  // Editor mount
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onDidChangeCursorPosition(() => {
      const position = editor.getPosition();
      const selection = editor.getSelection();

      socket.emit("cursor_change", {
        roomId,
        cursor: { position, selection },
      });
    });
  };

  const handleCodeChange = (value) => {
    if (!isRemoteChange.current) {
      setCode(value);
      socket.emit("code_change", { roomId, code: value });
    } else {
      isRemoteChange.current = false;
    }
  };

  // Run code using Piston API
  const runCode = async () => {
    setLoading(true);
    setOutput("Running...");

    try {
      const response = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          version: "*",
          files: [{ content: code }],
        }),
      });

      const data = await response.json();

      const result =
        data?.run?.output ||
        data?.run?.stdout ||
        data?.run?.stderr ||
        "No output";

      setOutput(result);
    } catch (err) {
      console.error(err);
      setOutput("Error running code!");
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary)",
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--spacing-md)",
          }}
        >
          <div>
            <h1
              className="gradient-text"
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "4px",
              }}
            >
              Code Editor
            </h1>
            <div
              style={{
                display: "flex",
                gap: "var(--spacing-md)",
                fontSize: "0.85rem",
                color: "var(--text-muted)",
              }}
            >
              <span>
                Room: <strong style={{ color: "var(--accent-yellow)" }}>{roomId}</strong>
              </span>
              <span>•</span>
              <span>
                You: <strong style={{ color: "var(--accent-cyan)" }}>{usernameRef.current}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Connected Users */}
        <div
          style={{
            padding: "var(--spacing-sm) var(--spacing-md)",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-primary)",
            marginBottom: "var(--spacing-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              👥 Connected:
            </span>
            {users.length > 0 ? (
              <div style={{ display: "flex", gap: "var(--spacing-xs)", flexWrap: "wrap" }}>
                {users.map((user, i) => (
                  <span
                    key={i}
                    style={{
                      background: "var(--gradient-accent)",
                      color: "white",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {user}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                No other users
              </span>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-md)",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: "200px" }}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--spacing-sm) var(--spacing-md)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {Object.keys(templates).map((lang) => (
                <option key={lang} value={lang}>
                  {languageIcons[lang]} {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={runCode}
            disabled={loading}
            style={{
              background: loading ? "var(--bg-elevated)" : "var(--gradient-primary)",
              color: "white",
              padding: "var(--spacing-sm) var(--spacing-lg)",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              fontSize: "0.95rem",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              boxShadow: loading ? "none" : "var(--shadow-md)",
              minWidth: "120px",
              justifyContent: "center",
            }}
            className={loading ? "" : "hover-lift"}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Running...
              </>
            ) : (
              <>
                ▶️ Run Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div
        style={{
          flex: 1,
          border: "1px solid var(--border-primary)",
          margin: "var(--spacing-lg)",
          marginTop: 0,
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onMount={handleEditorMount}
          onChange={handleCodeChange}
          options={{
            fontSize: 15,
            fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            lineNumbers: "on",
            renderLineHighlight: "all",
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            smoothScrolling: true,
            fontLigatures: true,
          }}
        />
      </div>

      {/* Output */}
      <div
        style={{
          margin: "0 var(--spacing-lg) var(--spacing-lg)",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div
          style={{
            padding: "var(--spacing-sm) var(--spacing-md)",
            background: "var(--bg-tertiary)",
            borderBottom: "1px solid var(--border-primary)",
            fontWeight: 600,
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
          }}
        >
          <span>📟</span>
          <span>OUTPUT</span>
        </div>
        <div
          className="code-font"
          style={{
            padding: "var(--spacing-md)",
            color: "var(--text-primary)",
            minHeight: "120px",
            maxHeight: "200px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          {output}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
