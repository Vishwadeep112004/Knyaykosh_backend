import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, adminOnly = false }) {
    const { token, user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#111315]">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    <p className="text-xs font-mono text-gray-400">Loading NyayKosh...</p>
                </div>
            </div>
        );
    }

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && user && !user.is_staff) {
        return <Navigate to="/chat" replace />;
    }

    return children;
}

export function PublicRoute({ children }) {
    const { token, loading } = useAuth();

    if (loading) {
        return null;
    }

    if (token) {
        return <Navigate to="/chat" replace />;
    }

    return children;
}

