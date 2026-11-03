function Loading() {
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

export default Loading;