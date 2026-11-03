import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChatItem from "../components/ChatItem";
import SuggestionCard from "../components/SuggestionCard";
import QuestionBlock from "../components/QuestionBlock";
import AnswerBlock from "../components/AnswerBlock";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Dashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [serverErrorBanner, setServerErrorBanner] = useState(null);
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [conversationId, setConversationId] = useState(0);
    const [creatingChat, setCreatingChat] = useState(false);
    const [sending, setSending] = useState(false);

    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, sending]);

    const fetchChats = async () => {
        try {
            const response = await api.get("/users/chats/");
            const fetchedChats = Array.isArray(response.data) ? response.data : [];
            setChats(fetchedChats);
            if (fetchedChats.length > 0 && !activeChatId) {
                selectChat(fetchedChats[0]);
            }
        } catch (err) {
            console.error("Failed to fetch chats:", err);
            if (err.code === "ERR_NETWORK" || !err.response) {
                setServerErrorBanner("Unable to connect to the NyayKosh server. Please ensure the backend is running.");
            }
        }
    };

    useEffect(() => {
        fetchChats();
    }, []);

    const suggestions = [
        {
            title: "Fundamental Rights (Art. 14, 19, 21)",
            description: "Understand equality, speech freedoms, and protection of life and personal liberty."
        },
        {
            title: "Consumer Rights & Defective Products",
            description: "How to claim refund and file grievances under Consumer Protection Act, 2019."
        },
        {
            title: "Right to Information (RTI Procedure)",
            description: "Step-by-step guidance on how to file an RTI request with Public Information Officers."
        },
        {
            title: "BNS vs IPC Legal Transition",
            description: "Compare procedural and penal updates under the Bharatiya Nyaya Sanhita, 2023."
        }
    ];

    const getChatTitle = (chat) => {
        const firstEntry = chat.chats?.[0]?.[0];
        if (!firstEntry) return "New Legal Case";
        const queryText = typeof firstEntry === "object" ? firstEntry.query : firstEntry[0];
        if (!queryText) return "New Legal Case";
        return queryText.length > 25 ? `${queryText.slice(0, 25)}...` : queryText;
    };

    const createNewChat = async () => {
        if (creatingChat) return;
        setCreatingChat(true);
        setError(false);
        setServerErrorBanner(null);
        try {
            const response = await api.post("/users/chats/", {
                chats: [[]]
            });
            const newChat = response.data;
            setChats(prev => [newChat, ...prev]);
            setActiveChatId(newChat.id);
            setConversationId(0);
            setMessages([]);
            setQuestion("");
        } catch (err) {
            console.error("Failed to create new chat:", err);
            setServerErrorBanner("Unable to create a new case session. Please check your connection.");
        } finally {
            setCreatingChat(false);
        }
    };

    const deleteChat = async (chatId) => {
        try {
            await api.delete(`/users/chats/${chatId}/`);
            setChats(prev => prev.filter(c => c.id !== chatId));
            if (activeChatId === chatId) {
                const remaining = chats.filter(c => c.id !== chatId);
                if (remaining.length > 0) {
                    selectChat(remaining[0]);
                } else {
                    setActiveChatId(null);
                    setMessages([]);
                }
            }
        } catch (err) {
            console.error("Failed to delete chat:", err);
        }
    };

    const selectChat = (chat) => {
        setActiveChatId(chat.id);
        setConversationId(0);
        setError(false);
        setServerErrorBanner(null);

        const conversation = chat.chats?.[0] || [];
        const restoredMessages = conversation.map((item, idx) => {
            if (item && typeof item === "object" && !Array.isArray(item)) {
                return {
                    id: idx,
                    question: item.query || item.question || "",
                    answer: item.answer || "",
                    sources: item.sources || [],
                    isNew: false, // Do not animate old messages
                    loading: false,
                    error: false
                };
            } else if (Array.isArray(item)) {
                return {
                    id: idx,
                    question: item[0] || "",
                    answer: item[1] || "",
                    sources: [],
                    isNew: false, // Do not animate old messages
                    loading: false,
                    error: false
                };
            }
            return null;
        }).filter(Boolean);

        setMessages(restoredMessages);
        setQuestion("");
    };

    const sendQuestion = async (e) => {
        if (e) e.preventDefault();
        if (!question.trim() || sending) return;

        let currentChatId = activeChatId;
        if (!currentChatId) {
            try {
                const res = await api.post("/users/chats/", { chats: [[]] });
                const newChat = res.data;
                setChats(prev => [newChat, ...prev]);
                setActiveChatId(newChat.id);
                currentChatId = newChat.id;
            } catch (err) {
                setServerErrorBanner("Unable to initialize chat session.");
                return;
            }
        }

        const currentQuestion = question.trim();
        setQuestion("");
        setError(false);
        setErrorMessage("");
        setServerErrorBanner(null);
        setSending(true);

        const newMsgIndex = messages.length;
        setMessages(prev => [
            ...prev,
            {
                id: newMsgIndex,
                question: currentQuestion,
                answer: "",
                sources: [],
                error: false,
                loading: true,
                isNew: true // Only animate this newly submitted answer
            }
        ]);

        try {
            const response = await api.post("/rag/ask/", {
                question: currentQuestion,
                chat_id: currentChatId,
                conversation_id: conversationId
            });

            const answer = response.data.answer || "";
            const sources = response.data.sources || [];

            setMessages(prev =>
                prev.map((msg, index) =>
                    index === newMsgIndex
                        ? {
                            ...msg,
                            answer,
                            sources,
                            loading: false,
                            error: false,
                            isNew: true
                        }
                        : msg
                )
            );

            // Update in-memory chat session
            setChats(prev =>
                prev.map(chat => {
                    if (chat.id !== currentChatId) return chat;
                    const updated = [...(chat.chats || [])];
                    if (!updated[conversationId]) {
                        updated[conversationId] = [];
                    }
                    updated[conversationId] = [
                        ...updated[conversationId],
                        {
                            query: currentQuestion,
                            answer,
                            sources,
                            timestamp: new Date().toISOString()
                        }
                    ];
                    return { ...chat, chats: updated };
                })
            );
        } catch (err) {
            console.error("RAG request failed:", err);
            const errDetail =
                err.response?.data?.error ||
                (err.code === "ERR_NETWORK"
                    ? "Unable to connect to the NyayKosh server. Please ensure the backend is running."
                    : "The legal AI service encountered an error. Please try again.");

            setMessages(prev =>
                prev.map((msg, index) =>
                    index === newMsgIndex
                        ? {
                            ...msg,
                            answer: "",
                            sources: [],
                            loading: false,
                            error: true,
                            errorMessage: errDetail,
                            isNew: false
                        }
                        : msg
                )
            );
            setError(true);
            setErrorMessage(errDetail);
            if (err.code === "ERR_NETWORK" || err.response?.status >= 500) {
                setServerErrorBanner(errDetail);
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#111315] dark:text-white transition-colors duration-200">
            {/* Sidebar */}
            {sidebarOpen && (
                <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#16191D] transition-colors duration-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.05]">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-sm">
                                    N
                                </span>
                                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                                    NyayKosh
                                </h1>
                            </div>
                            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                                Legal Intelligence
                            </p>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs transition"
                            title="Close Sidebar"
                        >
                            ◀
                        </button>
                    </div>

                    {/* New Case Button */}
                    <div className="p-4">
                        <button
                            onClick={createNewChat}
                            disabled={creatingChat}
                            className={`w-full rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-left transition hover:border-blue-400 hover:bg-blue-100/60 dark:border-blue-500/30 dark:bg-blue-500/[0.06] dark:hover:border-blue-500/60 dark:hover:bg-blue-500/[0.1] ${
                                creatingChat ? "cursor-not-allowed opacity-60" : ""
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">+</span>
                                <div>
                                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                                        {creatingChat ? "Creating Case..." : "New Consultation"}
                                    </p>
                                    <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Start new legal inquiry
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Case Archive List */}
                    <div className="flex-1 overflow-y-auto px-3 space-y-1">
                        <div className="mb-2 flex items-center justify-between px-2 pt-2">
                            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Case Archive
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                                {chats.length}
                            </span>
                        </div>

                        {chats.map(chat => (
                            <ChatItem
                                key={chat.id}
                                id={chat.id}
                                title={getChatTitle(chat)}
                                category="Indian Statute Q&A"
                                isActive={chat.id === activeChatId}
                                onClick={() => selectChat(chat)}
                                onDelete={() => deleteChat(chat.id)}
                            />
                        ))}

                        {chats.length === 0 && (
                            <p className="px-3 py-6 text-center text-xs text-slate-400">
                                No past consultations recorded.
                            </p>
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    <div className="border-t border-slate-200 dark:border-white/[0.08] p-3 space-y-2">
                        {user?.is_staff && (
                            <Link
                                to="/admin"
                                className="flex items-center justify-between w-full rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition dark:bg-blue-600/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-600/20"
                            >
                                <span className="flex items-center gap-2">
                                    <span>⚙</span> Administrator Panel
                                </span>
                                <span className="text-[10px] uppercase font-mono">Staff</span>
                            </Link>
                        )}

                        <div className="flex items-center justify-between px-2 pt-1 text-xs">
                            <span className="truncate max-w-[130px] font-semibold text-slate-800 dark:text-slate-200">
                                {user?.name || user?.username || "Citizen"}
                            </span>
                            <button
                                onClick={() => logout()}
                                className="flex items-center gap-1 font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition"
                                title="Sign out of NyayKosh"
                            >
                                <span>Logout</span> ➔
                            </button>
                        </div>
                    </div>
                </aside>
            )}

            {/* Main Consultation Area */}
            <main className="relative flex h-screen min-w-0 flex-1 flex-col">
                {/* Header */}
                <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-white/[0.08] dark:bg-[#111315] transition-colors">
                    <div className="flex items-center gap-3">
                        {!sidebarOpen && (
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 dark:border-white/[0.1] dark:text-slate-300 dark:hover:text-white"
                            >
                                ▶ Menu
                            </button>
                        )}
                        <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                                {chats.find(c => c.id === activeChatId)
                                    ? getChatTitle(chats.find(c => c.id === activeChatId))
                                    : "NyayKosh Legal Assistant"}
                            </p>
                            <p className="font-mono text-[9px] uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                Grounded in Indian Acts & Codes
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {user?.is_staff && (
                            <Link
                                to="/admin"
                                className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                            >
                                Admin Dashboard
                            </Link>
                        )}

                        {/* Theme Switcher Button */}
                        <button
                            onClick={toggleTheme}
                            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-blue-600 dark:border-white/[0.1] dark:bg-[#16191D] dark:text-slate-300 dark:hover:border-white/[0.2] dark:hover:text-white"
                            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            <span>{isDark ? "☀" : "🌙"}</span>
                            <span>{isDark ? "Light" : "Dark"}</span>
                        </button>
                    </div>
                </header>

                {/* Server Error Notification Banner */}
                {serverErrorBanner && (
                    <div className="bg-red-500 text-white text-xs px-4 py-2 flex items-center justify-between shadow-md">
                        <div className="flex items-center gap-2">
                            <span className="font-bold">⚠️ Warning:</span>
                            <span>{serverErrorBanner}</span>
                        </div>
                        <button
                            onClick={() => setServerErrorBanner(null)}
                            className="text-white hover:text-red-200 text-xs font-bold px-2"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Chat Scroll Area */}
                <div className="relative min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 pb-48">
                        {messages.length === 0 ? (
                            <div className="pt-8 sm:pt-14">
                                <div className="mb-10 text-center max-w-2xl mx-auto">
                                    <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 mb-3">
                                        Empowering Citizens With Legal Clarity
                                    </span>
                                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                                        Understand Indian Laws in Simple Language
                                    </h2>
                                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        Ask legal questions, explore statutory rights, compare provisions, or get guidance
                                        on filing consumer and procedural complaints grounded in official Indian statutes.
                                    </p>
                                </div>

                                <div className="max-w-3xl mx-auto">
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                                        Suggested Legal Topics
                                    </p>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {suggestions.map(s => (
                                            <SuggestionCard
                                                key={s.title}
                                                title={s.title}
                                                description={s.description}
                                                onClick={() => {
                                                    setQuestion(`Please explain: ${s.title}`);
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {messages.map((msg, index) => (
                                    <div key={msg.id || index} className="space-y-3">
                                        <QuestionBlock question={msg.question} />
                                        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#171A1E] transition-colors">
                                            <AnswerBlock
                                                answer={msg.answer}
                                                sources={msg.sources}
                                                error={msg.error}
                                                errorMessage={msg.errorMessage}
                                                loading={msg.loading}
                                                isNew={msg.isNew}
                                                onRetry={() => {
                                                    setQuestion(msg.question);
                                                    sendQuestion();
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Input Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-[#111315] dark:via-[#111315]/95 dark:to-transparent transition-colors">
                    <form onSubmit={sendQuestion} className="mx-auto max-w-3xl">
                        <div className="rounded-2xl border border-slate-300 bg-white p-2 shadow-xl focus-within:border-blue-500 dark:border-white/[0.1] dark:bg-[#1B1E22] dark:focus-within:border-blue-500/60 transition-all">
                            <div className="flex items-end gap-2">
                                <textarea
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            sendQuestion();
                                        }
                                    }}
                                    rows="1"
                                    placeholder="Ask about Indian acts, penalties, rights, or filing procedures..."
                                    className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white dark:placeholder-slate-500"
                                />
                                <button
                                    type="submit"
                                    disabled={sending || !question.trim()}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
                                >
                                    {sending ? "Searching..." : "Ask NyayKosh"}
                                </button>
                            </div>
                        </div>

                        {error && !serverErrorBanner && (
                            <p className="mt-1.5 text-center text-xs text-red-500 dark:text-red-400">
                                {errorMessage || "Failed to process query. Please try again."}
                            </p>
                        )}

                        <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-wider text-slate-400">
                            AI-assisted legal information grounded in statutory knowledge base • Not formal legal advice
                        </p>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
