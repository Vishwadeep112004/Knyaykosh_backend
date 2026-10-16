function ChatItem({ id, title, category, onClick }) {
    return (
        <button
            onClick={onClick}
            className="group w-full rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.05]"
        >
            <div className="flex gap-3">
                <span className="pt-0.5 font-mono text-[10px] text-gray-600 transition group-hover:text-blue-400">
                    #{id}
                </span>

                <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                        {title}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                        {category}
                    </p>
                </div>
            </div>
        </button>
    );
}

export default ChatItem;