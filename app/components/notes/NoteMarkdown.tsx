import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function NoteMarkdown({ content }: { content: string }) {
  return (
    <div className="note-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
