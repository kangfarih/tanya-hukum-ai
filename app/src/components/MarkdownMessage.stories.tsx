import { MarkdownMessage } from "./MarkdownMessage";

export function MarkdownMessageExample() {
  const content = `# Pasal 12

**Pertanggungjawaban** atas keterlambatan pelaporan dapat dijatuhkan sesuai ketentuan yang berlaku.

1. Pelapor wajib menyampaikan data secara lengkap.
2. Keterlambatan harus dicatat dan dievaluasi.
3. Apabila ditemukan sengketa, dapat merujuk ke [dokumen sumber](https://example.com/legal-source).

> Catatan: lihat juga **pasal terkait** untuk konteks yang lebih lengkap.`;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <MarkdownMessage content={content} />
    </div>
  );
}
