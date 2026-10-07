// Small HTML to Markdown walker for the prerendered page body. It keeps headings, paragraphs, lists,
// tables, links and definition lists, and drops controls, maps, scripts and edibility badges.
import { load } from 'cheerio'

const SKIP = 'script, style, svg, button, select, input, textarea, canvas, iframe, noscript, nav, .edibility-badge, .species-hero-badges, .species-map, .map-loading'

export function htmlToMarkdown(html, base) {
  const $ = load(html)
  const main = $('main').first().length ? $('main').first() : $('body')
  main.find(SKIP).remove()
  const out = []

  function inline(node) {
    let text = ''
    $(node).contents().each((index, child) => {
      if (child.type === 'text') text += child.data.replace(/\s+/g, ' ')
      else if (child.type === 'tag') {
        const tag = child.tagName
        if (tag === 'a') {
          const label = inline(child).trim()
          const href = $(child).attr('href')
          text += label && href && !href.startsWith('#') ? `[${label}](${new URL(href, base).href})` : label
        } else if (tag === 'strong' || tag === 'b') text += `**${inline(child).trim()}**`
        else if (tag === 'em' || tag === 'i') text += `*${inline(child).trim()}*`
        else if (tag === 'br') text += '\n'
        else if (tag === 'img') text += $(child).attr('alt') ? `(image: ${$(child).attr('alt')})` : ''
        else text += inline(child)
      }
    })
    return text
  }

  function block(node, depth = 0) {
    $(node).children().each((index, child) => {
      const tag = child.tagName
      if (/^h[1-6]$/.test(tag)) { const text = inline(child).trim(); if (text) out.push(`${'#'.repeat(Number(tag[1]))} ${text}`) }
      else if (tag === 'p') { const text = inline(child).trim(); if (text) out.push(text) }
      else if (tag === 'ul' || tag === 'ol') {
        const lines = []
        $(child).children('li').each((i, li) => {
          const text = inline($(li).clone().children('ul, ol').remove().end()).trim()
          if (text) lines.push(`${'  '.repeat(depth)}${tag === 'ol' ? `${i + 1}.` : '-'} ${text}`)
        })
        if (lines.length) out.push(lines.join('\n'))
      } else if (tag === 'table') {
        const rows = $(child).find('tr').toArray().map(tr => $(tr).children('th, td').toArray().map(cell => inline(cell).trim().replaceAll('|', '/')))
        if (rows.length) out.push([`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`, ...rows.slice(1).map(row => `| ${row.join(' | ')} |`)].join('\n'))
      } else if (tag === 'dl') {
        const lines = []
        $(child).children().each((i, item) => { const text = inline(item).trim(); if (text) lines.push(item.tagName === 'dt' ? `**${text}**` : text) })
        out.push(lines.join('\n'))
      } else if (tag === 'blockquote') { const text = inline(child).trim(); if (text) out.push(`> ${text}`) }
      else if (tag === 'li' || tag === 'span' || tag === 'label' || tag === 'time' || tag === 'strong') { const text = inline(child).trim(); if (text) out.push(text) }
      else if ($(child).children().length === 0) { const text = inline(child).trim(); if (text) out.push(text) }
      else block(child, depth)
    })
  }

  block(main)
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}
