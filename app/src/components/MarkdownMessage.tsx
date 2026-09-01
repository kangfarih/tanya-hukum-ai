import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type MarkdownMessageProps = {
  content?: string | null;
  className?: string;
};

function sanitizePartialMarkdown(value: string): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const lines = trimmed.split("\n");
  const lastLine = lines[lines.length - 1] ?? "";

  // Ignore trailing unbalanced markdown syntax while the stream is still arriving.
  const sanitizedLastLine = lastLine
    .replace(/(\*\*|__|~~|_\*|\*|_|\[|`|~)+$/g, "")
    .replace(/```+\s*$/g, "")
    .replace(/~~~+\s*$/g, "");

  if (sanitizedLastLine !== lastLine) {
    lines[lines.length - 1] = sanitizedLastLine;
    return lines.join("\n").trim();
  }

  // Gracefully avoid rendering a dangling fenced code block mid-stream.
  if (trimmed.includes("```") && (trimmed.match(/```/g) ?? []).length % 2 !== 0) {
    return trimmed.replace(/```[\s\S]*$/, "");
  }

  return trimmed;
}

function CodeBlock({ children, className, ...props }: ComponentPropsWithoutRef<"code">) {
  const [copied, setCopied] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const codeString = String(children).replace(/\n$/, "");
  const languageMatch = /language-(\w+)/.exec(className || "");
  const language = languageMatch ? languageMatch[1] : "text";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setIsDarkMode(mediaQuery.matches);

    syncTheme();
    mediaQuery.addEventListener("change", syncTheme);

    return () => mediaQuery.removeEventListener("change", syncTheme);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard access is optional and should not block the message render.
    }
  };

  return (
    <div className="not-prose my-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-200/80 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <SyntaxHighlighter
        {...props}
        PreTag="div"
        language={language}
        style={isDarkMode ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "1rem",
          fontSize: "0.82rem",
          lineHeight: "1.6",
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

export function MarkdownMessage({ content, className = "" }: MarkdownMessageProps) {
  const safeContent = sanitizePartialMarkdown(content ?? "");

  if (!safeContent) {
    return null;
  }

  return (
    <div
      className={[
        "prose prose-zinc max-w-none text-inherit dark:prose-invert",
        "prose-headings:mt-0 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
        "prose-a:text-blue-600 prose-a:no-underline prose-a:underline-offset-2 hover:prose-a:text-blue-500 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300",
        className,
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              {...props}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline decoration-2 underline-offset-2 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {children}
            </a>
          ),
          code: ({ inline, className, children, ...props }: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) => {
            if (inline) {
              return (
                <code
                  {...props}
                  className={["rounded bg-zinc-200 px-1 py-0.5 text-[0.9em] text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100", className].join(" ")}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
          },
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
}
