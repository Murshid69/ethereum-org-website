// import { execSync } from "child_process"
// import { createHash } from "crypto"
import fsSync, { type Dirent } from "fs"
import fs from "fs/promises"
import path from "path"

import { cache } from "react"
import matter from "gray-matter"
import readingTime from "reading-time"

import type { Frontmatter, Lang } from "@/lib/types"

import { DEFAULT_LOCALE } from "@/lib/constants"

import type { ContentFile } from "./types"

const CONTENT_DIR = path.join(process.cwd(), "public", "content")
const CACHE_TTL = process.env.NODE_ENV === "development" ? 30_000 : 60_000 // 30s dev, 60s prod

// Cache for git last modified dates to avoid repeated git calls
// const gitDateCache = new Map<string, string>()

/**
 * Get the last modified date of a file from git history.
 * Returns ISO date string or undefined if not available.
 */
// function getGitLastModified(filePath: string): string | undefined {
//   // Check cache first
//   const cached = gitDateCache.get(filePath)
//   if (cached) return cached

//   try {
//     // Get last commit date for this file in ISO format
//     const result = execSync(`git log -1 --format=%cI -- "${filePath}"`, {
//       encoding: "utf8",
//       cwd: process.cwd(),
//       stdio: ["pipe", "pipe", "pipe"],
//     }).trim()

//     if (result) {
//       gitDateCache.set(filePath, result)
//       return result
//     }
//   } catch {
//     // Git not available or file has no history
//   }

//   return undefined
// }

// Cache for git contributors to avoid repeated git calls
// const gitContributorsCache = new Map<
//   string,
//   { contributors: GitContributor[]; timestamp: number }
// >()

/**
 * Get contributors for a file from git history.
 * Returns array of contributors with commit counts, sorted by most commits.
 */
// function getGitContributors(filePath: string): GitContributor[] {
//   // Check cache first
//   const cached = gitContributorsCache.get(filePath)
//   if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
//     return cached.contributors
//   }

//   try {
//     // Get all commits for this file with author info
//     // Format: name<email>
//     const result = execSync(
//       `git log --format="%aN<%aE>" --follow -- "${filePath}"`,
//       {
//         encoding: "utf8",
//         cwd: process.cwd(),
//         stdio: ["pipe", "pipe", "pipe"],
//       }
//     ).trim()

//     if (!result) {
//       gitContributorsCache.set(filePath, {
//         contributors: [],
//         timestamp: Date.now(),
//       })
//       return []
//     }

//     // Count commits per contributor
//     const commitCounts = new Map<
//       string,
//       { name: string; email: string; commits: number }
//     >()
//     const lines = result.split("\n").filter(Boolean)

//     for (const line of lines) {
//       const match = line.match(/^(.+)<(.+)>$/)
//       if (match) {
//         const [, name, email] = match
//         const key = email.toLowerCase()
//         const existing = commitCounts.get(key)
//         if (existing) {
//           existing.commits++
//         } else {
//           commitCounts.set(key, { name, email, commits: 1 })
//         }
//       }
//     }

//     // Convert to array and sort by commit count
//     const contributors: GitContributor[] = Array.from(commitCounts.values())
//       .sort((a, b) => b.commits - a.commits)
//       .map(({ name, email, commits }) => ({
//         name,
//         email,
//         commits,
//         // Generate avatar URL: GitHub for noreply emails, Gravatar for others
//         avatarUrl: email.includes("@users.noreply.github.com")
//           ? `https://github.com/${email.split("@")[0].replace(/^\d+\+/, "")}.png`
//           : `https://www.gravatar.com/avatar/${createHash("md5").update(email.toLowerCase().trim()).digest("hex")}?d=identicon`,
//       }))

//     gitContributorsCache.set(filePath, {
//       contributors,
//       timestamp: Date.now(),
//     })

//     return contributors
//   } catch {
//     // Git not available or file has no history
//     gitContributorsCache.set(filePath, {
//       contributors: [],
//       timestamp: Date.now(),
//     })
//     return []
//   }
// }

// Cache for slugs to avoid re-scanning filesystem on every request
const slugsCache = new Map<string, { slugs: string[][]; timestamp: number }>()

// Translation registry: slug -> Set of locales that have this content
// Populated during getAllSlugs() scan for accurate hreflang generation
const translationRegistry = new Map<string, Set<Lang>>()

// Cache for content directory locale folders
let contentLocalesCache: string[] | null = null

function getContentLocales(): string[] {
  if (contentLocalesCache) {
    return contentLocalesCache
  }

  try {
    const entries = fsSync.readdirSync(CONTENT_DIR, { withFileTypes: true })
    contentLocalesCache = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    contentLocalesCache = []
  }

  return contentLocalesCache
}

// Cache for available locales per slug to avoid repeated filesystem scans
const availableLocalesCache = new Map<
  string,
  { locales: string[]; timestamp: number }
>()

/**
 * Get all locales that have content for a specific slug.
 * Scans the filesystem directly to ensure accurate results,
 * rather than relying on the registry which may be incomplete.
 */
