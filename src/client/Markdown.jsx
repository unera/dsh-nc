/**
 * Markdown viewer: parsed into React elements, without HTML strings and without
 * `dangerouslySetInnerHTML` — no tags or scripts from the file can appear. Links
 * are additionally restricted to the http(s)/mailto schemes and relative paths.
 *
 * It supports what actually occurs in notes and READMEs: headings, paragraphs,
 * lists, quotes, code fences (with highlighting), tables, horizontal rules,
 * inline code, bold, italic, links and images.
 */

import { highlight, languageOf, TOKEN_COLORS } from './highlight.js'
import { rawUrl } from './api.js'

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(!?\[[^\]]*\]\([^)\s]+\))/g

/** Turn the inline markup of a line into an array of React elements. */
function inline(text, keyPrefix, file) {
  const nodes = []
  let lastIndex = 0
  let match = INLINE.exec(text)
  let index = 0
  while (match !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    const key = `${keyPrefix}-i${index}`
    index += 1
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} style={styles.code}>
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(
        <strong key={key}>{token.slice(2, -2)}</strong>,
      )
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else {
      const isImage = token.startsWith('!')
      const link = /^!?\[([^\]]*)\]\(([^)\s]+)\)$/.exec(token)
      if (link) {
        const [, label, target] = link
        const scheme = safeScheme(target)
        if (isImage) {
          if (scheme === null) {
            // An image with a disallowed scheme: show the caption instead of fetching the address.
            nodes.push(<span key={key}>{label || target}</span>)
          } else {
            nodes.push(
              <img key={key} src={resolveAsset(target, file)} alt={label} style={styles.image} />,
            )
          }
        } else if (scheme === null) {
          nodes.push(<span key={key}>{label || target}</span>)
        } else {
          nodes.push(
            <a key={key} href={resolveAsset(target, file)} target="_blank" rel="noreferrer" style={styles.link}>
              {label || target}
            </a>,
          )
        }
      } else {
        nodes.push(token)
      }
    }
    lastIndex = match.index + token.length
    match = INLINE.exec(text)
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

/**
 * Allowed link scheme: only http(s), mailto and relative paths.
 * `javascript:` and other schemes from a foreign file must not become a link.
 */
function safeScheme(target) {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(target)
  if (!match) return 'link'
  const protocol = match[1].toLowerCase()
  if (protocol === 'http' || protocol === 'https' || protocol === 'mailto') return 'link'
  if (protocol === 'data' && /^data:image\//i.test(target)) return 'image'
  return null
}

/** Turn a relative path from the document into a link to the file bytes. */
function resolveAsset(target, file) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target
  if (target.startsWith('/')) return target
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
  const joined = `${dir}/${target}`.replace(/\/\.\//g, '/')
  return rawUrl(joined)
}

/** The pieces of a code fence — highlighted when the language is known. */
function CodeBlock({ code, lang }) {
  const painted = highlight(code, lang === 'plain' ? 'plain' : lang)
  if (!painted) {
    return (
      <pre style={styles.pre}>
        <code>{code}</code>
      </pre>
    )
  }
  return (
    <pre style={styles.pre}>
      <code>
        {painted.map((line, number) => (
          <div key={number}>
            {line.length === 0
              ? '\u200b'
              : line.map((piece, index) => (
                  <span key={index} className={`tok-${piece.type}`}>
                    {piece.text}
                  </span>
                ))}
          </div>
        ))}
      </code>
    </pre>
  )
}

const styles = {
  root: { lineHeight: 1.6 },
  h: { margin: '0.8em 0 0.4em', fontWeight: 600 },
  p: { margin: '0.5em 0' },
  code: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    background: 'var(--dsw-alias-interactive-bg-hover, rgba(28,35,51,0.07))',
    padding: '1px 5px',
    borderRadius: 4,
    fontSize: '0.95em',
  },
  pre: {
    background: 'var(--dsw-alias-bg-layer-1, rgba(28,35,51,0.05))',
    border: '1px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.12))',
    borderRadius: 8,
    padding: '8px 10px',
    overflowX: 'auto',
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: '0.95em',
    lineHeight: 1.5,
    margin: '0.6em 0',
  },
  quote: {
    margin: '0.6em 0',
    padding: '2px 12px',
    borderLeft: '3px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.25))',
    color: 'var(--dsw-alias-label-secondary, #5a6478)',
  },
  list: { margin: '0.4em 0', paddingLeft: '1.6em' },
  link: { color: 'var(--dsw-alias-link, #2d66f7)', textDecoration: 'none' },
  image: { maxWidth: '100%', borderRadius: 6 },
  table: { borderCollapse: 'collapse', margin: '0.6em 0' },
  cell: { border: '1px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.14))', padding: '4px 8px' },
  hr: { border: 'none', borderTop: '1px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.14))', margin: '1em 0' },
}

