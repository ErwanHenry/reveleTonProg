import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  compressHTML: true,
  prefetch: false,
  trailingSlash: 'always',
  // Feuilles de style et scripts toujours externes (fichiers hachés dans /_astro/) : la politique CSP
  // du lot 3 pourra interdire 'unsafe-inline'. Une limite d'inlining à zéro empêche aussi tout `data:` URI.
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
  image: { service: { entrypoint: 'astro/assets/services/noop' } },
  devToolbar: { enabled: false },
});
