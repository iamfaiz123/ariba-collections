// After `vite build`: write dist/<route>/index.html for every public route with that page's
// title, meta, Open Graph and JSON-LD in <head> and a plain-HTML snapshot of its content in #root.
// Also writes dist/sitemap.xml and dist/robots.txt.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const dist = join(process.cwd(), 'dist');
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });

try {
  const { buildPages, sitemapXml, robotsTxt } = await server.ssrLoadModule('/src/seo/prerender.ts');
  const template = await readFile(join(dist, 'index.html'), 'utf8');
  if (!template.includes('<!--seo:start-->') || !template.includes('<!--app-->')) throw new Error('index.html is missing the <!--seo:start--> / <!--app--> markers');

  const pages = buildPages();
  for (const page of pages) {
    const html = template
      .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, page.head)
      .replace('<!--app-->', page.body);
    const file = page.path === '/' ? join(dist, 'index.html') : join(dist, page.path, 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  }
  // Fallback for app-only routes (cart, checkout, order…) served through the SPA rewrite: generic, noindex.
  const fallback = template
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, '<title>Aribas</title>\n    <meta name="robots" content="noindex, follow" data-seo />')
    .replace('<!--app-->', '');
  await writeFile(join(dist, '200.html'), fallback);

  await writeFile(join(dist, 'sitemap.xml'), sitemapXml(new Date().toISOString().slice(0, 10)));
  await writeFile(join(dist, 'robots.txt'), robotsTxt());
  console.log(`prerendered ${pages.length} pages + sitemap.xml + robots.txt`);
} finally {
  await server.close();
}
