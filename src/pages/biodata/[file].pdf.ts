// One biodata PDF per PUBLISHED maid and language, generated at build time from the same data as the profile pages.
// A maid who is unpublished, held back or withdrawn is not in getPublicMaids(), so she gets no PDF in the next build.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getPublicMaids, DEMO, REVIEW } from '../../lib/maids';
import { biodataName } from '../../lib/biodata';
import { buildBiodataPdf } from '../../lib/biodata-pdf';
import type { Lang } from '../../i18n/routes';

export const getStaticPaths = (async () => {
  if (DEMO || REVIEW) return [];   // never for demo or private-review builds
  const maids = await getPublicMaids();
  return maids.flatMap((m) => (['en', 'ms'] as Lang[]).map((lang) => ({ params: { file: biodataName(m.code, lang) }, props: { code: m.code, lang } })));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { code, lang } = props as { code: string; lang: Lang };
  const maid = (await getPublicMaids()).find((m) => m.code === code);
  if (!maid) return new Response('Not found', { status: 404 });
  const pdf = await buildBiodataPdf(maid, lang);
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf' } });
};
