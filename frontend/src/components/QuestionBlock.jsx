function QuestionBlock({ question }) {
    return (
        <div className="flex justify-end animate-question">
            <div className="max-w-2xl rounded-2xl bg-blue-600 px-5 py-3 text-sm leading-6 text-white shadow-lg shadow-blue-900/10">
                {question}
            </div>
        </div>
    );
}

export default QuestionBlock;