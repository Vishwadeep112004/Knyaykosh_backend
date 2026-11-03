function SuggestionCard({ title, description, onClick }) {
    return (
        <button
            onClick={onClick}
            className="group w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-md dark:border-white/[0.1] dark:bg-[#1D2125] dark:hover:border-blue-500/40 dark:hover:bg-[#22272C]"
        >
            <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white transition group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {title}
                </h3>

                <span className="font-mono text-sm text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-blue-400 shrink-0">
                    →
                </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                {description}
            </p>
        </button>
    );
}

export default SuggestionCard;
