// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { hydrateReadAttachments } from './readAttachments'

const HASH = 'a'.repeat(64)

function mountedRoot(html: string): HTMLDivElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.append(root)
  return root
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('hydrateReadAttachments', () => {
  it('resolves a private ref into a stable figure before showing it', async () => {
    const root = mountedRoot(
      `<p><img src="attachment:${HASH}.jpg?size=s" alt="A quiet morning"></p>`,
    )
    const resolve = vi.fn().mockResolvedValue({
      url: 'https://example.test/photo.jpg',
      meta: { width: 1080, height: 1920, color: '#8a7966' },
    })

    hydrateReadAttachments(root, `![A quiet morning](attachment:${HASH}.jpg?size=s)`, { resolve })
    const figure = root.querySelector<HTMLElement>('.pg-read1__photo')!
    const img = root.querySelector<HTMLImageElement>('.pg-read1__photo-img')!

    expect(figure.classList).toContain('pg-read1__photo--size-s')
    expect(img.hasAttribute('src')).toBe(false)

    await vi.waitFor(() => expect(img.src).toBe('https://example.test/photo.jpg'))
    expect(img.width).toBe(1080)
    expect(img.height).toBe(1920)
    expect(figure.classList).toContain('pg-read1__photo--crop-h')
    expect(figure.querySelector('figcaption')?.textContent).toBe('A quiet morning')

    img.dispatchEvent(new Event('load'))
    expect(figure.dataset.ready).toBe('true')
    expect(figure.dataset.loading).toBeUndefined()
  })

  it('leaves ordinary web images untouched', () => {
    const root = mountedRoot('<p><img src="https://example.test/public.jpg" alt="Public"></p>')
    const resolve = vi.fn()
    hydrateReadAttachments(root, '![Public](https://example.test/public.jpg)', { resolve })
    expect(resolve).not.toHaveBeenCalled()
    expect(root.querySelector('figure')).toBeNull()
  })

  it('ignores a late result after the reader has changed pages', async () => {
    let settle!: (value: { url: string | null; meta: null }) => void
    const pending = new Promise<{ url: string | null; meta: null }>((resolve) => {
      settle = resolve
    })
    const root = mountedRoot(`<p><img src="attachment:${HASH}.png" alt=""></p>`)
    const cancel = hydrateReadAttachments(root, `![](attachment:${HASH}.png)`, {
      resolve: () => pending,
    })
    const img = root.querySelector<HTMLImageElement>('img')!

    cancel()
    settle({ url: 'https://example.test/late.png', meta: null })
    await pending
    await Promise.resolve()

    expect(img.hasAttribute('src')).toBe(false)
  })

  it('fails quietly when an attachment is unavailable', async () => {
    const root = mountedRoot(`<p><img src="attachment:${HASH}.webp" alt=""></p>`)
    hydrateReadAttachments(root, `![](attachment:${HASH}.webp)`, {
      resolve: async () => ({ url: null, meta: null }),
    })

    await vi.waitFor(() =>
      expect(root.querySelector<HTMLElement>('.pg-read1__photo')?.dataset.error).toBe('true'),
    )
    expect(root.textContent).not.toContain('attachment:')
  })

  it('recovers refs whose private scheme DOMPurify removed', async () => {
    const root = mountedRoot('<p><img alt="Morning light"></p>')
    hydrateReadAttachments(
      root,
      `![Morning light](attachment:${HASH}.jpg?size=f)`,
      {
        resolve: async () => ({
          url: 'blob:resolved-photo',
          meta: { width: 1200, height: 800 },
        }),
      },
    )

    await vi.waitFor(() =>
      expect(root.querySelector<HTMLImageElement>('.pg-read1__photo-img')?.src).toBe(
        'blob:resolved-photo',
      ),
    )
    expect(root.querySelector('.pg-read1__photo--size-f')).not.toBeNull()
  })
})
