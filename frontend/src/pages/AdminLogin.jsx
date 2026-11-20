import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { token, user, login, sessionExpiredMessage } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();

    // If already logged in with admin privileges, navigate directly to Admin dashboard
    useEffect(() => {
        if (token && user?.is_staff) {
            navigate("/admin", { replace: true });
        }
    }, [token, user, navigate]);

    const validateForm = () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError("Email address is required.");
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            setError("Please enter a valid email address.");
            return false;
        }

        if (!password) {
            setError("Password is required.");
            return false;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const response = await api.post("/api/admin/login/", {
                email: email.trim().toLowerCase(),
                password
            });

            const { access, refresh, user: adminUserData } = response.data;

            // Store tokens and admin user info via existing AuthContext
            await login(access, refresh, adminUserData);

            // Redirect directly to the Admin Dashboard
            navigate("/admin", { replace: true });
        } catch (err) {
            console.error("Admin login failed:", err);
            if (!err.response) {
                setError("Unable to connect to the NyayKosh server. Please ensure the backend is running.");
            } else if (err.response.status === 401) {
                setError("Invalid administrative credentials. Please verify your email and password.");
            } else if (err.response.status === 403) {
                setError(
                    err.response.data?.error ||
                    "Access denied. This account does not possess administrative privileges."
                );
            } else {
                setError(
                    err.response.data?.error ||
                    err.response.data?.detail ||
                    "Authentication failed. Please verify your details and try again."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#111315] dark:text-white transition-colors duration-200">
            {/* Top Navigation Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
                <Link
                    to="/login"
                    className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Citizen Portal</span>
                </Link>

                <button
                    onClick={toggleTheme}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-blue-600 dark:border-white/[0.1] dark:bg-[#16191D] dark:text-slate-300 dark:hover:border-white/[0.2] dark:hover:text-white"
                    title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    type="button"
                >
                    <span>{isDark ? "☀" : "🌙"}</span>
                    <span>{isDark ? "Light" : "Dark"}</span>
                </button>
            </div>

            {/* Main Login Card Container */}
            <div className="flex min-h-screen items-center justify-center px-4 py-16">
                <div className="w-full max-w-md">
                    {/* Header Branding */}
                    <div className="mb-6 text-center">
                        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-900 text-white font-bold text-2xl shadow-xl shadow-slate-900/10 dark:bg-blue-600 dark:shadow-blue-600/20 mb-3 border border-slate-800 dark:border-blue-500/30">
                            ⚖
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            NyayKosh
                        </h1>
                        <div className="mt-1 flex items-center justify-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                Admin Portal
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Administrative & Judicial Corpus Management Gateway
                        </p>
                    </div>

                    {/* Security Notice / Session Expired Banner */}
                    {sessionExpiredMessage && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                            {sessionExpiredMessage}
                        </div>
                    )}

                    {/* Error Banner */}
                    {error && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 transition-all">
                            <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="flex-1 leading-relaxed">{error}</span>
                            <button
                                onClick={() => setError("")}
                                className="text-red-500 hover:text-red-700 dark:hover:text-red-200"
                                type="button"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Card Form */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl transition-colors dark:border-white/[0.08] dark:bg-[#16191D]">
                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            {/* Email Field */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Admin Email
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="admin@nyaykosh.in"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (error) setError("");
                                        }}
                                        autoComplete="email"
                                        disabled={loading}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Password
                                    </label>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        placeholder="Enter administrator password"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (error) setError("");
                                        }}
                                        autoComplete="current-password"
                                        disabled={loading}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                        title={showPassword ? "Hide password" : "Show password"}
                                        tabIndex="-1"
                                    >
                                        {showPassword ? (
                                            /* Eye Closed SVG */
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                            </svg>
                                        ) : (
                                            /* Eye Open SVG */
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        <span>Authenticating Admin...</span>
                                    </>
                                ) : (
                                    <span>Sign In to Admin Portal</span>
                                )}
                            </button>
                        </form>

                        {/* Restricted Notice Footer */}
                        <div className="mt-6 border-t border-slate-100 pt-4 text-center dark:border-white/[0.05]">
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>Restricted access for designated NyayKosh administrators only.</span>
                            </p>
                        </div>
                    </div>

                    {/* Links to Register and Citizen Login */}
                    <div className="mt-5 space-y-2 text-center">
                        <div>
                            <Link
                                to="/admin/register"
                                className="text-xs font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition"
                            >
                                First-time administrator setup? <span className="font-semibold underline">Register Admin</span>
                            </Link>
                        </div>
                        <div>
                            <Link
                                to="/login"
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition"
                            >
                                Looking for Citizen Legal Assistance? <span className="underline">User Login</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminLogin;
