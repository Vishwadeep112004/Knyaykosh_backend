import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [dark, setDark] = useState(false);
    const navigate = useNavigate();

    const login = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const response = await api.post("/api/token/", {
                username,
                password
            });

            localStorage.setItem("access", response.data.access);
            localStorage.setItem("refresh", response.data.refresh);

            navigate("/chat");
        } catch (error) {
            console.error("Login error:", error);

            setError(
                error.response?.data?.detail ||
                "Invalid username or password"
            );
        }
    };

    return (
        <div className={dark ? "dark" : ""}>
            <div className="min-h-screen bg-gray-100 px-4 text-gray-900 transition-colors duration-300 dark:bg-gray-950 dark:text-white">

                <div className="flex min-h-screen items-center justify-center">
                    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg transition-colors duration-300 dark:bg-gray-900">
                        <div className="mb-8 text-center">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                NyayKosh
                            </h1>

                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Your AI-powered legal assistant
                            </p>
                        </div>

                        <form onSubmit={login} className="space-y-5">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Username
                                </label>

                                <input
                                    type="text"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-900"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Password
                                </label>

                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-900"
                                />
                            </div>

                            {error && (
                                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700"
                            >
                                Login
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            Don't have an account?{" "}
                            <Link
                                to="/register"
                                className="inline-block cursor-pointer font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                                Register
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;