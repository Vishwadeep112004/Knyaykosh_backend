import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

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
    const [dark, setDark] = useState(false);
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

        try {
            await api.post("/users/", form);

            const response = await api.post("/api/token/", {
                username: form.username,
                password: form.password
            });

            localStorage.setItem("access", response.data.access);
            localStorage.setItem("refresh", response.data.refresh);

            navigate("/chat");
        } catch (error) {
            console.error("Registration error:", error);

            setMessage(
                error.response?.data?.detail ||
                Object.values(error.response?.data || {})
                    .flat()
                    .join(" ") ||
                "Registration failed"
            );
        }
    };

    return (
        <div className={dark ? "dark" : ""}>
            <div className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 transition-colors duration-300 dark:bg-gray-950 dark:text-white">

                <div className="flex min-h-screen items-center justify-center">
                    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl transition-colors duration-300 dark:bg-gray-900">
                        <div className="mb-8 text-center">
                            <h1 className="text-3xl font-bold">
                                NyayKosh
                            </h1>

                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Create your account
                            </p>
                        </div>

                        <form
                            onSubmit={register}
                            className="space-y-4"
                        >
                            <input
                                name="username"
                                placeholder="Username"
                                value={form.username}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                            />

                            <input
                                name="name"
                                placeholder="Full Name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                            />

                            <input
                                name="age"
                                type="number"
                                placeholder="Age"
                                value={form.age}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                            />

                            <input
                                name="profession"
                                placeholder="Profession"
                                value={form.profession}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                            />

                            <input
                                name="email"
                                type="email"
                                placeholder="Email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                            />

                            <input
                                name="password"
                                type="password"
                                placeholder="Password"
                                value={form.password}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                            />

                            <button
                                type="submit"
                                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
                            >
                                Create Account
                            </button>
                        </form>

                        {message && (
                            <p
                                className={`mt-5 text-center text-sm ${
                                    message === "Registration successful!"
                                        ? "text-green-500"
                                        : "text-red-500"
                                }`}
                            >
                                {message}
                            </p>
                        )}

                        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            Already have an account?{" "}
                            <Link
                                to="/login"
                                className="inline-block cursor-pointer font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                                Login
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Register;