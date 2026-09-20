import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteMarkdown } from "../../components/notes/NoteMarkdown";
import { getKnowledgeNote, knowledgeNotes } from "../../lib/knowledge-notes";

type NotePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return knowledgeNotes.map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }: NotePageProps) {
  const { slug } = await params;
  const note = getKnowledgeNote(slug);

  return {
    title: note ? `${note.title} | 福仔知识日记` : "知识日记 | 福仔知识日记",
    description: note?.excerpt,
  };
}

export default async function NoteDetailPage({ params }: NotePageProps) {
  const { slug } = await params;
  const note = getKnowledgeNote(slug);

  if (!note) {
    notFound();
  }

  const related = knowledgeNotes
    .filter((item) => item.category.slug === note.category.slug && item.slug !== note.slug)
    .slice(0, 4);

  return (
    <main className="xhs-shell min-h-screen px-5 pb-20 pt-28 md:px-8">
      <article className="mx-auto max-w-5xl">
        <Link href="/notes" className="note-back-link">
          ← 返回知识日记
        </Link>

        <header className="note-article-header mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="xhs-pill bg-[#A8D8EA]/75 text-xs font-black text-sky-900">{note.category.label}</span>
            <span className="text-sm font-semibold text-slate-400">预计阅读 {note.readingTime}</span>
            <span className="text-sm font-semibold text-slate-400">{note.headings.length} 个小节</span>
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight text-slate-950 md:text-5xl">
            {note.title}
          </h1>
          {note.excerpt ? (
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{note.excerpt}</p>
          ) : null}
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
          <div className="note-article-body">
            <NoteMarkdown content={note.content} />
          </div>

          <aside className="note-outline lg:sticky lg:top-24">
            <p className="xhs-section-label">同类笔记</p>
            <nav className="mt-4 grid gap-2">
              {related.map((item) => (
                <Link key={item.slug} href={`/notes/${item.slug}`}>
                  {item.title}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      </article>
    </main>
  );
}
