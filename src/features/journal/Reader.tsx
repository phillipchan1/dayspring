import { useMemo } from 'react'
import { renderMarkdown } from '@/lib/markdown'

interface Props {
  markdown: string
  createdAt?: string | undefined
}

/** Clean, read-only rendered view of an entry (no editing chrome). */
export function Reader({ markdown, createdAt }: Props) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown])

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <article className="markdown-body">
        {createdAt && (
          <div
            style={{
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              marginBottom: '1.5rem',
            }}
          >
            {new Date(createdAt).toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        )}
        {markdown.trim() ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p style={{ color: 'var(--text-faint)' }}>This entry is empty.</p>
        )}
      </article>
    </div>
  )
}
