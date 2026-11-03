import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login, sessionExpiredMessage } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await api.post("/api/token/", {
                username: username.trim(),
                password
            });

            await login(response.data.access, response.data.refresh);
            navigate("/chat");
        } catch (err) {
            console.error("Login failure:", err);
            if (!err.response) {
                setError("Unable to connect to the NyayKosh server. Please check your network connection.");
            } else if (err.response.status === 401) {
                setError("Invalid username or password. Please verify your credentials.");
            } else {
                setError(err.response?.data?.detail || "An unexpected error occurred during login. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#111315] dark:text-white transition-colors duration-200">
            {/* Theme Toggle Top Right */}
            <div className="absolute top-4 right-4 z-10">
                <button
                    onClick={toggleTheme}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-blue-600 dark:border-white/[0.1] dark:bg-[#16191D] dark:text-slate-300 dark:hover:border-white/[0.2] dark:hover:text-white"
                    title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    <span>{isDark ? "☀" : "🌙"}</span>
                    <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                </button>
            </div>

            <div className="flex min-h-screen items-center justify-center px-4 py-8">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl transition-colors dark:border-white/[0.08] dark:bg-[#16191D]">
                    <div className="mb-6 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                            N
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            NyayKosh
                        </h1>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            AI-Powered Legal Assistance for Indian Citizens
                        </p>
                    </div>

                    {sessionExpiredMessage && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                            {sessionExpiredMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Username
                            </label>
                            <input
                                type="text"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Password
                            </label>
                            <input
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                            />
                        </div>

                        {error && (
                            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-600/10 active:scale-[0.99]"
                        >
                            {loading ? "Authenticating..." : "Sign In"}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        Don't have an account?{" "}
                        <Link
                            to="/register"
                            className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                            Create an account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
