import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem("access"));
    const [user, setUser] = useState(() => {
        try {
            const cached = localStorage.getItem("user_info");
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);
    const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");

    const fetchUserProfile = useCallback(async () => {
        const currentToken = localStorage.getItem("access");
        if (!currentToken) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const res = await api.get("/users/me/");
            setUser(res.data);
            localStorage.setItem("user_info", JSON.stringify(res.data));
        } catch (err) {
            console.warn("Could not fetch user profile on init:", err);
            // If token invalid, it will be handled by axios interceptor
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    const login = useCallback(async (accessToken, refreshToken, userDetails = null) => {
        localStorage.setItem("access", accessToken);
        localStorage.setItem("refresh", refreshToken);
        setToken(accessToken);
        setSessionExpiredMessage("");

        if (userDetails) {
            setUser(userDetails);
            localStorage.setItem("user_info", JSON.stringify(userDetails));
        } else {
            try {
                const res = await api.get("/users/me/");
                setUser(res.data);
                localStorage.setItem("user_info", JSON.stringify(res.data));
            } catch (err) {
                console.warn("Profile fetch after login failed:", err);
            }
        }
    }, []);

    const logout = useCallback((expiredReason = "") => {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("user_info");
        setToken(null);
        setUser(null);
        if (expiredReason) {
            setSessionExpiredMessage(expiredReason);
        }
    }, []);

    useEffect(() => {
        const handleSessionExpired = () => {
            logout("Your security session has expired. Please sign in again.");
        };
        window.addEventListener("nyaykosh_session_expired", handleSessionExpired);
        return () => window.removeEventListener("nyaykosh_session_expired", handleSessionExpired);
    }, [logout]);

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                isAuthenticated: Boolean(token),
                loading,
                sessionExpiredMessage,
                setSessionExpiredMessage,
                login,
                logout,
                refetchUser: fetchUserProfile
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

