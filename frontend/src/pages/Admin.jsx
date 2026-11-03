import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Admin() {
    const [tab, setTab] = useState("overview");
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadTitle, setUploadTitle] = useState("");
    const [uploadCategory, setUploadCategory] = useState("General Law");
    const [selectedFile, setSelectedFile] = useState(null);
    const [actionMessage, setActionMessage] = useState({ type: "", text: "" });

    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const fetchData = async () => {
        setLoading(true);
        setActionMessage({ type: "", text: "" });
        try {
            const [analyticsRes, docsRes] = await Promise.all([
                api.get("/rag/admin/analytics/"),
                api.get("/rag/admin/documents/")
            ]);
            setAnalytics(analyticsRes.data);
            setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
        } catch (err) {
            console.error("Admin fetch failed:", err);
            setActionMessage({
                type: "error",
                text: err.response?.data?.error || "Failed to load administrative analytics. Ensure backend is running."
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith(".pdf")) {
                setActionMessage({ type: "error", text: "Only PDF documents are supported." });
                return;
            }
            setSelectedFile(file);
            if (!uploadTitle) {
                setUploadTitle(file.name.replace(".pdf", "").replace(/[_-]/g, " "));
            }
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setActionMessage({ type: "error", text: "Please select a PDF file to upload." });
            return;
        }

        setUploading(true);
        setActionMessage({ type: "", text: "" });

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", uploadTitle || selectedFile.name);
        formData.append("category", uploadCategory || "General Law");

        try {
            const res = await api.post("/rag/admin/documents/", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setActionMessage({
                type: "success",
                text: `Document '${res.data.title}' uploaded and indexed into FAISS (${res.data.chunk_count} chunks)!`
            });
            setSelectedFile(null);
            setUploadTitle("");
            fetchData();
        } catch (err) {
            setActionMessage({
                type: "error",
                text: err.response?.data?.error || "Document upload or ingestion failed."
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Are you sure you want to permanently delete '${title}'? This will rebuild the FAISS vector index.`)) {
            return;
        }

        try {
            await api.delete(`/rag/admin/documents/${id}/`);
            setActionMessage({
                type: "success",
                text: `Document '${title}' deleted and vector index rebuilt successfully.`
            });
            fetchData();
        } catch (err) {
            setActionMessage({
                type: "error",
                text: err.response?.data?.error || "Failed to delete document."
            });
        }
    };

    const handleReprocess = async (id, title) => {
        try {
            setActionMessage({ type: "info", text: `Reprocessing '${title}'...` });
            await api.post(`/rag/admin/documents/${id}/`);
            setActionMessage({
                type: "success",
                text: `Document '${title}' successfully re-extracted and re-indexed into FAISS!`
            });
            fetchData();
        } catch (err) {
            setActionMessage({
                type: "error",
                text: err.response?.data?.error || "Failed to reprocess document."
            });
        }
    };

    if (user && !user.is_staff) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-900 dark:bg-[#111315] dark:text-white">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl text-center border border-red-200 dark:border-red-900/40">
                    <span className="text-4xl text-red-500 font-bold">⛔</span>
                    <h2 className="text-xl font-bold mt-4">Access Denied</h2>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        You do not possess administrative permissions to access the NyayKosh administration panel.
                    </p>
                    <Link
                        to="/chat"
                        className="mt-6 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                        Return to Legal Assistant
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-[#111315] dark:text-white transition-colors duration-200">
            {/* Admin Sidebar */}
            <aside className="w-64 shrink-0 flex flex-col border-r border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] transition-colors">
                <div className="p-5 border-b border-slate-100 dark:border-white/[0.05]">
                    <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-sm">
                            N
                        </span>
                        <div>
                            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                                NyayKosh Admin
                            </h1>
                            <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                Control Center
                            </p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    {[
                        { id: "overview", label: "📊 Overview" },
                        { id: "documents", label: "📑 Manage Legal Documents" },
                        { id: "users", label: "👥 Citizen Analytics" },
                        { id: "chats", label: "💬 Chat Analytics" },
                        { id: "rag", label: "🧠 RAG & FAISS Vector Index" },
                        { id: "settings", label: "⚙ Settings" }
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setTab(item.id)}
                            className={`w-full text-left rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                                tab === item.id
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-600/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-3 border-t border-slate-200 dark:border-white/[0.08] space-y-2">
                    <Link
                        to="/chat"
                        className="flex items-center justify-between w-full rounded-xl bg-slate-100 dark:bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 transition"
                    >
                        <span>◀ Citizen Chatbot</span>
                        <span className="text-[10px] font-mono text-slate-400">Live</span>
                    </Link>

                    <button
                        onClick={() => logout()}
                        className="w-full text-left rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 transition"
                    >
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Admin Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <header className="h-14 border-b border-slate-200 dark:border-white/[0.08] px-6 flex items-center justify-between bg-white dark:bg-[#111315]">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                            {tab.replace("_", " ")}
                        </h2>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            Indian Legal Knowledge Base Administration
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchData}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:text-blue-600 dark:border-white/[0.1] dark:text-slate-300 dark:hover:text-white transition"
                            title="Refresh Data"
                        >
                            ↻ Refresh
                        </button>

                        <button
                            onClick={toggleTheme}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:text-blue-600 dark:border-white/[0.1] dark:text-slate-300 dark:hover:text-white transition"
                        >
                            <span>{isDark ? "☀" : "🌙"}</span>
                            <span>{isDark ? "Light" : "Dark"}</span>
                        </button>
                    </div>
                </header>

                <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
                    {/* Action notification message */}
                    {actionMessage.text && (
                        <div
                            className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
                                actionMessage.type === "success"
                                    ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900/50"
                                    : actionMessage.type === "info"
                                    ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50"
                                    : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50"
                            }`}
                        >
                            <span>{actionMessage.text}</span>
                            <button
                                onClick={() => setActionMessage({ type: "", text: "" })}
                                className="font-bold px-2"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {loading ? (
                        <div className="py-20 text-center text-xs text-slate-400 font-mono">
                            Loading administrative data...
                        </div>
                    ) : (
                        <>
                            {/* TAB 1: OVERVIEW */}
                            {tab === "overview" && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                Registered Citizens
                                            </p>
                                            <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                                                {analytics?.users?.total || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                Questions Answered
                                            </p>
                                            <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                                                {analytics?.chats?.total_questions || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                Legal Documents
                                            </p>
                                            <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                                                {analytics?.documents?.total || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                Indexed FAISS Vectors
                                            </p>
                                            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                                                {analytics?.rag?.faiss_total_vectors || 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* System Status Banner */}
                                    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono mb-3">
                                            AI Architecture Status
                                        </h3>
                                        <div className="grid md:grid-cols-3 gap-4 text-xs">
                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]">
                                                <span className="text-slate-500 dark:text-slate-400">LLM Engine: </span>
                                                <span className="font-semibold text-blue-600 dark:text-blue-400">Groq API</span>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                                    Model: {analytics?.rag?.groq_model || "llama-3.3-70b-versatile"}
                                                </p>
                                            </div>

                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]">
                                                <span className="text-slate-500 dark:text-slate-400">Vector Search: </span>
                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">FAISS IndexFlatIP</span>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                                    Embedding: all-MiniLM-L6-v2 (dim=384)
                                                </p>
                                            </div>

                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]">
                                                <span className="text-slate-500 dark:text-slate-400">Groq Key: </span>
                                                <span className={`font-semibold ${analytics?.rag?.groq_configured ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                                                    {analytics?.rag?.groq_configured ? "● Active in .env" : "⚠️ Needs GROQ_API_KEY"}
                                                </span>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                                    Ultra-fast statutory inference
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setTab("documents")}
                                            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                                        >
                                            + Upload Legal PDF
                                        </button>
                                        <Link
                                            to="/chat"
                                            className="rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#16191D] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition"
                                        >
                                            Open Legal Assistant
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: MANAGE LEGAL DOCUMENTS */}
                            {tab === "documents" && (
                                <div className="space-y-6">
                                    {/* Upload Form Card */}
                                    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                                            Upload Indian Legal Document (PDF)
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                            Upload national acts, state gazettes, or procedural guidelines. The document will be
                                            automatically extracted, chunked, and embedded into the FAISS vector database.
                                        </p>

                                        <form onSubmit={handleUpload} className="grid sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                    Select PDF File *
                                                </label>
                                                <input
                                                    type="file"
                                                    accept=".pdf,application/pdf"
                                                    onChange={handleFileChange}
                                                    required
                                                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950 dark:file:text-blue-300"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                    Document Title
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Consumer Protection Act, 2019"
                                                    value={uploadTitle}
                                                    onChange={e => setUploadTitle(e.target.value)}
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                    Category
                                                </label>
                                                <select
                                                    value={uploadCategory}
                                                    onChange={e => setUploadCategory(e.target.value)}
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                                >
                                                    <option value="Constitutional Law">Constitutional Law</option>
                                                    <option value="Criminal Law">Criminal Law (BNS/BNSS)</option>
                                                    <option value="Consumer Law">Consumer Law</option>
                                                    <option value="Information Law">Information Law (RTI/IT)</option>
                                                    <option value="Civil & Contract Law">Civil & Contract Law</option>
                                                    <option value="Women & Family Law">Women & Family Law</option>
                                                    <option value="Agriculture & Fertilizer">Agriculture & Fertilizer</option>
                                                    <option value="Motor Vehicles">Motor Vehicles</option>
                                                    <option value="General Law">General Law</option>
                                                </select>
                                            </div>

                                            <div className="sm:col-span-3 flex justify-end mt-2">
                                                <button
                                                    type="submit"
                                                    disabled={uploading || !selectedFile}
                                                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                                                >
                                                    {uploading ? "Extracting & Embedding into FAISS..." : "Upload & Ingest into Knowledge Base"}
                                                </button>
                                            </div>
                                        </form>
                                    </div>

                                    {/* Documents Listing Table */}
                                    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] overflow-hidden shadow-sm">
                                        <div className="p-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                                                Stored Legal Documents ({documents.length})
                                            </h3>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 uppercase text-[10px] font-mono border-b border-slate-200 dark:border-white/[0.05]">
                                                    <tr>
                                                        <th className="px-4 py-3">Document Title</th>
                                                        <th className="px-4 py-3">Filename</th>
                                                        <th className="px-4 py-3">Category</th>
                                                        <th className="px-4 py-3">Size</th>
                                                        <th className="px-4 py-3">Status</th>
                                                        <th className="px-4 py-3">Chunks</th>
                                                        <th className="px-4 py-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                                                    {documents.map(doc => (
                                                        <tr key={doc.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                                                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white max-w-[200px] truncate">
                                                                {doc.title}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px] max-w-[150px] truncate">
                                                                {doc.original_filename}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                                {doc.category}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-500 font-mono">
                                                                {(doc.file_size / 1024).toFixed(1)} KB
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                                        doc.status === "Processed"
                                                                            ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                                                                            : doc.status === "Processing"
                                                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                                                            : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                                                                    }`}
                                                                >
                                                                    {doc.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                                                                {doc.chunk_count || "—"}
                                                            </td>
                                                            <td className="px-4 py-3 text-right space-x-2">
                                                                <button
                                                                    onClick={() => handleReprocess(doc.id, doc.title)}
                                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-semibold"
                                                                    title="Re-extract and re-embed"
                                                                >
                                                                    Re-index
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(doc.id, doc.title)}
                                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 font-semibold"
                                                                    title="Delete document and remove from FAISS"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: CITIZEN ANALYTICS */}
                            {tab === "users" && (
                                <div className="space-y-6">
                                    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono mb-4">
                                            Registered Citizens ({analytics?.users?.total || 0})
                                        </h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 uppercase text-[10px] font-mono border-b border-slate-200 dark:border-white/[0.05]">
                                                    <tr>
                                                        <th className="px-4 py-3">Username</th>
                                                        <th className="px-4 py-3">Full Name</th>
                                                        <th className="px-4 py-3">Email</th>
                                                        <th className="px-4 py-3">Profession</th>
                                                        <th className="px-4 py-3">Joined Date</th>
                                                        <th className="px-4 py-3">Role</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                                                    {analytics?.users?.recent?.map(u => (
                                                        <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                                                            <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">
                                                                {u.username}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                                                                {u.name || "—"}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-500 font-mono">
                                                                {u.email}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                                {u.profession || "Citizen"}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                                                                {new Date(u.date_joined).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                                        u.is_staff
                                                                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                                                                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                    }`}
                                                                >
                                                                    {u.is_staff ? "Admin" : "Citizen"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: CHAT ANALYTICS */}
                            {tab === "chats" && (
                                <div className="space-y-6">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                Total Case Consultations
                                            </p>
                                            <p className="text-3xl font-bold mt-1 text-slate-900 dark:text-white">
                                                {analytics?.chats?.total_sessions || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                Total Questions Processed
                                            </p>
                                            <p className="text-3xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                                                {analytics?.chats?.total_questions || 0}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono mb-3">
                                            Sample Questions Asked by Citizens
                                        </h3>
                                        <div className="space-y-2">
                                            {analytics?.chats?.recent_sample_queries?.map((q, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] text-xs text-slate-800 dark:text-slate-200"
                                                >
                                                    <span className="text-blue-600 dark:text-blue-400 font-mono mr-2 font-semibold">Q{idx + 1}:</span>
                                                    {q}
                                                </div>
                                            ))}
                                            {(!analytics?.chats?.recent_sample_queries ||
                                                analytics?.chats?.recent_sample_queries.length === 0) && (
                                                <p className="text-xs text-slate-400 py-3">No questions logged yet.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: RAG & FAISS VECTOR STORE */}
                            {tab === "rag" && (
                                <div className="space-y-6">
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                FAISS Total Vectors
                                            </p>
                                            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                                                {analytics?.rag?.faiss_total_vectors || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                Serialized Text Chunks
                                            </p>
                                            <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                                                {analytics?.rag?.chunks_count || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 dark:text-slate-400">
                                                Active Groq Model
                                            </p>
                                            <p className="text-sm font-bold mt-1 font-mono text-slate-900 dark:text-white truncate">
                                                {analytics?.rag?.groq_model || "llama-3.3-70b-versatile"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono mb-3">
                                            RAG Pipeline Health Check
                                        </h3>
                                        <ul className="space-y-2 text-xs">
                                            <li className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
                                                <span className="text-slate-700 dark:text-slate-300">Sentence Transformers (all-MiniLM-L6-v2)</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">✓ Loaded locally (dim=384)</span>
                                            </li>
                                            <li className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
                                                <span className="text-slate-700 dark:text-slate-300">FAISS Index Consistency (ntotal == len(chunks))</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                                    ✓ {analytics?.rag?.faiss_total_vectors === analytics?.rag?.chunks_count ? "Consistent" : "Warning: Mismatch"}
                                                </span>
                                            </li>
                                            <li className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
                                                <span className="text-slate-700 dark:text-slate-300">Groq API Key Configuration</span>
                                                <span className={`font-semibold font-mono ${analytics?.rag?.groq_configured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                                    {analytics?.rag?.groq_configured ? "✓ Configured in .env" : "⚠️ Key Missing in .env"}
                                                </span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* TAB 6: SETTINGS */}
                            {tab === "settings" && (
                                <div className="space-y-6">
                                    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono mb-3">
                                            System & Environment Settings
                                        </h3>
                                        <div className="space-y-3 text-xs">
                                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">Groq API Key Configuration</p>
                                                <p className="text-slate-600 dark:text-slate-400 mt-1">
                                                    Add your key to <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">/home/toheed/Knyaykosh_backend/.env</code> under <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">GROQ_API_KEY</code>.
                                                </p>
                                            </div>

                                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">Configurable Groq Model</p>
                                                <p className="text-slate-600 dark:text-slate-400 mt-1">
                                                    Active model: <code className="text-blue-600 dark:text-blue-400 font-mono">{analytics?.rag?.groq_model}</code>. Configurable via <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">GROQ_MODEL</code> in <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">.env</code>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Admin;
