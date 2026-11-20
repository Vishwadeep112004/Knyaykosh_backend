import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function AdminRegister() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        age: "",
        qualification: "",
        designation: "",
        password: "",
        confirm_password: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [adminAlreadyExists, setAdminAlreadyExists] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);

    const { token, user } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();

    // If already logged in as staff, redirect directly to admin dashboard
    useEffect(() => {
        if (token && user?.is_staff) {
            navigate("/admin", { replace: true });
        }
    }, [token, user, navigate]);

    // Check if an admin account already exists
    useEffect(() => {
        let mounted = true;
        const checkAdminStatus = async () => {
            try {
                const res = await api.get("/api/admin/register/");
                if (mounted && res.data?.admin_exists) {
                    setAdminAlreadyExists(true);
                }
            } catch (err) {
                // If endpoint returns 403, admin exists
                if (err.response?.status === 403) {
                    if (mounted) setAdminAlreadyExists(true);
                }
            } finally {
                if (mounted) setCheckingStatus(false);
            }
        };
        checkAdminStatus();
        return () => {
            mounted = false;
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
        if (error) setError("");
    };

    const validateForm = () => {
        const { name, email, age, qualification, designation, password, confirm_password } = formData;

        if (!name.trim()) {
            setError("Full name is required.");
            return false;
        }

        if (name.trim().length < 2) {
            setError("Name must be at least 2 characters.");
            return false;
        }

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

        if (!age) {
            setError("Age is required.");
            return false;
        }

        const parsedAge = parseInt(age, 10);
        if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120) {
            setError("Please provide a valid age between 18 and 120.");
            return false;
        }

        if (!qualification.trim()) {
            setError("Professional qualification is required.");
            return false;
        }

        if (!designation.trim()) {
            setError("Designation is required.");
            return false;
        }

        if (!password) {
            setError("Password is required.");
            return false;
        }

        if (password.length < 8) {
            setError("Password must contain at least 8 characters.");
            return false;
        }

        if (!confirm_password) {
            setError("Please confirm your password.");
            return false;
        }

        if (password !== confirm_password) {
            setError("Passwords do not match.");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const payload = {
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                age: parseInt(formData.age, 10),
                qualification: formData.qualification.trim(),
                designation: formData.designation.trim(),
                password: formData.password,
                confirm_password: formData.confirm_password
            };

            await api.post("/api/admin/register/", payload);

            setSuccessMessage("Admin account registered successfully! Redirecting to login...");
            setTimeout(() => {
                navigate("/admin/login", { replace: true });
            }, 1800);
        } catch (err) {
            console.error("Admin registration failed:", err);
            if (!err.response) {
                setError("Unable to connect to the NyayKosh server. Please ensure the backend is running.");
            } else if (err.response.status === 403) {
                setAdminAlreadyExists(true);
                setError(
                    err.response.data?.error ||
                    "An administrator account already exists. Only one administrative account is permitted."
                );
            } else {
                const responseData = err.response.data;
                if (typeof responseData === "object" && responseData !== null) {
                    const firstErrorField = Object.keys(responseData)[0];
                    const val = responseData[firstErrorField];
                    if (Array.isArray(val)) {
                        setError(`${firstErrorField}: ${val[0]}`);
                    } else if (typeof val === "string") {
                        setError(val);
                    } else {
                        setError("Registration validation failed. Please check your details.");
                    }
                } else {
                    setError("An unexpected error occurred during admin registration. Please try again.");
                }
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

            {/* Main Container */}
            <div className="flex min-h-screen items-center justify-center px-4 py-16">
                <div className="w-full max-w-xl">
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
                        <h2 className="mt-2 text-base font-semibold text-slate-800 dark:text-slate-200">
                            Create Admin Account
                        </h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Initialize primary judicial corpus and system administrator profile
                        </p>
                    </div>

                    {/* Single-Admin Notice if already registered */}
                    {adminAlreadyExists && !checkingStatus && (
                        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300 shadow-sm">
                            <div className="flex items-start gap-3">
                                <span className="text-xl">🔒</span>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider">
                                        Single-Admin Constraint Enforced
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                                        An administrative account is already registered for this NyayKosh installation.
                                        To prevent unauthorized administrative creation, public registration is locked.
                                    </p>
                                    <div className="mt-4">
                                        <Link
                                            to="/admin/login"
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
                                        >
                                            <span>Proceed to Admin Sign In</span>
                                            <span>→</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success Message Banner */}
                    {successMessage && (
                        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <svg className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{successMessage}</span>
                        </div>
                    )}

                    {/* Error Banner */}
                    {error && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
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

                    {/* Registration Card Form */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl transition-colors dark:border-white/[0.08] dark:bg-[#16191D]">
                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            {/* Row 1: Name and Email */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Adv. Rajesh Kumar"
                                        value={formData.name}
                                        onChange={handleChange}
                                        disabled={loading || adminAlreadyExists}
                                        required
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Admin Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="admin@nyaykosh.in"
                                        value={formData.email}
                                        onChange={handleChange}
                                        disabled={loading || adminAlreadyExists}
                                        required
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Age, Qualification, and Designation */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Age <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="age"
                                        min="18"
                                        max="120"
                                        placeholder="35"
                                        value={formData.age}
                                        onChange={handleChange}
                                        disabled={loading || adminAlreadyExists}
                                        required
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Qualification <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="qualification"
                                        placeholder="LL.M / Legal IT"
                                        value={formData.qualification}
                                        onChange={handleChange}
                                        disabled={loading || adminAlreadyExists}
                                        required
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Designation <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="designation"
                                        placeholder="Lead Administrator"
                                        value={formData.designation}
                                        onChange={handleChange}
                                        disabled={loading || adminAlreadyExists}
                                        required
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Password and Confirm Password */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            placeholder="Min. 8 characters"
                                            value={formData.password}
                                            onChange={handleChange}
                                            disabled={loading || adminAlreadyExists}
                                            autoComplete="new-password"
                                            required
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
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Confirm Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            name="confirm_password"
                                            placeholder="Re-enter password"
                                            value={formData.confirm_password}
                                            onChange={handleChange}
                                            disabled={loading || adminAlreadyExists}
                                            autoComplete="new-password"
                                            required
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                            title={showConfirmPassword ? "Hide password" : "Show password"}
                                            tabIndex="-1"
                                        >
                                            {showConfirmPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading || adminAlreadyExists}
                                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        <span>Creating Admin Account...</span>
                                    </>
                                ) : (
                                    <span>Register Administrator</span>
                                )}
                            </button>
                        </form>

                        {/* Security Warning Notice */}
                        <div className="mt-6 border-t border-slate-100 pt-4 text-center dark:border-white/[0.05]">
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>Designated for administrative setup. Plain-text passwords are never stored.</span>
                            </p>
                        </div>
                    </div>

                    {/* Navigation Link to Admin Login */}
                    <div className="mt-5 text-center">
                        <Link
                            to="/admin/login"
                            className="text-xs font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition"
                        >
                            Already have an administrator account? <span className="font-semibold underline">Sign In</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminRegister;
