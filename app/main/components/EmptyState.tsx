"use client";

type EmptyStateProps = {
  suggestions: string[];
  isLoading: boolean;
  onSuggestionClick: (value: string) => void;
};

export function EmptyState({ suggestions, isLoading, onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tanya hukum Indonesia</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ajukan pertanyaan hukum dan dapatkan jawaban yang dirancang untuk dibaca dengan konteks dan sumber.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSuggestionClick(prompt)}
            disabled={isLoading}
            className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
