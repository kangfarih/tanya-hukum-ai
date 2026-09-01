import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const sanitizedLastLine = lastLine.replace(/(\*\*|\*|__|_|~~|\[|`)+$/g, "");

  if (sanitizedLastLine !== lastLine) {
    lines[lines.length - 1] = sanitizedLastLine;
    return lines.join("\n").trim();
  }

  return trimmed;
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
