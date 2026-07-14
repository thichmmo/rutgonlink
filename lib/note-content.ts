export interface TextBlock {
  type: 'text'
  content: string
}

export interface TableBlock {
  type: 'table'
  rows: string[][]
}

export type NoteBlock = TextBlock | TableBlock

/**
 * Parse note content string into blocks.
 * Legacy plain text is wrapped in a single text block.
 */
export function parseNoteContent(content: string): NoteBlock[] {
  if (!content) return [{ type: 'text', content: '' }]
  try {
    const parsed = JSON.parse(content)
    if (parsed?.blocks && Array.isArray(parsed.blocks)) {
      return parsed.blocks
    }
  } catch {
    // Legacy plain text
  }
  return [{ type: 'text', content }]
}

/**
 * Serialize blocks to a JSON string for storage.
 */
export function serializeNoteContent(blocks: NoteBlock[]): string {
  return JSON.stringify({ blocks })
}

/**
 * Extract readable text from content (plain text or JSON blocks) for preview.
 */
export function getContentPreview(content: string, maxLength = 100): string {
  const blocks = parseNoteContent(content)
  let text = ''
  for (const block of blocks) {
    if (block.type === 'text') {
      text += block.content + ' '
    } else if (block.type === 'table') {
      for (const row of block.rows) {
        text += row.join(' | ') + ' '
      }
    }
    if (text.length >= maxLength) break
  }
  return text.trim().slice(0, maxLength)
}
