import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Admin() {
    // Navigation / View Tabs
    const [activeTab, setActiveTab] = useState("knowledge_base");

    // Knowledge Base State
    const [kbStatus, setKbStatus] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedType, setSelectedType] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");

    // Action & Notification Banners
    const [banner, setBanner] = useState({ type: "", message: "", details: "" });

    // Modals State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [docToDelete, setDocToDelete] = useState(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);

    // Upload Form State
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadName, setUploadName] = useState("");
    const [uploadDocType, setUploadDocType] = useState("ACT");
    const [uploadPublishedAt, setUploadPublishedAt] = useState("");
    const [uploadCategories, setUploadCategories] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    // Embedding Generation State
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationResult, setGenerationResult] = useState(null);

    // Category Creation Modal
    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryDesc, setNewCategoryDesc] = useState("");
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useTheme();

    // -------------------------------------------------------------------------
    // Data Fetching
    // -------------------------------------------------------------------------

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            // Build query parameters for documents list
            const params = {};
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (selectedCategory) params.category = selectedCategory;
            if (selectedType) params.document_type = selectedType;
            if (selectedStatus) params.processing_status = selectedStatus;

            const [statusRes, docsRes, catsRes] = await Promise.all([
                api.get("/docs/status/"),
                api.get("/docs/documents/", { params }),
                api.get("/docs/categories/")
            ]);

            setKbStatus(statusRes.data);
            setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
            setCategories(Array.isArray(catsRes.data) ? catsRes.data : []);
        } catch (err) {
            console.error("Failed to load Knowledge Base data:", err);
            setBanner({
                type: "error",
                message: "Failed to load Knowledge Base data.",
                details: err.response?.data?.error || err.message
            });
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedCategory, selectedType, selectedStatus]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // -------------------------------------------------------------------------
    // Upload Document
    // -------------------------------------------------------------------------

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            setBanner({
                type: "error",
                message: "Invalid file format.",
                details: "Only PDF documents (.pdf) are supported for legal ingestion."
            });
            return;
        }

        setUploadFile(file);
        if (!uploadName) {
            const cleanTitle = file.name
                .replace(/\.pdf$/i, "")
                .replace(/[_-]/g, " ")
                .trim();
            setUploadName(cleanTitle);
        }
    };

    const toggleUploadCategory = (catId) => {
        setUploadCategories((prev) =>
            prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
        );
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            setBanner({ type: "error", message: "Please select a PDF file to upload." });
            return;
        }

        setIsUploading(true);
        setBanner({ type: "", message: "", details: "" });

        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("name", uploadName.trim() || uploadFile.name);
        formData.append("document_type", uploadDocType);
        if (uploadPublishedAt) {
            formData.append("published_at", uploadPublishedAt);
        }
        if (uploadCategories.length > 0) {
            formData.append("categories", uploadCategories.join(","));
        }

        try {
            const res = await api.post("/docs/documents/upload/", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            setBanner({
                type: "success",
                message: `Document '${res.data.document?.name || uploadName}' uploaded successfully!`,
                details: "Document added to the collection. Remember to click 'Generate Embeddings' to activate it in the AI knowledge base."
            });

            // Reset upload form
            setUploadFile(null);
            setUploadName("");
            setUploadDocType("ACT");
            setUploadPublishedAt("");
            setUploadCategories([]);
            setShowUploadModal(false);

            fetchAllData();
        } catch (err) {
            console.error("Upload error:", err);
            setBanner({
                type: "error",
                message: "Document upload failed.",
                details: err.response?.data?.error || err.response?.data?.details || "Failed to upload to Cloudinary."
            });
        } finally {
            setIsUploading(false);
        }
    };

    // -------------------------------------------------------------------------
    // Delete Document
    // -------------------------------------------------------------------------

    const confirmDelete = (doc) => {
        setDocToDelete(doc);
        setShowDeleteModal(true);
    };

    const executeDelete = async () => {
        if (!docToDelete) return;

        try {
            await api.delete(`/docs/documents/${docToDelete.id}/`);
            setBanner({
                type: "success",
                message: `Document '${docToDelete.name}' deleted successfully.`,
                details: "The PDF was removed from Cloudinary and the database. Click 'Generate Embeddings' to update the vector index."
            });
            setShowDeleteModal(false);
            setDocToDelete(null);
            fetchAllData();
        } catch (err) {
            setBanner({
                type: "error",
                message: "Failed to delete document.",
                details: err.response?.data?.error || err.message
            });
        }
    };

    // -------------------------------------------------------------------------
    // View PDF
    // -------------------------------------------------------------------------

    const handleViewPdf = async (doc) => {
        // 1. If serializer returned a valid signed view_url with inline disposition, open it
        if (doc.view_url && doc.view_url.startsWith("http")) {
            window.open(doc.view_url, "_blank", "noopener,noreferrer");
            return;
        }

        // 2. Fetch authenticated inline PDF blob via Axios
        try {
            setBanner({ type: "info", message: `Opening PDF for '${doc.name}'...` });
            const res = await api.get(`/docs/documents/${doc.id}/view/`, {
                responseType: "blob"
            });
            const fileBlob = new Blob([res.data], { type: "application/pdf" });
            const blobUrl = window.URL.createObjectURL(fileBlob);
            window.open(blobUrl, "_blank");
            setBanner({ type: "", message: "" });
        } catch (err) {
            console.error("Failed to view PDF:", err);
            setBanner({
                type: "error",
                message: `Failed to open PDF for '${doc.name}'.`,
                details: err.response?.data?.error || err.message || "Could not retrieve PDF content."
            });
        }
    };

    // -------------------------------------------------------------------------
    // Embedding Regeneration
    // -------------------------------------------------------------------------

    const executeGenerateEmbeddings = async () => {
        setIsGenerating(true);
        setGenerationResult(null);
        setBanner({ type: "info", message: "Regenerating FAISS vector embeddings... This may take a moment." });

        try {
            const res = await api.post("/docs/generate-embeddings/");
            setGenerationResult(res.data);
            const failedCount = res.data.failed_documents_count ?? res.data.failed_documents?.length ?? 0;
            const successCount = res.data.successful_documents_count ?? res.data.successful_documents?.length ?? res.data.total_documents;
            setBanner({
                type: failedCount > 0 ? "warning" : "success",
                message: failedCount > 0
                    ? `Embeddings generated: ${successCount} succeeded, ${failedCount} skipped/failed.`
                    : "Embeddings regenerated successfully!",
                details: `Processed ${res.data.total_documents} active documents. Generated ${res.data.total_chunks} chunks and ${res.data.total_embeddings} dense vectors.`
            });
            fetchAllData();
        } catch (err) {
            console.error("Generation failed:", err);
            setBanner({
                type: "error",
                message: "Embedding generation failed.",
                details: err.response?.data?.details || err.response?.data?.error || "Error extracting text or creating FAISS vectors."
            });
        } finally {
            setIsGenerating(false);
        }
    };

    // -------------------------------------------------------------------------
    // Category Management
    // -------------------------------------------------------------------------

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        setIsCreatingCategory(true);
        try {
            await api.post("/docs/categories/add/", {
                name: newCategoryName.trim(),
                description: newCategoryDesc.trim()
            });
            setNewCategoryName("");
            setNewCategoryDesc("");
            setShowAddCategoryModal(false);
            setBanner({
                type: "success",
                message: "Legal Category created successfully!"
            });
            fetchAllData();
        } catch (err) {
            setBanner({
                type: "error",
                message: "Failed to create category.",
                details: err.response?.data?.name?.[0] || "Name must be unique."
            });
        } finally {
            setIsCreatingCategory(false);
        }
    };

    // Access guard
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

    // Helper: Status badge styling
    const renderKbStatusBadge = () => {
        const status = kbStatus?.status || "PENDING_REGENERATION";
        if (status === "UP_TO_DATE") {
            return (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Up-to-date</span>
                </div>
            );
        }
        if (status === "GENERATING") {
            return (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                    <div className="h-3 w-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                    <span>Generating embeddings...</span>
                </div>
            );
        }
        if (status === "FAILED") {
            return (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-300 dark:border-red-800">
                    <span>⚠️</span>
                    <span>Generation Failed</span>
                </div>
            );
        }
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span>Changes Pending Regeneration</span>
            </div>
        );
    };

    return (
        <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-[#111315] dark:text-white transition-colors duration-200">
            {/* Sidebar */}
            <aside className="w-64 shrink-0 flex flex-col border-r border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] transition-colors">
                <div className="p-5 border-b border-slate-100 dark:border-white/[0.05]">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md dark:bg-blue-600">
                            ⚖
                        </span>
                        <div>
                            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                                NyayKosh
                            </h1>
                            <p className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-widest font-semibold">
                                Admin Console
                            </p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    <button
                        onClick={() => setActiveTab("knowledge_base")}
                        className={`w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                            activeTab === "knowledge_base"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-600/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                        }`}
                    >
                        <span>📑</span>
                        <span>Knowledge Base</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("categories")}
                        className={`w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                            activeTab === "categories"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-600/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                        }`}
                    >
                        <span>🏷</span>
                        <span>Legal Categories</span>
                    </button>
                </nav>

                <div className="p-3 border-t border-slate-200 dark:border-white/[0.08] space-y-2">
                    <Link
                        to="/chat"
                        className="flex items-center justify-between w-full rounded-xl bg-slate-100 dark:bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 transition"
                    >
                        <span>◀ Citizen Chatbot</span>
                        <span className="text-[10px] font-mono text-slate-400">Live</span>
                    </Link>

                    <div className="px-2 py-1 flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate max-w-[120px] font-medium">{user?.email || "Admin"}</span>
                        <button
                            onClick={() => logout()}
                            className="text-red-600 hover:underline text-[11px] font-semibold"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                {/* Header */}
                <header className="h-16 border-b border-slate-200 dark:border-white/[0.08] px-6 flex items-center justify-between bg-white dark:bg-[#111315]">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Knowledge Base Management</span>
                            {renderKbStatusBadge()}
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Manage statutory legal documents, Cloudinary storage, and FAISS vector embeddings
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                        >
                            <span>+</span>
                            <span>Upload Document</span>
                        </button>

                        <button
                            onClick={() => setShowGenerateModal(true)}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500 transition"
                            title="Regenerate all embeddings from active PDFs"
                        >
                            <span>⚡</span>
                            <span>Generate Embeddings</span>
                        </button>

                        <button
                            onClick={fetchAllData}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:text-blue-600 dark:border-white/[0.1] dark:text-slate-300 dark:hover:text-white transition"
                            title="Refresh Data"
                        >
                            ↻
                        </button>

                        <button
                            onClick={toggleTheme}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:text-blue-600 dark:border-white/[0.1] dark:text-slate-300 dark:hover:text-white transition"
                        >
                            {isDark ? "☀" : "🌙"}
                        </button>
                    </div>
                </header>

                <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
                    {/* Action Banner Message */}
                    {banner.message && (
                        <div
                            className={`p-4 rounded-2xl text-xs flex items-start justify-between border shadow-sm ${
                                banner.type === "success"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50"
                                    : banner.type === "info"
                                    ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50"
                                    : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50"
                            }`}
                        >
                            <div className="space-y-1">
                                <p className="font-bold">{banner.message}</p>
                                {banner.details && (
                                    <p className="text-[11px] opacity-90 leading-relaxed">{banner.details}</p>
                                )}
                            </div>
                            <button
                                onClick={() => setBanner({ type: "", message: "", details: "" })}
                                className="font-bold px-2 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Pending Regeneration Notice */}
                    {kbStatus?.status === "PENDING_REGENERATION" && (
                        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">
                                        Knowledge Base Updates Pending
                                    </p>
                                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                                        Document additions or deletions have changed the collection. Re-generate embeddings to make the newest legal texts searchable by citizens.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowGenerateModal(true)}
                                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 shadow-sm shrink-0"
                            >
                                Run Generation Now
                            </button>
                        </div>
                    )}

                    {/* STATS METRIC CARDS */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-4 shadow-sm">
                            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
                                Total Documents
                            </p>
                            <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                                {kbStatus?.total_documents ?? documents.length}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-4 shadow-sm">
                            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
                                Active Documents
                            </p>
                            <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                                {kbStatus?.active_documents ?? documents.filter((d) => d.is_active).length}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-4 shadow-sm">
                            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
                                Total Chunks
                            </p>
                            <p className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                                {kbStatus?.total_chunks ?? 0}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-4 shadow-sm">
                            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
                                Ready Documents
                            </p>
                            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                                {kbStatus?.ready_documents ?? documents.filter((d) => d.processing_status === "READY").length}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-4 shadow-sm">
                            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
                                Pending / Failed
                            </p>
                            <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                                {(kbStatus?.pending_documents || 0) + (kbStatus?.failed_documents || 0)}
                            </p>
                        </div>
                    </div>

                    {/* TAB: KNOWLEDGE BASE DOCUMENT LIST */}
                    {activeTab === "knowledge_base" && (
                        <div className="space-y-4">
                            {/* Search and Filters */}
                            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                                <div className="w-full sm:w-72 relative">
                                    <input
                                        type="text"
                                        placeholder="Search documents by name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                <div className="w-full sm:w-auto flex flex-wrap gap-2.5 items-center">
                                    {/* Category Filter */}
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                    >
                                        <option value="">All Categories</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Document Type Filter */}
                                    <select
                                        value={selectedType}
                                        onChange={(e) => setSelectedType(e.target.value)}
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                    >
                                        <option value="">All Types</option>
                                        <option value="ACT">Act</option>
                                        <option value="AMENDMENT">Amendment</option>
                                        <option value="RULES">Rules</option>
                                        <option value="OTHER">Other</option>
                                    </select>

                                    {/* Status Filter */}
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="READY">Ready</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="PROCESSING">Processing</option>
                                        <option value="FAILED">Failed</option>
                                    </select>

                                    {(searchQuery || selectedCategory || selectedType || selectedStatus) && (
                                        <button
                                            onClick={() => {
                                                setSearchQuery("");
                                                setSelectedCategory("");
                                                setSelectedType("");
                                                setSelectedStatus("");
                                            }}
                                            className="text-xs text-blue-600 hover:underline px-2"
                                        >
                                            Reset Filters
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Documents Table */}
                            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                                        Legal Corpus Documents ({documents.length})
                                    </h3>
                                    {kbStatus?.last_generated_at && (
                                        <p className="text-[11px] text-slate-400 font-mono">
                                            Last Index Rebuild: {new Date(kbStatus.last_generated_at).toLocaleString()}
                                        </p>
                                    )}
                                </div>

                                {loading ? (
                                    <div className="py-16 text-center text-xs text-slate-400 font-mono flex flex-col items-center gap-2">
                                        <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                                        <span>Loading Legal Documents...</span>
                                    </div>
                                ) : documents.length === 0 ? (
                                    <div className="py-16 text-center text-slate-500 text-xs space-y-2">
                                        <p className="text-2xl">📄</p>
                                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                                            No legal documents found
                                        </p>
                                        <p className="text-slate-400">
                                            Upload your first statutory PDF act to populate the NyayKosh knowledge base.
                                        </p>
                                        <button
                                            onClick={() => setShowUploadModal(true)}
                                            className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                        >
                                            Upload Document
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 uppercase text-[10px] font-mono border-b border-slate-200 dark:border-white/[0.05]">
                                                <tr>
                                                    <th className="px-4 py-3">Document Name</th>
                                                    <th className="px-4 py-3">Type</th>
                                                    <th className="px-4 py-3">Categories</th>
                                                    <th className="px-4 py-3">Published</th>
                                                    <th className="px-4 py-3">Uploaded</th>
                                                    <th className="px-4 py-3">Chunks</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                                                {documents.map((doc) => (
                                                    <tr
                                                        key={doc.id}
                                                        className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition"
                                                    >
                                                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white max-w-[240px]">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base text-red-500">📄</span>
                                                                <span className="truncate" title={doc.name}>
                                                                    {doc.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300">
                                                                {doc.document_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 max-w-[180px]">
                                                            <div className="flex flex-wrap gap-1">
                                                                {doc.categories_details && doc.categories_details.length > 0 ? (
                                                                    doc.categories_details.map((c) => (
                                                                        <span
                                                                            key={c.id}
                                                                            className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50 text-[10px]"
                                                                        >
                                                                            {c.name}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-slate-400 text-[11px]">—</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                                                            {doc.published_at || "—"}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                                                            {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "—"}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                                                            {doc.total_chunks || "0"}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span
                                                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                                    doc.processing_status === "READY"
                                                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                        : doc.processing_status === "PROCESSING"
                                                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                                                        : doc.processing_status === "PENDING"
                                                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                                                        : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                                                                }`}
                                                            >
                                                                {doc.processing_status}
                                                            </span>
                                                            {doc.processing_status === "FAILED" && doc.error_message && (
                                                                <p
                                                                    className="text-[10px] text-red-600 dark:text-red-400 mt-1 max-w-[200px] leading-tight"
                                                                    title={doc.error_message}
                                                                >
                                                                    {doc.error_message}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right space-x-2">
                                                            {(doc.view_url || doc.cloudinary_url) && (
                                                                <a
                                                                    href={doc.view_url || doc.cloudinary_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => {
                                                                        if (!doc.view_url || !doc.view_url.startsWith("http")) {
                                                                            e.preventDefault();
                                                                            handleViewPdf(doc);
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 font-semibold"
                                                                    title="View Original PDF"
                                                                >
                                                                    <span>View PDF</span>
                                                                    <span>↗</span>
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={() => confirmDelete(doc)}
                                                                className="text-red-600 hover:text-red-800 dark:text-red-400 font-semibold ml-2"
                                                                title="Delete Document"
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: LEGAL CATEGORIES MANAGEMENT */}
                    {activeTab === "categories" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        Legal Topic Taxonomy
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Categories used to tag statutes, court precedents, and citizen query domains
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowAddCategoryModal(true)}
                                    className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                >
                                    + Add New Category
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {categories.map((cat) => (
                                    <div
                                        key={cat.id}
                                        className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#16191D] p-5 shadow-sm space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                                {cat.name}
                                            </h4>
                                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-mono text-[10px]">
                                                {cat.documents_count || 0} Docs
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[36px]">
                                            {cat.description || "No description provided."}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* ================================================================= */}
            {/* UPLOAD DOCUMENT MODAL                                             */}
            {/* ================================================================= */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#16191D] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-3">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>📤</span>
                                <span>Upload Legal Document (PDF)</span>
                            </h3>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            {/* PDF File Picker */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Select Legal PDF File <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={handleFileSelect}
                                    required
                                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950 dark:file:text-blue-300"
                                />
                                {uploadFile && (
                                    <p className="mt-1 text-[11px] text-slate-500 font-mono">
                                        Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                                    </p>
                                )}
                            </div>

                            {/* Document Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Document Name / Act Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Consumer Protection Act 2019"
                                    value={uploadName}
                                    onChange={(e) => setUploadName(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                />
                            </div>

                            {/* Row: Type and Publication Date */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Document Type
                                    </label>
                                    <select
                                        value={uploadDocType}
                                        onChange={(e) => setUploadDocType(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                    >
                                        <option value="ACT">Act</option>
                                        <option value="AMENDMENT">Amendment</option>
                                        <option value="RULES">Rules</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Publication Date
                                    </label>
                                    <input
                                        type="date"
                                        value={uploadPublishedAt}
                                        onChange={(e) => setUploadPublishedAt(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Multi-Category Selection */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Categories (Select all that apply)
                                </label>
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/20">
                                    {categories.map((cat) => {
                                        const isSelected = uploadCategories.includes(cat.id);
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => toggleUploadCategory(cat.id)}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                                                    isSelected
                                                        ? "bg-blue-600 text-white font-semibold"
                                                        : "bg-white text-slate-700 hover:bg-slate-200 dark:bg-[#1C2025] dark:text-slate-300 dark:hover:bg-white/[0.1]"
                                                }`}
                                            >
                                                {cat.name} {isSelected && "✓"}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Note about embeddings */}
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
                                ℹ Uploading sends this PDF to Cloudinary and registers document metadata. To make its contents queryable by citizens in the chatbot, you will need to trigger <strong>Generate Embeddings</strong>.
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.05]">
                                <button
                                    type="button"
                                    onClick={() => setShowUploadModal(false)}
                                    disabled={isUploading}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.05]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUploading || !uploadFile}
                                    className="px-5 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isUploading ? (
                                        <>
                                            <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                            <span>Uploading to Cloudinary...</span>
                                        </>
                                    ) : (
                                        <span>Confirm Upload</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* DELETE DOCUMENT CONFIRMATION MODAL                                */}
            {/* ================================================================= */}
            {showDeleteModal && docToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#16191D] border border-red-200 dark:border-red-900/50 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl text-red-500">🗑</span>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Confirm Document Deletion
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Permanent removal from NyayKosh Cloud Storage
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-800 dark:text-red-300 leading-relaxed border border-red-100 dark:border-red-900/30">
                            Are you sure you want to delete <strong>'{docToDelete.name}'</strong>?
                            <ul className="list-disc ml-4 mt-2 space-y-1 text-[11px]">
                                <li>The raw PDF will be deleted from Cloudinary.</li>
                                <li>The document record and associated metadata will be removed.</li>
                                <li>The knowledge base will be flagged as requiring embedding regeneration.</li>
                            </ul>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDocToDelete(null);
                                }}
                                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.05]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeDelete}
                                className="px-4 py-2 rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700 shadow-sm"
                            >
                                Delete Document
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* GENERATE EMBEDDINGS MODAL                                         */}
            {/* ================================================================= */}
            {showGenerateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#16191D] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl text-amber-500">⚡</span>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Regenerate FAISS Knowledge Base Index
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Batch extract, chunk, and embed all active legal documents
                                </p>
                            </div>
                        </div>

                        {!isGenerating && !generationResult && (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                    This operation will process <strong>all {documents.filter((d) => d.is_active).length} active PDFs</strong>:
                                </p>
                                <div className="rounded-xl border border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-black/20 p-3 text-[11px] space-y-1.5 font-mono text-slate-600 dark:text-slate-400">
                                    <p>1. Download raw PDFs temporarily from Cloudinary</p>
                                    <p>2. Extract statutory text with PyPDFLoader</p>
                                    <p>3. Segment text with RecursiveCharacterTextSplitter (chunk_size=1000)</p>
                                    <p>4. Encode 384d dense vectors with SentenceTransformer (all-MiniLM-L6-v2)</p>
                                    <p>5. Atomically replace `legal.index` and `chunks.pkl` in vector store</p>
                                </div>
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                                    Existing citizen chat will automatically pick up the new index once completed.
                                </p>
                            </div>
                        )}

                        {isGenerating && (
                            <div className="py-8 text-center space-y-3">
                                <div className="h-10 w-10 mx-auto rounded-full border-4 border-amber-600 border-t-transparent animate-spin" />
                                <p className="text-xs font-bold text-slate-900 dark:text-white">
                                    Regenerating Vectors & FAISS Index...
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono">
                                    Downloading Cloudinary PDFs, splitting chunks, and generating sentence embeddings.
                                </p>
                            </div>
                        )}

                        {generationResult && (
                            <div className="space-y-3 py-2">
                                <div className={`p-4 rounded-xl text-xs space-y-2 ${
                                    (generationResult.failed_documents?.length > 0)
                                        ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                                        : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                                }`}>
                                    <p className="font-bold flex items-center gap-1.5">
                                        <span>{generationResult.failed_documents?.length > 0 ? "⚠️" : "✓"}</span>
                                        <span>{generationResult.message}</span>
                                    </p>
                                    <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-white/[0.1] text-center font-mono">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase">Evaluated</p>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">{generationResult.total_documents}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">Successful</p>
                                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{generationResult.successful_documents_count ?? generationResult.successful_documents?.length ?? generationResult.total_documents}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-red-600 dark:text-red-400 uppercase">Failed / Skipped</p>
                                            <p className="text-sm font-bold text-red-600 dark:text-red-400">{generationResult.failed_documents_count ?? generationResult.failed_documents?.length ?? 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase">Chunks</p>
                                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{generationResult.total_chunks}</p>
                                        </div>
                                    </div>
                                </div>

                                {generationResult.failed_documents?.length > 0 && (
                                    <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 space-y-2 text-xs">
                                        <p className="font-bold text-red-800 dark:text-red-300 flex items-center justify-between">
                                            <span>Skipped / Failed Documents ({generationResult.failed_documents.length})</span>
                                            <span className="text-[10px] font-normal text-red-600 dark:text-red-400">Other {generationResult.successful_documents_count || generationResult.successful_documents?.length} documents indexed</span>
                                        </p>
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {generationResult.failed_documents.map((fd) => (
                                                <div key={fd.id} className="p-2 rounded-lg bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/40 text-[11px]">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                                                            #{fd.id} {fd.name}
                                                        </span>
                                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                                                            {fd.stage}
                                                        </span>
                                                    </div>
                                                    <p className="text-red-700 dark:text-red-400 mt-0.5 text-[10px]">
                                                        {fd.error}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.05]">
                            <button
                                onClick={() => {
                                    setShowGenerateModal(false);
                                    setGenerationResult(null);
                                }}
                                disabled={isGenerating}
                                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.05]"
                            >
                                {generationResult ? "Close" : "Cancel"}
                            </button>
                            {!generationResult && (
                                <button
                                    onClick={executeGenerateEmbeddings}
                                    disabled={isGenerating || documents.filter((d) => d.is_active).length === 0}
                                    className="px-5 py-2 rounded-xl bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <span>Start Embedding Generation</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* ADD CATEGORY MODAL                                                */}
            {/* ================================================================= */}
            {showAddCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#16191D] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] pb-3">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Add Legal Category
                            </h3>
                            <button
                                onClick={() => setShowAddCategoryModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateCategory} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Category Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Environmental & Forest Law"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Description
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Brief scope of laws covered by this category..."
                                    value={newCategoryDesc}
                                    onChange={(e) => setNewCategoryDesc(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/[0.1] dark:bg-[#1C2025] dark:text-white"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.05]">
                                <button
                                    type="button"
                                    onClick={() => setShowAddCategoryModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.05]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingCategory || !newCategoryName.trim()}
                                    className="px-5 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isCreatingCategory ? "Creating..." : "Save Category"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Admin;