/**
 * Parse Markdown into React elements.
 * @param props.text - source text of the document.
 * @param props.file - full path of the file (for relative images and links).
 */
export function MarkdownView({ text, file }) {
  const lines = text.split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    // Code fence.
    const fence = /^\s*```(\S*)\s*$/.exec(line)
    if (fence) {
      const lang = fence[1] ? languageOf(`x.${fence[1]}`) : 'plain'
      const collected = []
      index += 1
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        collected.push(lines[index])
        index += 1
      }
      index += 1
      blocks.push(<CodeBlock key={`code-${index}`} code={collected.join('\n')} lang={lang} />)
      continue
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const Tag = `h${level}`
      blocks.push(
        <Tag key={`h-${index}`} style={styles.h}>
          {inline(heading[2], `h${index}`, file)}
        </Tag>,
      )
      index += 1
      continue
    }

    // Horizontal rule.
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} style={styles.hr} />)
      index += 1
      continue
    }

    // Quote.
    if (/^\s*>/.test(line)) {
      const collected = []
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        collected.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      blocks.push(
        <blockquote key={`q-${index}`} style={styles.quote}>
          {inline(collected.join(' '), `q${index}`, file)}
        </blockquote>,
      )
      continue
    }

    // Table: a row with | and the next row is the separator.
    if (/\|/.test(line) && index + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[index + 1])) {
      const header = line.split('|').map((cell) => cell.trim()).filter(Boolean)
      index += 2
      const rows = []
      while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim() !== '') {
        rows.push(lines[index].split('|').map((cell) => cell.trim()).filter(Boolean))
        index += 1
      }
      blocks.push(
        <table key={`t-${index}`} style={styles.table}>
          <thead>
            <tr>
              {header.map((cell, position) => (
                <th key={position} style={styles.cell}>
                  {inline(cell, `th${index}-${position}`, file)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, position) => (
                  <td key={position} style={styles.cell}>
                    {inline(cell, `td${rowIndex}-${position}`, file)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }

    // List.
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const items = []
      while (index < lines.length && (/^\s*[-*+]\s+/.test(lines[index]) || /^\s*\d+[.)]\s+/.test(lines[index]))) {
        items.push(lines[index].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))
        index += 1
      }
      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag key={`l-${index}`} style={styles.list}>
          {items.map((item, position) => (
            <li key={position}>{inline(item, `li${index}-${position}`, file)}</li>
          ))}
        </ListTag>,
      )
      continue
    }

    // Empty line.
    if (line.trim() === '') {
      index += 1
      continue
    }

    // Paragraph: up to an empty line or the start of another block.
    const paragraph = []
    while (
      index < lines.length
      && lines[index].trim() !== ''
      && !/^\s*(?:#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s)/.test(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    if (paragraph.length === 0) {
      // The line matches nothing — emit it as is so that we do not loop.
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(
      <p key={`p-${index}`} style={styles.p}>
        {inline(paragraph.join('\n'), `p${index}`, file)}
      </p>,
    )
  }

  return <div style={styles.root}>{blocks}</div>
}
