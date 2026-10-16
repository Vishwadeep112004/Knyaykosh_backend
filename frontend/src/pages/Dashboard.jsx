
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatItem from "../components/ChatItem";
import SuggestionCard from "../components/SuggestionCard";
import QuestionBlock from "../components/QuestionBlock";
import AnswerBlock from "../components/AnswerBlock";
import api from "../api/api";

function Dashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [dark, setDark] = useState(true);
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(false);
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [conversationId, setConversationId] = useState(0);
    const [creatingChat, setCreatingChat] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const navigation = useNavigate();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const fetchChats = async () => {
            try {
                const response = await api.get("/users/chats/");
                setChats(Array.isArray(response.data) ? response.data : []);
            } catch (err) {
                console.error("Failed to fetch chats:", err);
                console.error("Backend response:", err.response?.data);
            }
        };
        fetchChats();
    }, []);

    const suggestions = [
        {
            title: "Constitutional Law",
            description: "Explore fundamental rights and constitutional provisions"
        },
        {
            title: "Contract Law",
            description: "Understand contracts, obligations and breaches"
        },
        {
            title: "Consumer Law",
            description: "Learn about consumer rights and protections"
        },
        {
            title: "Information Law",
            description: "Understand the Right to Information Act"
        }
    ];

    const logout = () => {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("ACCESS_TOKEN");
        localStorage.removeItem("REFRESH_TOKEN");
        navigation("/login");
    };

    const getChatTitle = (chat) => {
        const firstQuestion = chat.chats?.[0]?.[0]?.[0];
        if (!firstQuestion) return "New Case";
        return firstQuestion.length > 25
            ? `${firstQuestion.slice(0, 25)}...`
            : firstQuestion;
    };

    const createNewChat = async () => {
        if (creatingChat) return;
        setCreatingChat(true);
        setError(false);
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
            console.error("Backend response:", err.response?.data);
            setError(true);
        } finally {
            setCreatingChat(false);
        }
    };

    const selectChat = (chat) => {
        setActiveChatId(chat.id);
        setConversationId(0);
        const conversation = chat.chats?.[0] || [];
        setMessages(
            conversation.map(([savedQuestion, savedAnswer]) => ({
                question: savedQuestion,
                answer: savedAnswer,
                sources: [],
                error: false,
                loading: false
            }))
        );
        setQuestion("");
        setError(false);
    };

    const sendQuestion = async (e) => {
        e.preventDefault();
        if (!question.trim() || sending) return;
        if (!activeChatId) {
            setError(true);
            return;
        }

        const currentQuestion = question.trim();
        setQuestion("");
        setError(false);
        setSending(true);

        setMessages(prev => [
            ...prev,
            {
                question: currentQuestion,
                answer: "",
                sources: [],
                error: false,
                loading: true
            }
        ]);

        try {
            const response = await api.post("/rag/ask/", {
                question: currentQuestion,
                chat_id: activeChatId,
                conversation_id: conversationId
            });

            const answer = response.data.answer || "";
            const sources = response.data.sources || [];

            setMessages(prev =>
                prev.map((message, index) =>
                    index === prev.length - 1
                        ? {
                            ...message,
                            answer,
                            sources,
                            loading: false,
                            error: false
                        }
                        : message
                )
            );

            setChats(prev =>
                prev.map(chat => {
                    if (chat.id !== activeChatId) return chat;
                    const updatedConversations = [...(chat.chats || [])];
                    if (!updatedConversations[conversationId]) {
                        updatedConversations[conversationId] = [];
                    }
                    updatedConversations[conversationId] = [
                        ...updatedConversations[conversationId],
                        [currentQuestion, answer]
                    ];
                    return { ...chat, chats: updatedConversations };
                })
            );
        } catch (err) {
            console.error("RAG request failed:", err);
            console.error("Backend response:", err.response?.data);
            setMessages(prev =>
                prev.map((message, index) =>
                    index === prev.length - 1
                        ? {
                            ...message,
                            answer: "",
                            sources: [],
                            loading: false,
                            error: true
                        }
                        : message
                )
            );
            setError(true);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${
            dark ? "bg-[#111315] text-white" : "bg-gray-100 text-gray-900"
        }`}>
            {sidebarOpen && (
                <aside className={`flex w-72 shrink-0 flex-col border-r transition-colors duration-300 ${
                    dark ? "border-white/[0.08] bg-[#171A1D]" : "border-gray-200 bg-white"
                }`}>
                    <div className="flex items-center justify-between px-5 py-5">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">NyayKosh</h1>
                            <p className={`mt-1 font-mono text-[10px] uppercase tracking-[0.2em] ${
                                dark ? "text-blue-500" : "text-blue-600"
                            }`}>
                                Legal Intelligence
                            </p>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className={`rounded-lg border px-3 py-2 text-xs transition ${
                                dark
                                    ? "border-white/[0.1] text-gray-400 hover:border-blue-500/50 hover:text-white"
                                    : "border-gray-200 text-gray-500 hover:border-blue-400 hover:text-gray-900"
                            }`}
                        >
                            Close
                        </button>
                    </div>

                    <div className="px-4">
                        <button
                            onClick={createNewChat}
                            disabled={creatingChat}
                            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                                dark
                                    ? "border-blue-500/30 bg-blue-500/[0.06] hover:border-blue-500/60 hover:bg-blue-500/[0.1]"
                                    : "border-blue-200 bg-blue-50 hover:border-blue-400"
                            } ${creatingChat ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`text-xl ${dark ? "text-blue-400" : "text-blue-600"}`}>
                                    +
                                </span>
                                <div>
                                    <p className="text-sm font-medium">
                                        {creatingChat ? "Creating Case..." : "New Case"}
                                    </p>
                                    <p className={`mt-0.5 font-mono text-[9px] uppercase tracking-wider ${
                                        dark ? "text-gray-500" : "text-gray-400"
                                    }`}>
                                        Start conversation
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="mt-8 flex-1 overflow-y-auto px-4">
                        <div className="mb-3 flex items-center justify-between px-2">
                            <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                                dark ? "text-gray-500" : "text-gray-400"
                            }`}>
                                Case Archive
                            </p>
                            <span className={`font-mono text-[10px] ${
                                dark ? "text-gray-500" : "text-gray-400"
                            }`}>
                                {String(chats.length).padStart(2, "0")}
                            </span>
                        </div>

                        <div className="space-y-1">
                            {chats.map(chat => (
                                <ChatItem
                                    key={chat.id}
                                    id={chat.id}
                                    title={getChatTitle(chat)}
                                    category="Legal Case"
                                    onClick={() => selectChat(chat)}
                                />
                            ))}
                            {chats.length === 0 && (
                                <p className={`px-2 py-3 text-xs ${
                                    dark ? "text-gray-500" : "text-gray-400"
                                }`}>
                                    No saved cases yet.
                                </p>
                            )}
                        </div>
                    </div>


                    <div className={`border-t p-3 ${
                        dark ? "border-white/[0.08]" : "border-gray-200"
                    }`}>
                        
                        <button
                            onClick={logout}
                            className={`mt-1 w-full rounded-lg px-3 py-3 text-left text-sm transition ${
                                dark
                                    ? "text-gray-400 hover:bg-white/[0.05] hover:text-white"
                                    : "text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                            Logout
                        </button>
                    </div>
                </aside>
            )}

            <main className="relative flex h-screen min-w-0 flex-1 flex-col">
                <header className={`flex h-16 shrink-0 items-center border-b px-5 ${
                    dark ? "border-white/[0.08] bg-[#111315]" : "border-gray-200 bg-gray-100"
                }`}>
                    {!sidebarOpen && (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className={`mr-4 rounded-lg border px-3 py-2 text-xs transition ${
                                dark
                                    ? "border-white/[0.1] text-gray-400 hover:border-blue-500/50 hover:text-white"
                                    : "border-gray-200 text-gray-500 hover:border-blue-400"
                            }`}
                        >
                            Menu
                        </button>
                    )}
                    <div>
                        <p className="text-sm font-medium">Legal AI</p>
                        <p className={`font-mono text-[9px] uppercase tracking-[0.2em] ${
                            dark ? "text-gray-500" : "text-gray-400"
                        }`}>
                            {chats.find(chat => chat.id === activeChatId)
                                ? getChatTitle(chats.find(chat => chat.id === activeChatId))
                                : "New Case"}
                        </p>
                    </div>
                </header>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto">
                        <div className="mx-auto w-full max-w-4xl px-6 pb-40">
                            {messages.length === 0 ? (
                                <div className="pt-20">
                                    <div className="mb-14">
                                        <p className={`mb-4 font-mono text-xs uppercase tracking-[0.3em] ${
                                            dark ? "text-blue-400" : "text-blue-600"
                                        }`}>
                                            Legal Intelligence System
                                        </p>
                                        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
                                            Understand Indian law.
                                            <br />
                                            <span className={dark ? "text-gray-500" : "text-gray-400"}>
                                                Ask NyayKosh.
                                            </span>
                                        </h2>
                                        <p className={`mt-5 max-w-2xl text-sm leading-6 ${
                                            dark ? "text-gray-400" : "text-gray-500"
                                        }`}>
                                            Search across your legal knowledge base, retrieve relevant
                                            provisions, and get AI-generated explanations grounded in
                                            legal documents.
                                        </p>
                                    </div>

                                    <div>
                                        <div className="mb-4 flex items-center gap-3">
                                            <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                                                dark ? "text-gray-500" : "text-gray-400"
                                            }`}>
                                                Explore
                                            </span>
                                            <div className={`h-px flex-1 ${
                                                dark ? "bg-white/[0.08]" : "bg-gray-200"
                                            }`} />
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {suggestions.map(suggestion => (
                                                <SuggestionCard
                                                    key={suggestion.title}
                                                    title={suggestion.title}
                                                    description={suggestion.description}
                                                    onClick={() => setQuestion(
                                                        `Tell me about ${suggestion.title}`
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-10 pt-8">
                                    {messages.map((message, index) => (
                                        <div key={index} className="space-y-6">
                                            <QuestionBlock question={message.question} />
                                            <AnswerBlock
                                                answer={message.answer}
                                                sources={message.sources}
                                                error={message.error}
                                                loading={message.loading}
                                            />
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`absolute bottom-0 left-0 right-0 px-5 pb-5 pt-10 ${
                    dark
                        ? "bg-gradient-to-t from-[#111315] via-[#111315] to-transparent"
                        : "bg-gradient-to-t from-gray-100 via-gray-100 to-transparent"
                }`}>
                    <form onSubmit={sendQuestion} className="mx-auto max-w-3xl">
                        <div className={`rounded-2xl border p-2 shadow-2xl transition ${
                            dark
                                ? "border-white/[0.1] bg-[#1D2125] shadow-black/30 focus-within:border-blue-500/50"
                                : "border-gray-300 bg-white focus-within:border-blue-400"
                        }`}>
                            <div className="flex items-end gap-2">
                                <textarea
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            e.currentTarget.form?.requestSubmit();
                                        }
                                    }}
                                    rows="1"
                                    placeholder="Ask a legal question..."
                                    className={`max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none ${
                                        dark
                                            ? "text-gray-100 placeholder-gray-500"
                                            : "text-gray-900 placeholder-gray-400"
                                    }`}
                                />
                                <button
                                    type="submit"
                                    disabled={sending || !question.trim()}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {sending ? "Thinking..." : "Ask"}
                                </button>
                            </div>
                        </div>
                        {error && (
                            <p className="mt-2 text-center text-xs text-red-400">
                                {activeChatId
                                    ? "Something went wrong. Please try again."
                                    : "Create or select a case before asking a question."}
                            </p>
                        )}
                        <p className={`mt-2 text-center font-mono text-[9px] uppercase tracking-wider ${
                            dark ? "text-gray-500" : "text-gray-400"
                        }`}>
                            AI responses are generated from the legal knowledge base
                        </p>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