export function getAvailableLocales(slugPath: string): Lang[] {
  // Check cache first
  const cached = availableLocalesCache.get(slugPath)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.locales as Lang[]
  }

  // Scan all locale directories in content folder for this specific slug
  const available: string[] = []
  const contentLocales = getContentLocales()

  for (const locale of contentLocales) {
    // English content is at root, translations are in translations/{locale}/
    const pathsToCheck =
      locale === DEFAULT_LOCALE
        ? [
            path.join(CONTENT_DIR, `${slugPath}.mdx`),
            path.join(CONTENT_DIR, `${slugPath}.md`),
            path.join(CONTENT_DIR, slugPath, "index.mdx"),
            path.join(CONTENT_DIR, slugPath, "index.md"),
          ]
        : [
            path.join(CONTENT_DIR, "translations", locale, `${slugPath}.mdx`),
            path.join(CONTENT_DIR, "translations", locale, `${slugPath}.md`),
            path.join(
              CONTENT_DIR,
              "translations",
              locale,
              slugPath,
              "index.mdx"
            ),
            path.join(
              CONTENT_DIR,
              "translations",
              locale,
              slugPath,
              "index.md"
            ),
          ]

    for (const filePath of pathsToCheck) {
      if (fsSync.existsSync(filePath)) {
        available.push(locale)
        break
      }
    }
  }

  // Cache the result
  availableLocalesCache.set(slugPath, {
    locales: available,
    timestamp: Date.now(),
  })

  return available as Lang[]
}

export function hasTranslation(slugPath: string, locale: Lang): boolean {
  return translationRegistry.get(slugPath)?.has(locale) ?? false
}

// Wrap with React cache() for request-level deduplication
// During static generation, generateMetadata() and the page component share the same render context
export const getContent = cache(async function getContent(
  locale: Lang,
  slug: string[]
): Promise<ContentFile | null> {
  const slugPath = slug.join("/")

  // Try locale-specific content first
  let result = await tryLoadContent(locale, slugPath)

  if (result) {
    return { ...result, isFallback: false }
  }

  // Fallback to default locale
  if (locale !== DEFAULT_LOCALE) {
    result = await tryLoadContent(DEFAULT_LOCALE, slugPath)
    if (result) {
      return {
        ...result,
        isFallback: true,
        fallbackLocale: DEFAULT_LOCALE,
      }
    }
  }

  return null
})

async function tryLoadContent(
  locale: string,
  slugPath: string
): Promise<Omit<ContentFile, "isFallback" | "fallbackLocale"> | null> {
  // Build list of paths to try: direct files first, then index files
  // English content is at root, translations are in translations/{locale}/
  const pathsToTry =
    locale === DEFAULT_LOCALE
      ? [
          path.join(CONTENT_DIR, `${slugPath}.mdx`),
          path.join(CONTENT_DIR, `${slugPath}.md`),
          path.join(CONTENT_DIR, slugPath, "index.mdx"),
          path.join(CONTENT_DIR, slugPath, "index.md"),
        ]
      : [
          path.join(CONTENT_DIR, "translations", locale, `${slugPath}.mdx`),
          path.join(CONTENT_DIR, "translations", locale, `${slugPath}.md`),
          path.join(CONTENT_DIR, "translations", locale, slugPath, "index.mdx"),
          path.join(CONTENT_DIR, "translations", locale, slugPath, "index.md"),
        ]

  for (const filePath of pathsToTry) {
    try {
      const raw = await fs.readFile(filePath, "utf8")
      const { data, content } = matter(raw)
      const stats = readingTime(content)
      const meta = {
        ...data,
        lang: data.lang || DEFAULT_LOCALE,
        // updatedAt: getGitLastModified(filePath) || "",
        updatedAt: "",
      } as Frontmatter

      // const contributors = getGitContributors(filePath)
      const contributors = []

      return {
        slug: slugPath,
        locale,
        meta,
        content,
        readingTime: Math.ceil(stats.minutes),
        contributors,
      }
    } catch {
      // File doesn't exist, try next path
    }
  }

  return null
}

export async function getAllSlugs(locale: Lang): Promise<string[][]> {
  // Check cache first
  const cacheKey = locale
  const cached = slugsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.slugs
  }

  // Scan the default locale content (root level, excluding translations folder)
  // All locales share the same slugs - translations just provide localized content
  const slugs: string[][] = []

  function scanDirectory(dir: string, slugPrefix: string[] = []): void {
    let entries: Dirent[]
    try {
      entries = fsSync.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const name = entry.name

      // Skip translations folder and hidden files
      if (name === "translations" || name.startsWith(".")) {
        continue
      }

      const fullPath = path.join(dir, name)

      if (entry.isDirectory()) {
        // Check for index file in this directory
        const hasIndex =
          fsSync.existsSync(path.join(fullPath, "index.mdx")) ||
          fsSync.existsSync(path.join(fullPath, "index.md"))

        if (hasIndex) {
          const slug = [...slugPrefix, name]
          slugs.push(slug)
          // Register this slug for the default locale
          const slugPath = slug.join("/")
          if (!translationRegistry.has(slugPath)) {
            translationRegistry.set(slugPath, new Set())
          }
          translationRegistry.get(slugPath)!.add(DEFAULT_LOCALE as Lang)
        }

        // Recurse into subdirectory
        scanDirectory(fullPath, [...slugPrefix, name])
      } else if (entry.isFile()) {
        // Check if it's an MDX or MD file (but not index files, handled above)
        const ext = path.extname(name)
        if ((ext === ".mdx" || ext === ".md") && !name.startsWith("index.")) {
          const baseName = path.basename(name, ext)
          const slug = [...slugPrefix, baseName]
          slugs.push(slug)
          // Register this slug for the default locale
          const slugPath = slug.join("/")
          if (!translationRegistry.has(slugPath)) {
            translationRegistry.set(slugPath, new Set())
          }
          translationRegistry.get(slugPath)!.add(DEFAULT_LOCALE as Lang)
        }
      }
    }
  }

  scanDirectory(CONTENT_DIR)

  // Cache the result
  slugsCache.set(cacheKey, { slugs, timestamp: Date.now() })

  return slugs
}
