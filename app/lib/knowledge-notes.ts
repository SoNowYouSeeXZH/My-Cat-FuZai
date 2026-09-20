import fs from "node:fs";
import path from "node:path";

export type KnowledgeCategory = {
  slug: string;
  label: string;
  description: string;
};

export type KnowledgeNote = {
  slug: string;
  title: string;
  excerpt: string;
  category: KnowledgeCategory;
  headings: string[];
  readingTime: string;
  content: string;
};

const NOTES_ROOT = path.join(process.cwd(), "content", "notes");

const CATEGORIES: KnowledgeCategory[] = [
  {
    slug: "ai-agent",
    label: "AI Agent",
    description: "LangGraph、工具调用与可恢复 Agent 的工程理解。",
  },
  {
    slug: "backend",
    label: "后端学习记录",
    description: "分层架构、鉴权、事务、缓存与部署的后端知识整理。",
  },
];

function readMarkdown(categorySlug: string, fileName: string) {
  return fs.readFileSync(path.join(NOTES_ROOT, categorySlug, fileName), "utf8");
}

function extractTitle(content: string, fallback: string) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function extractExcerpt(content: string) {
  const quoted = content.match(/^>\s+(.+)$/m);
  if (quoted && !/^对应迭代/.test(quoted[1].trim())) {
    return quoted[1].trim();
  }

  const lines = content.split("\n");
  const bodyStart = lines.findIndex((line) => line.startsWith("# "));
  for (const line of lines.slice(bodyStart + 1)) {
    const text = line.trim();
    if (!text || text.startsWith("#") || text.startsWith(">") || text.startsWith("-") || text.startsWith("|")) {
      continue;
    }
    return text.replace(/\*\*/g, "").replace(/`/g, "").slice(0, 90);
  }

  return "";
}

function extractHeadings(content: string) {
  return content
    .split("\n")
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, "").trim());
}

function estimateReadingTime(content: string) {
  const minutes = Math.max(1, Math.round(content.replace(/\s/g, "").length / 400));
  return `${minutes} 分钟`;
}

function loadNotes(): KnowledgeNote[] {
  return CATEGORIES.flatMap((category) => {
    const dir = path.join(NOTES_ROOT, category.slug);
    if (!fs.existsSync(dir)) {
      return [];
    }

    return fs
      .readdirSync(dir)
      .filter((fileName) => fileName.endsWith(".md") && fileName !== "README.md")
      .sort()
      .map((fileName) => {
        const slug = fileName.replace(/\.md$/, "");
        const content = readMarkdown(category.slug, fileName);

        return {
          slug,
          title: extractTitle(content, slug),
          excerpt: extractExcerpt(content),
          category,
          headings: extractHeadings(content),
          readingTime: estimateReadingTime(content),
          content,
        };
      });
  });
}

export const knowledgeNotes: KnowledgeNote[] = loadNotes();

export const knowledgeCategories = CATEGORIES.map((category) => ({
  ...category,
  notes: knowledgeNotes.filter((note) => note.category.slug === category.slug),
})).filter((category) => category.notes.length > 0);

export function getKnowledgeNote(slug: string) {
  return knowledgeNotes.find((note) => note.slug === slug);
}
