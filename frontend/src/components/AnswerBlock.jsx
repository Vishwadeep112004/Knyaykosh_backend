import { useEffect, useState } from "react";

function AnswerBlock({
    answer = "",
    sources = [],
    error = false,
    loading = false
}) {
    const errorMessage =
        "Sorry, something went wrong while generating the answer. Please try again.";

    const textToType = error ? errorMessage : answer;

    const [displayedText, setDisplayedText] = useState("");

    useEffect(() => {
        if (loading) {
            setDisplayedText("");
            return;
        }

        if (!textToType) {
            setDisplayedText("");
            return;
        }

        let index = 0;

        setDisplayedText("");

        const interval = setInterval(() => {
            setDisplayedText(textToType.substring(0, index + 1));

            index++;

            if (index >= textToType.length) {
                clearInterval(interval);
            }
        }, 35);

        return () => clearInterval(interval);
    }, [textToType, loading]);

    if (loading) {
        return (
            <div className="flex items-center gap-1.5 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />

                <span
                    className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"
                    style={{ animationDelay: "150ms" }}
                />

                <span
                    className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"
                    style={{ animationDelay: "300ms" }}
                />
            </div>
        );
    }

    const typing = displayedText.length < textToType.length;

    return (
        <div className="w-full">
            <p
                className={`whitespace-pre-wrap text-sm leading-7 ${
                    error
                        ? "text-gray-800"
                        : "text-white"
                }`}
            >
                {displayedText}

                {typing && (
                    <span className="ml-1 text-blue-400">
                        |
                    </span>
                )}
            </p>

            {!error && !typing && sources.length > 0 && (
                <div className="mt-6">
                    <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
                        Sources
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {sources.map((source, index) => (
                            <button
                                key={index}
                                className="rounded-lg border border-white/[0.1] bg-[#1D2125] px-3 py-2 font-mono text-[10px] text-gray-400 transition hover:border-blue-500/40 hover:text-blue-400"
                            >
                                {source}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AnswerBlock;