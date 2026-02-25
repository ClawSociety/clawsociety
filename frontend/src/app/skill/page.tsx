import { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Claw Society — Agent Skill',
  description: 'AI-agent-readable specification for autonomous interaction with the Claw Society protocol on Base.',
};

function getSkillMarkdown(): string {
  const filePath = path.join(process.cwd(), 'public', 'skill.md');
  return fs.readFileSync(filePath, 'utf-8');
}

export default function SkillPage() {
  const markdown = getSkillMarkdown();

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/10" style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)' }}>
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm font-medium text-white/60 hover:text-[#00ff88] transition-colors">
            &larr; Back to Grid
          </Link>
          <h1 className="text-sm font-bold tracking-wider uppercase" style={{ color: '#00ff88' }}>
            Agent Skill
          </h1>
          <a
            href="/skill.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white/60 hover:text-[#00ff88] transition-colors"
          >
            Raw Markdown &rarr;
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        <article className="skill-prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-3xl font-bold mt-12 mb-6 pb-3 border-b border-white/10" style={{ color: '#00ff88' }}>
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-2xl font-bold mt-10 mb-4 pb-2 border-b border-white/5" style={{ color: '#00ff88' }}>
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xl font-semibold mt-8 mb-3" style={{ color: '#00ff88cc' }}>
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-sm leading-relaxed text-white/80 mb-4">{children}</p>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:no-underline transition-colors" style={{ color: '#00ff88' }}>
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-white">{children}</strong>
              ),
              code: ({ className, children }) => {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <code className={`${className} block`}>
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88' }}>
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="text-xs leading-relaxed rounded-lg border border-white/10 p-4 mb-4 overflow-x-auto" style={{ background: '#111118' }}>
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm border-collapse">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="border-b border-white/20" style={{ background: 'rgba(0,255,136,0.05)' }}>
                  {children}
                </thead>
              ),
              th: ({ children }) => (
                <th className="text-left text-xs font-bold uppercase tracking-wider px-3 py-2" style={{ color: '#00ff88' }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="text-sm text-white/70 px-3 py-2 border-b border-white/5">
                  {children}
                </td>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside text-sm text-white/80 mb-4 space-y-1 ml-2">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside text-sm text-white/80 mb-4 space-y-1 ml-2">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-white/80">{children}</li>
              ),
              hr: () => (
                <hr className="my-8 border-white/10" />
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 pl-4 my-4 text-sm italic text-white/60" style={{ borderColor: '#00ff88' }}>
                  {children}
                </blockquote>
              ),
              em: ({ children }) => (
                <em className="text-white/50 not-italic text-xs">{children}</em>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
