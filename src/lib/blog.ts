import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/routes';

// Articles live in src/content/blog/en/ and src/content/blog/ms/.
// A Malay article links to its English original with `translationKey: <english-file-name>`.
export type Post = { entry: CollectionEntry<'blog'>; lang: Lang; slug: string; key: string };

export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('blog', (p) => !p.data.draft);
  return all.map((entry) => {
    const [lang, ...rest] = entry.id.split('/');
    const slug = rest.join('/');
    return { entry, lang: lang as Lang, slug, key: entry.data.translationKey ?? slug };
  });
}

/** The same article in the other language, if it has been translated. */
export const translationOf = (posts: Post[], post: Post, lang: Lang) => posts.find((p) => p.lang === lang && p.key === post.key);
