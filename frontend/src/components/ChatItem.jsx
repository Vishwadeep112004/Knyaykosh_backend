function ChatItem({ id, title, category, onClick, onDelete, isActive = false }) {
    return (
        <div
            onClick={onClick}
            className={`group flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-left transition cursor-pointer border ${
                isActive
                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400"
                    : "border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-300"
            }`}
        >
            <div className="flex gap-2.5 min-w-0 items-center">
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    #{id}
                </span>

                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                        {title}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {category}
                    </p>
                </div>
            </div>

            {onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(id);
                    }}
                    title="Delete Case"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition text-xs"
                >
                    ✕
                </button>
            )}
        </div>
    );
}

export default ChatItem;
