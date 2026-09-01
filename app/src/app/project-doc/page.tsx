import Link from "next/link";

const projectHighlights = [
  "Legal Q&A over a curated Indonesian legal corpus",
  "Streaming AI responses with multi-provider failover",
  "Gemini first, then OpenRouter, then DeepSeek for resilience",
  "Portfolio-ready architecture for explainable legal answers",
];

export default function ProjectDocPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 text-zinc-900 dark:text-zinc-50">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            Documentation
          </p>
          <h1 className="mt-2 text-3xl font-bold">TanyaHukum project overview</h1>
        </div>

        <Link
          href="/"
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Back to chat
        </Link>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">Project overview</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          TanyaHukum is a legal assistant built to answer Indonesian legal questions with a grounded,
          source-aware workflow: a curated corpus, retrieval context, and a resilient AI stack designed for
          clear, explainable responses.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {projectHighlights.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            Stack
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <li>Next.js + TypeScript</li>
            <li>OpenAI SDK</li>
            <li>Tailwind UI</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            AI order
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <li>Gemini first</li>
            <li>OpenRouter second</li>
            <li>DeepSeek last</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            Docs
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <li>Architecture in repo</li>
            <li>Local app docs</li>
            <li>Prompt versioning</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">Why this architecture</h2>
        <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          <p>
            The system keeps responsibility boundaries clear: the app handles user interaction and streaming,
            the model layer handles provider resilience, and the corpus plus evaluation work supports legal
            answer quality.
          </p>
          <p>
            This approach is useful for a portfolio project because it stays understandable, visually clear, and
            resilient when one provider is unavailable or rate-limited.
          </p>
        </div>
      </section>
    </main>
  );
}
