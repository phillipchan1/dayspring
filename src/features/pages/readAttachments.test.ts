// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderMarkdown } from '@/lib/markdown'
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

  it('puts the circumstance line on the first uncaptioned photo', async () => {
    const root = mountedRoot(`<p><img src="attachment:${HASH}.jpg" alt=""></p>`)
    hydrateReadAttachments(
      root,
      `![](attachment:${HASH}.jpg)`,
      {
        resolve: async () => ({
          url: 'https://example.test/photo.jpg',
          meta: { takenAt: '2026-01-14T13:14:00.000Z' },
        }),
      },
      { verso: 'early morning · Denver · light snow, 28°' },
    )

    await vi.waitFor(() =>
      expect(root.querySelector('.pg-read1__photo-meta')?.textContent).toBe(
        'early morning · Denver · light snow, 28°',
      ),
    )
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

describe('hydrateReadAttachments: a set', () => {
  const B = 'b'.repeat(64)
  const C = 'c'.repeat(64)
  const resolve = async (hash: string) => ({
    url: `https://example.test/${hash[0]}.jpg`,
    meta: { width: 1200, height: 900, takenAt: `2026-09-20T07:0${hash === HASH ? 2 : 8}:00` },
  })

  it('draws a paragraph of touching photos as one figure, in order', async () => {
    // What `![](a)\n![](b)\n![](c)` renders as: one paragraph, a <br> per newline.
    const root = mountedRoot(
      `<p>Before</p><p><img src="attachment:${HASH}.jpg" alt=""><br>` +
        `<img src="attachment:${B}.jpg" alt="The steps"><br>` +
        `<img src="attachment:${C}.jpg" alt=""></p><p>After</p>`,
    )
    hydrateReadAttachments(root, '', { resolve })

    const set = root.querySelector<HTMLElement>('.pg-read1__photoset')!
    expect(root.querySelectorAll('.pg-read1__photoset')).toHaveLength(1)
    expect(root.querySelector('.pg-read1__photo')).toBeNull()
    expect(set.previousElementSibling?.textContent).toBe('Before')
    expect(set.nextElementSibling?.textContent).toBe('After')
    expect(set.querySelectorAll('.pg-read1__photoset-tile')).toHaveLength(3)
    expect(set.querySelector('br')).toBeNull()

    await vi.waitFor(() =>
      expect(
        [...set.querySelectorAll<HTMLImageElement>('.pg-read1__photoset-img')].map((img) => img.src),
      ).toEqual([
        'https://example.test/a.jpg',
        'https://example.test/b.jpg',
        'https://example.test/c.jpg',
      ]),
    )
    expect(set.querySelector('.pg-read1__photoset-caption')?.textContent).toBe('The steps')
    expect(set.querySelector('.pg-read1__photoset-meta')?.textContent).toMatch(/^3 photos · /)
  })

  it('recovers each photo of a set after DOMPurify removed the private scheme', async () => {
    const root = mountedRoot('<p><img alt=""><br><img alt=""></p>')
    hydrateReadAttachments(root, `![](attachment:${HASH}.jpg)\n![](attachment:${B}.jpg)`, { resolve })
    await vi.waitFor(() =>
      expect(
        [...root.querySelectorAll<HTMLImageElement>('.pg-read1__photoset-img')].map((img) => img.src),
      ).toEqual(['https://example.test/a.jpg', 'https://example.test/b.jpg']),
    )
  })

  // The whole way, from the stored text: a set is a set in the reader whatever
  // it was written against, because the editor draws it as one either way.
  it.each([
    ['set apart', `Title\n\nText\n\n![](attachment:${HASH}.jpg)\n![](attachment:${B}.jpg)\n\nAfter`],
    ['under a line of writing', `Title\n\nText\n![](attachment:${HASH}.jpg)\n![](attachment:${B}.jpg)\n\nAfter`],
    ['over a line of writing', `Title\n\n![](attachment:${HASH}.jpg)\n![](attachment:${B}.jpg)\nAfter`],
    ['under a list item', `Title\n\n- item\n![](attachment:${HASH}.jpg)\n![](attachment:${B}.jpg)`],
    ['on the first line', `![](attachment:${HASH}.jpg)\n![](attachment:${B}.jpg)\n\nAfter`],
  ])('draws a set written %s as one figure', (_, markdown) => {
    const root = mountedRoot(renderMarkdown(markdown, { asTitle: true }))
    hydrateReadAttachments(root, markdown, { resolve })
    expect(root.querySelectorAll('.pg-read1__photoset')).toHaveLength(1)
    expect(root.querySelectorAll('.pg-read1__photoset-tile')).toHaveLength(2)
    expect(root.querySelector('.pg-read1__photo')).toBeNull()
  })

  it('keeps photos apart when a blank line stood between them', () => {
    const root = mountedRoot(
      `<p><img src="attachment:${HASH}.jpg" alt=""></p><p><img src="attachment:${B}.jpg" alt=""></p>`,
    )
    hydrateReadAttachments(root, '', { resolve })
    expect(root.querySelector('.pg-read1__photoset')).toBeNull()
    expect(root.querySelectorAll('.pg-read1__photo')).toHaveLength(2)
  })

  it('leaves photos in a sentence as they were', () => {
    const root = mountedRoot(
      `<p>Look: <img src="attachment:${HASH}.jpg" alt=""> and <img src="attachment:${B}.jpg" alt=""></p>`,
    )
    hydrateReadAttachments(root, '', { resolve })
    expect(root.querySelector('.pg-read1__photoset')).toBeNull()
    expect(root.querySelectorAll('.pg-read1__photo')).toHaveLength(2)
  })

  it('opens the viewer on the photo that was tapped, with its set', async () => {
    const root = mountedRoot(
      `<p><img src="attachment:${HASH}.jpg" alt=""><br><img src="attachment:${B}.jpg" alt="The steps"></p>` +
        `<p><img src="attachment:${C}.jpg" alt=""></p>`,
    )
    const onLook = vi.fn()
    hydrateReadAttachments(root, '', { resolve }, { onLook })
    await vi.waitFor(() =>
      expect(root.querySelector<HTMLImageElement>('.pg-read1__photo-img')?.src).toBe(
        'https://example.test/c.jpg',
      ),
    )

    const tiles = root.querySelectorAll<HTMLElement>('.pg-read1__photoset-tile')
    expect(tiles[1]!.getAttribute('role')).toBe('button')
    tiles[1]!.click()
    const [photos, index] = onLook.mock.calls[0]!
    expect(index).toBe(1)
    expect(photos.map((p: { url: string; caption: string }) => [p.url, p.caption])).toEqual([
      ['https://example.test/a.jpg', ''],
      ['https://example.test/b.jpg', 'The steps'],
    ])

    // A lone photo opens alone.
    root.querySelector<HTMLElement>('.pg-read1__photo-media')!.click()
    expect(onLook.mock.calls[1]![0]).toHaveLength(1)
    expect(onLook.mock.calls[1]![0][0].url).toBe('https://example.test/c.jpg')
  })

  it('leaves photos inert when nothing is listening for a look', () => {
    const root = mountedRoot(
      `<p><img src="attachment:${HASH}.jpg" alt=""><br><img src="attachment:${B}.jpg" alt=""></p>`,
    )
    hydrateReadAttachments(root, '', { resolve })
    expect(root.querySelector('[role="button"]')).toBeNull()
  })

  it('puts the circumstance line under a set that opens the page', async () => {
    const root = mountedRoot(
      `<p><img src="attachment:${HASH}.jpg" alt=""><br><img src="attachment:${B}.jpg" alt=""></p>`,
    )
    hydrateReadAttachments(root, '', { resolve }, { verso: 'early morning · Denver' })
    await vi.waitFor(() =>
      expect(root.querySelector('.pg-read1__photoset-meta')?.textContent).toBe('early morning · Denver'),
    )
  })
})
