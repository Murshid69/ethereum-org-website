import { slugify } from "@/lib/utils/url"

// RegEx patterns
const customIdRegEx = /^.+(\s*\{#([^}]+?)\}\s*)$/
const emojiRegEx = /<Emoji [^/]+\/>/g

/**
 * Parse a heading ID from a heading string. If the heading contains a custom ID,
 * it will be used as the ID, otherwise the heading will be slugified and used.
 * @param heading Heading string without leading #s that may contain a {#custom-id}
 * @returns Heading ID string
 */
export const parseHeadingId = (heading: string): string => {
  const match = customIdRegEx.exec(heading)
  return match ? match[2].toLowerCase() : slugify(heading)
}

/**
 * Removes any custom ID and Emoji components from a heading string
 * @param title Heading string, not yet trimmed
 * @returns Trimmed heading string
 */
export const trimmedTitle = (title: string): string => {
  const match = customIdRegEx.exec(title)
  const trimmedTitle = match ? title.replace(match[1], "").trim() : title

  // Removes Twemoji components from title
  const emojiMatch = emojiRegEx.exec(trimmedTitle)
  return emojiMatch ? trimmedTitle.replaceAll(emojiRegEx, "") : trimmedTitle
}

export interface TocItem {
  id: string
  text: string
  level: number
}

/**
 * Extracts headings from markdown content for Table of Contents.
 * Only extracts h2 and h3 headings (level 2 and 3).
 * Generates IDs from heading text to match rehype-slug behavior.
 */
export function extractTableOfContents(content: string): TocItem[] {
  const headingRegex = /^(#{2,3})\s+(.+?)(?:\s*\{#[^}]+\})?$/gm
  const items: TocItem[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    // Generate ID matching rehype-slug behavior
    const id = generateSlug(text)

    items.push({ id, text, level })
  }

  return items
}

/**
 * Generates a slug from text, matching rehype-slug behavior.
 * Converts to lowercase, replaces spaces with hyphens, removes special chars.
 */
function generateSlug(text: string): string {
  return (
    text
      .toLowerCase()
      // Remove inline code backticks and their content markers
      .replace(/`[^`]+`/g, (match) => match.slice(1, -1))
      // Remove markdown links but keep link text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Replace special characters and spaces with hyphens
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
  )
}
