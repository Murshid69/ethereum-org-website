import { notFound } from "next/navigation"
import {
  // getMessages,
  // getTranslations,
  setRequestLocale,
} from "next-intl/server"
import { MDXRemote, MDXRemoteProps } from "next-mdx-remote/rsc"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"

import type { Lang, Layout, SlugPageParams } from "@/lib/types"

import I18nProvider from "@/components/I18nProvider"
import mdComponents from "@/components/MdComponents"

import { dateToString } from "@/lib/utils/date"
import { getLayoutFromSlug } from "@/lib/utils/layout"

// import { extractTableOfContents } from "@/lib/utils/toc"
// import { getRequiredNamespacesForPage } from "@/lib/utils/translations"
import { routing } from "@/i18n/routing"
// import SlugJsonLD from "./page-jsonld"
import { componentsMapping, layoutMapping } from "@/layouts"
// import { getMdMetadata } from "@/lib/md/metadata"
import { getAllSlugs, getContent } from "@/lib/mdx"

/**
 * Preprocesses MDX content to handle custom heading IDs.
 * Converts `# Heading {#custom-id}` to `# Heading` with an anchor
 * since MDX parses {#...} as invalid JSX expressions.
 */
function preprocessMdxContent(content: string): string {
  // Strip custom heading IDs: `# Title {#custom-id}` -> `# Title`
  // Also handles IDs in the middle: `# Title {#id} more text` -> `# Title more text`
  // Let rehype-slug generate IDs from the heading text
  return content.replace(/\{#[^}]+\}/g, "")
}

function createLayoutMDXComponents(
  layout: Layout
): MDXRemoteProps["components"] {
  // @ts-expect-error - TODO: Fix this type error
  return {
    ...mdComponents,
    ...(layout ? componentsMapping[layout] : {}),
  }
}

export default async function Page({ params }: { params: SlugPageParams }) {
  const { locale, slug } = params

  setRequestLocale(locale)

  const content = await getContent(locale as Lang, slug)

  if (!content) {
    notFound()
  }

  // Determine the actual layout after we have the frontmatter
  const layout = content.meta.template || getLayoutFromSlug(slug.join("/"))
  const Layout = layoutMapping[layout]
  // const tableOfContents = extractTableOfContents(content.content)

  // If the page has a published date, format it
  if ("publishedAt" in content.meta) {
    content.meta.publishedAt = dateToString(
      content.meta.publishedAt as string | Date
    )
  }

  // Get i18n messages
  // const allMessages = await getMessages({ locale })
  // const requiredNamespaces = getRequiredNamespacesForPage(
  //   slug.join("/"),
  //   layout
  // )
  // const messages = pick(allMessages, requiredNamespaces)

  return (
    <>
      {/* <SlugJsonLD
        locale={locale}
        slug={slug}
        frontmatter={content.meta}
        contributors={contributors}
      /> */}
      <I18nProvider locale={locale} messages={{}}>
        <Layout
          slug={slug.join("/")}
          frontmatter={content.meta}
          tocItems={[]}
          lastEditLocaleTimestamp={content.meta.updatedAt}
          contentNotTranslated={!content.isFallback}
          contributors={content.contributors.map((contributor) => ({
            login: contributor.name,
            avatar_url: contributor.avatarUrl || "",
            html_url: "",
            date: "",
          }))}
          timeToRead={content.readingTime}
        >
          <MDXRemote
            source={preprocessMdxContent(content.content)}
            components={createLayoutMDXComponents(layout)}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [rehypeSlug],
              },
              scope: {
                // Provide variables used in MDX content
                gfissues: [], // Good first issues - fetched dynamically by IssuesList
              },
            }}
          />
        </Layout>
      </I18nProvider>
    </>
  )
}

export async function generateStaticParams() {
  const params: { locale: string; slug: string[] }[] = []

  for (const locale of routing.locales) {
    const slugs = await getAllSlugs(locale as Lang)

    for (const slug of slugs) {
      params.push({ locale, slug })
    }
  }

  return params
}

// export async function generateMetadata({ params }: { params: SlugPageParams }) {
//   const { locale, slug } = params

//   try {
//     return await getMdMetadata({
//       locale,
//       slug,
//     })
//   } catch (error) {
//     const t = await getTranslations({ locale, namespace: "common" })

//     // Return basic metadata for invalid paths
//     return {
//       title: t("page-not-found"),
//       description: t("page-not-found-description"),
//     }
//   }
// }
