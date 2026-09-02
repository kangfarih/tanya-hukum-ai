export type CitationSource = {
  id: number;
  title: string;
  href: string;
};

export const sourceCatalog: Record<number, CitationSource> = {
  1: {
    id: 1,
    title: "UU No. 6 Tahun 1983 tentang Ketentuan Umum dan Tata Cara Perpajakan",
    href: "https://peraturan.bpk.go.id/Details/47486/uu-no-6-tahun-1983",
  },
  2: {
    id: 2,
    title: "Peraturan Menteri Keuangan tentang tata cara keberatan pajak",
    href: "https://peraturan.bpk.go.id/Details/46085/permenkeu-no-50-tahun-2022",
  },
  3: {
    id: 3,
    title: "Undang-Undang No. 30 Tahun 2014 tentang Administrasi Pemerintahan",
    href: "https://peraturan.bpk.go.id/Details/38270/uu-no-30-tahun-2014",
  },
};

export function getCitationIds(content: string): number[] {
  const ids = Array.from(content.matchAll(/\[\^(\d+)\]/g), (match) => Number(match[1]));
  return [...new Set(ids)].sort((left, right) => left - right);
}

export function stripCitationMarkers(content: string): string {
  return content.replace(/\[\^(\d+)\]/g, "").trim();
}

export function groupConversationDateLabel(date: number, lang: "id" | "en") {
  const oneDay = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diff = now - date;

  if (diff < oneDay) return lang === "id" ? "Hari ini" : "Today";
  if (diff < oneDay * 2) return lang === "id" ? "Kemarin" : "Yesterday";
  if (diff < oneDay * 7) return lang === "id" ? "7 hari terakhir" : "Last 7 days";
  return lang === "id" ? "Sebelumnya" : "Older";
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 4) return `${weeks}w`;
  if (months < 12) return `${months}mo`;
  return `${years}y`;
}
