import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        console.log("📝 Form submitted with:", { name, email });

        // Validation
        if (password !== confirmPassword) {
            console.warn(" Passwords do not match");
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            console.warn(" Password too short");
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        console.log(" Starting registration process...");

        try {
            const result = await register(name, email, password);
            console.log(" Registration completed, navigating to editor...");
            navigate("/editor");
        } catch (err) {
            console.error(" Registration form error:", err);
            setError(err.message || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-primary)",
                padding: "var(--spacing-lg)",
            }}
        >
            <div
                className="glass-strong hover-lift animate-fadeIn"
                style={{
                    width: "100%",
                    maxWidth: "440px",
                    padding: "var(--spacing-xl)",
                    borderRadius: "var(--radius-xl)",
                    boxShadow: "var(--shadow-xl)",
                }}
            >
                {/* Logo/Header */}
                <div style={{ textAlign: "center", marginBottom: "var(--spacing-xl)" }}>
                    <div
                        style={{
                            fontSize: "3rem",
                            marginBottom: "var(--spacing-sm)",
                        }}
                    >
                        
                    </div>
                    <h1
                        className="gradient-text"
                        style={{
                            fontSize: "2rem",
                            fontWeight: 700,
                            marginBottom: "var(--spacing-xs)",
                        }}
                    >
                        Create Account
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
                        Join the collaborative coding platform
                    </p>
                </div>

                {/* Signup Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: "var(--spacing-md)" }}>
                        <label
                            style={{
                                display: "block",
                                marginBottom: "var(--spacing-xs)",
                                color: "var(--text-secondary)",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder=""
                            required
                            style={{
                                width: "100%",
                                padding: "var(--spacing-md)",
                                fontSize: "1rem",
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border-primary)",
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-primary)",
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "var(--spacing-md)" }}>
                        <label
                            style={{
                                display: "block",
                                marginBottom: "var(--spacing-xs)",
                                color: "var(--text-secondary)",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            style={{
                                width: "100%",
                                padding: "var(--spacing-md)",
                                fontSize: "1rem",
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border-primary)",
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-primary)",
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "var(--spacing-md)" }}>
                        <label
                            style={{
                                display: "block",
                                marginBottom: "var(--spacing-xs)",
                                color: "var(--text-secondary)",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 6 characters"
                            required
                            style={{
                                width: "100%",
                                padding: "var(--spacing-md)",
                                fontSize: "1rem",
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border-primary)",
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-primary)",
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "var(--spacing-lg)" }}>
                        <label
                            style={{
                                display: "block",
                                marginBottom: "var(--spacing-xs)",
                                color: "var(--text-secondary)",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required
                            style={{
                                width: "100%",
                                padding: "var(--spacing-md)",
                                fontSize: "1rem",
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border-primary)",
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-primary)",
                            }}
                        />
                    </div>

                    {error && (
                        <div
                            className="animate-slideIn"
                            style={{
                                background: "rgba(239, 68, 68, 0.1)",
                                color: "#ef4444",
                                padding: "var(--spacing-sm) var(--spacing-md)",
                                borderRadius: "var(--radius-md)",
                                fontSize: "0.9rem",
                                marginBottom: "var(--spacing-lg)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--spacing-sm)",
                            }}
                        >
                            <span></span>
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="hover-lift"
                        style={{
                            width: "100%",
                            padding: "var(--spacing-md)",
                            background: loading ? "var(--bg-elevated)" : "var(--gradient-primary)",
                            color: "white",
                            border: "none",
                            borderRadius: "var(--radius-md)",
                            fontSize: "1rem",
                            fontWeight: 600,
                            cursor: loading ? "not-allowed" : "pointer",
                            boxShadow: loading ? "none" : "var(--shadow-md)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "var(--spacing-sm)",
                        }}
                    >
                        {loading ? (
                            <>
                                <div className="spinner"></div>
                                <span>Creating account...</span>
                            </>
                        ) : (
                            "Create Account"
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-md)",
                        margin: "var(--spacing-xl) 0",
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            height: "1px",
                            background: "var(--border-primary)",
                        }}
                    ></div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        OR
                    </span>
                    <div
                        style={{
                            flex: 1,
                            height: "1px",
                            background: "var(--border-primary)",
                        }}
                    ></div>
                </div>

                {/* Login Link */}
                <div style={{ textAlign: "center" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            style={{
                                color: "var(--accent-cyan)",
                                fontWeight: 600,
                                textDecoration: "none",
                            }}
                            className="hover-scale"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
