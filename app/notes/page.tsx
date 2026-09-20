import Link from "next/link";
import { knowledgeCategories, knowledgeNotes } from "../lib/knowledge-notes";

export const metadata = {
  title: "知识日记 | 福仔日记",
  description: "整理后端学习记录、AI Agent 笔记和实践中的新发现。",
};

export default function NotesPage() {
  return (
    <main className="xhs-shell min-h-screen px-5 pb-20 pt-28 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="notes-hero mb-12 rounded-lg border border-[#B7DCEB] px-6 py-10 md:px-12 md:py-14">
          <p className="xhs-section-label">福仔知识日记</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-slate-950 md:text-6xl">
            一边记录福仔，<span className="xhs-highlight">一边弄懂世界</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            这里放后端学习记录、AI Agent 笔记和实践中的新发现，共 {knowledgeNotes.length} 篇。
          </p>
        </header>

        <div className="grid gap-14">
          {knowledgeCategories.map((category) => (
            <section key={category.slug} id={category.slug}>
              <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
                <div>
                  <p className="xhs-section-label">{category.label}</p>
                  <h2 className="mt-3 text-3xl font-black text-slate-950">{category.description}</h2>
                </div>
                <span className="xhs-pill w-fit bg-[#D5C6E0]/70 text-sm font-bold text-slate-700">
                  {category.notes.length} 篇
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {category.notes.map((note) => (
                  <Link key={note.slug} href={`/notes/${note.slug}`} className="note-card group">
                    <div className="flex items-center justify-between gap-3">
                      <span className="xhs-pill bg-[#A8D8EA]/75 text-xs font-black text-sky-900">
                        {note.category.label}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{note.readingTime}</span>
                    </div>
                    <h3 className="mt-5 text-xl font-black leading-tight text-slate-950 transition group-hover:text-rose-600">
                      {note.title}
                    </h3>
                    {note.excerpt ? (
                      <p className="mt-4 line-clamp-3 leading-7 text-slate-600">{note.excerpt}</p>
                    ) : null}
                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      {note.headings.slice(0, 3).map((heading) => (
                        <span key={heading} className="note-tag">
                          {heading}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
