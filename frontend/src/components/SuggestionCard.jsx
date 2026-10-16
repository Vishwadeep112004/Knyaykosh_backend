function SuggestionCard({ title, description, onClick }) {
    return (
        <button
            onClick={onClick}
            className="group w-full rounded-2xl border border-white/[0.1] bg-[#1D2125] p-5 text-left transition-all duration-200 hover:border-blue-500/40 hover:bg-[#22272C]"
        >
            <div className="flex items-start justify-between">
                <h3 className="text-sm font-medium text-white">
                    {title}
                </h3>

                <span className="font-mono text-sm text-gray-500 transition group-hover:text-blue-400">
                    →
                </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-gray-400">
                {description}
            </p>
        </button>
    );
}

export default SuggestionCard;