import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const socket = io(BACKEND_URL, { transports: ["websocket"] });

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

  // Set username from authenticated user
  useEffect(() => {
    if (user?.name) {
      usernameRef.current = user.name;
      socket.emit("join_user", user.name);
    }
  }, [user?.name]);

  // Join room and setup socket listeners
  useEffect(() => {
    if (!user?.id || !user?.name) return;

    // Emit join_user first to ensure socket.username is set on the server
    // before join_room is processed
    socket.emit("join_user", user.name);
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

      Object.entries(usersObj).forEach(([uname, data]) => {
        addCursorCSS(uname, data.color);
        if (!decorationsRef.current[uname]) {
          decorationsRef.current[uname] = { color: data.color, ids: [] };
        } else {
          decorationsRef.current[uname].color = data.color;
        }
      });
    });

    socket.on("user_joined", ({ user: uname, color: joinColor }) => {
      // Server doesn't always send color — fall back to existing or generate
      const color =
        joinColor ||
        decorationsRef.current[uname]?.color ||
        "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");

      setUsers((prev) => (prev.includes(uname) ? prev : [...prev, uname]));
      addCursorCSS(uname, color);
      if (!decorationsRef.current[uname]) {
        decorationsRef.current[uname] = { color, ids: [] };
      }
    });

    socket.on("user_left", ({ user: uname }) => {
      setUsers((prev) => prev.filter((u) => u !== uname));

      if (editorRef.current && decorationsRef.current[uname]?.ids) {
        editorRef.current.deltaDecorations(decorationsRef.current[uname].ids, []);
      }
      delete decorationsRef.current[uname];
    });

    // Cursor update — draw the collaborator's cursor in the editor
    socket.on("cursor_update", ({ user: uname, cursor }) => {
      if (!editorRef.current || !monacoRef.current) return;
      if (uname === usernameRef.current) return;

      // Ensure CSS is injected for this user
      const color =
        decorationsRef.current[uname]?.color ||
        "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");

      if (!decorationsRef.current[uname]) {
        decorationsRef.current[uname] = { color, ids: [] };
        addCursorCSS(uname, color);
      }

      clearTimeout(cursorTimers.current[uname]);
      cursorTimers.current[uname] = setTimeout(() => {
        applyDecoration(uname, cursor);
      }, 30);
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

  // Sanitize username to be a valid CSS class name
  const sanitizeForClass = (name) =>
    name.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Inject CSS for each user's cursor + label
  const addCursorCSS = (username, color) => {
    const safeClass = sanitizeForClass(username);
    const styleId = `cursor-style-${safeClass}`;
    // Remove old style if color changed
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = styleId;
    // Use inline-block label that works inside Monaco's span DOM
    style.innerHTML = `
      .cursor-${safeClass} {
        border-left: 3px solid ${color} !important;
        margin-left: -1px;
      }
      .cursor-line-${safeClass} {
        background: ${color}33 !important;
      }
      /* Label rendered as inline badge BEFORE the cursor span */
      .label-${safeClass}::before {
        content: "${username.replace(/"/g, "'")}";
        display: inline-block;
        background: ${color};
        color: #fff;
        font-size: 9px;
        font-weight: 700;
        padding: 0px 4px;
        border-radius: 3px;
        white-space: nowrap;
        vertical-align: super;
        line-height: 1.4;
        margin-right: 2px;
        opacity: 0.95;
      }
    `;
    document.head.appendChild(style);
  };

  // Apply or update Monaco decoration for a remote collaborator
  const applyDecoration = (username, cursor) => {
    if (!editorRef.current || !monacoRef.current) return;
    const safeClass = sanitizeForClass(username);
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (!model) return;

    const maxLines = model.getLineCount();
    const line = Math.max(1, Math.min(cursor.position.lineNumber, maxLines));
    const column = Math.max(1, Math.min(
      cursor.position.column,
      model.getLineMaxColumn(line)
    ));

    const range = cursor.selection &&
      (cursor.selection.startLineNumber !== cursor.selection.endLineNumber ||
       cursor.selection.startColumn !== cursor.selection.endColumn)
      ? new monaco.Range(
          Math.max(1, Math.min(cursor.selection.startLineNumber, maxLines)),
          Math.max(1, cursor.selection.startColumn),
          Math.max(1, Math.min(cursor.selection.endLineNumber, maxLines)),
          Math.max(1, cursor.selection.endColumn)
        )
      : new monaco.Range(line, column, line, column + 1);

    if (!decorationsRef.current[username]) {
      decorationsRef.current[username] = { ids: [] };
    }

    decorationsRef.current[username].ids = editor.deltaDecorations(
      decorationsRef.current[username].ids || [],
      [
        {
          range,
          options: {
            className: `cursor-${safeClass}`,
            inlineClassName: `cursor-line-${safeClass}`,
            beforeContentClassName: `label-${safeClass}`,
            hoverMessage: { value: `**${username}**` },
            zIndex: 100,
          },
        },
      ]
    );
  };

  
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

  // Judge0 CE language IDs
  const judge0LangIds = {
    python: 71,     // Python 3.8
    javascript: 63, // Node.js 12
    java: 62,       // OpenJDK 13
    c: 50,          // GCC 9.2 C
    cpp: 54,        // GCC 9.2 C++
  };

  // Run code via our backend proxy (avoids CORS + API key issues)
  const runCode = async () => {
    setLoading(true);
    setOutput("Running...");

    const languageId = judge0LangIds[language];
    if (!languageId) {
      setOutput(`Unsupported language: ${language}`);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_code: code, language_id: languageId }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server error ${response.status}: ${errText}`);
      }

      const data = await response.json();

      const result =
        data.stdout ||
        (data.stderr ? `Runtime Error:\n${data.stderr}` : null) ||
        (data.compile_output ? `Compile Error:\n${data.compile_output}` : null) ||
        (data.status?.description ? `Status: ${data.status.description}` : null) ||
        "No output";

      setOutput(result);
    } catch (err) {
      console.error(err);
      setOutput(`Error running code: ${err.message}`);
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
