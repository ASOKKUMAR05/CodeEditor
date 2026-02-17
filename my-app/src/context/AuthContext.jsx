import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem("token"));

    // Check if user is authenticated on mount
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const storedToken = localStorage.getItem("token");

        if (!storedToken) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch("http://localhost:5000/api/auth/verify", {
                headers: {
                    Authorization: `Bearer ${storedToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                setToken(storedToken);
            } else {
                localStorage.removeItem("token");
                setToken(null);
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            localStorage.removeItem("token");
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        console.log("🔵 Starting login for:", email);

        try {
            const response = await fetch("http://localhost:5000/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            console.log("🔵 Login response status:", response.status);

            const data = await response.json();
            console.log("🔵 Login response data:", data);

            if (!response.ok) {
                console.error("❌ Login failed:", data.error);
                throw new Error(data.error || "Login failed");
            }

            console.log("✅ Login successful! Setting token and user...");
            localStorage.setItem("token", data.token);
            setToken(data.token);
            setUser(data.user);
            console.log("✅ User authenticated:", data.user);
            return data;
        } catch (error) {
            console.error("❌ Login error:", error);
            throw error;
        }
    };

    const register = async (name, email, password) => {
        console.log("🔵 Starting registration for:", email);

        try {
            const response = await fetch("http://localhost:5000/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            console.log("🔵 Registration response status:", response.status);

            const data = await response.json();
            console.log("🔵 Registration response data:", data);

            if (!response.ok) {
                console.error("❌ Registration failed:", data.error);
                throw new Error(data.error || "Registration failed");
            }

            console.log("✅ Registration successful! Setting token and user...");
            localStorage.setItem("token", data.token);
            setToken(data.token);
            setUser(data.user);
            console.log("✅ User authenticated:", data.user);
            return data;
        } catch (error) {
            console.error("❌ Registration error:", error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    // Helper function to get auth headers
    const getAuthHeaders = () => {
        const storedToken = localStorage.getItem("token");
        return {
            "Content-Type": "application/json",
            ...(storedToken && { Authorization: `Bearer ${storedToken}` }),
        };
    };

    const value = {
        user,
        token,
        loading,
        login,
        register,
        logout,
        getAuthHeaders,
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
