import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Register() {
    const [form, setForm] = useState({
        username: "",
        name: "",
        age: "",
        profession: "",
        email: "",
        password: ""
    });

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const register = async (e) => {
        e.preventDefault();
        setMessage("");
        setLoading(true);

        try {
            await api.post("/users/", form);

            const tokenRes = await api.post("/api/token/", {
                username: form.username.trim(),
                password: form.password
            });

            await login(tokenRes.data.access, tokenRes.data.refresh);
            navigate("/chat");
        } catch (error) {
            console.error("Registration error:", error);
            if (!error.response) {
                setMessage("Unable to connect to the NyayKosh server. Please check your network connection.");
            } else {
                setMessage(
                    error.response?.data?.detail ||
                    Object.values(error.response?.data || {})
                        .flat()
                        .join(" ") || "Registration failed. Please check your inputs."
                );
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
                            Create Your Citizen Legal Assistance Account
                        </p>
                    </div>

                    <form onSubmit={register} className="space-y-3.5">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Username *
                            </label>
                            <input
                                name="username"
                                placeholder="Choose a username"
                                value={form.username}
                                onChange={handleChange}
                                required
                                autoComplete="username"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Full Name *
                            </label>
                            <input
                                name="name"
                                placeholder="Enter your full name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Age
                                </label>
                                <input
                                    name="age"
                                    type="number"
                                    placeholder="Age"
                                    value={form.age}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Profession
                                </label>
                                <input
                                    name="profession"
                                    placeholder="e.g. Farmer, Student"
                                    value={form.profession}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Email Address *
                            </label>
                            <input
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                value={form.email}
                                onChange={handleChange}
                                required
                                autoComplete="email"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Password *
                            </label>
                            <input
                                name="password"
                                type="password"
                                placeholder="Create a secure password"
                                value={form.password}
                                onChange={handleChange}
                                required
                                autoComplete="new-password"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                            />
                        </div>

                        {message && (
                            <p className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                                {message}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 mt-2 shadow-md shadow-blue-600/10 active:scale-[0.99]"
                        >
                            {loading ? "Creating Account..." : "Register"}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                            Log in here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Register;
