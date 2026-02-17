import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

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
                    Authenticating...
                </div>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/login" replace />;
}
