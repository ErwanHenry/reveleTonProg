import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { scriptsEnLigne } from './src/lib/csp-empreintes.ts';
import { loadSiteConfig } from './src/lib/site-config.ts';

// Racine du projet en chemin système (fileURLToPath, jamais `.pathname` : un dossier avec une espace casserait).
const racine = fileURLToPath(new URL('.', import.meta.url));
// Domaine déclaré une seule fois dans config/site.yml (HEB-05, ADR-053). Sous RTP_DEPLOIEMENT=1, un domaine
// ou un contact provisoire (.invalid) fait échouer le chargement de cette configuration, donc la build (HEB-06).
const { domaine } = loadSiteConfig(racine);

export default defineConfig({
  site: `https://${domaine}`,
  output: 'static',
  compressHTML: true,
  prefetch: false,
  trailingSlash: 'always',
  // CSS et scripts dans chaque page (PERF-01, ADR-056 qui remplace l'ADR-037) : une requête de moins en Slow 4G.
  // Le CSS passe en <style> haché par Astro ; les deux scripts sont inclus par `?raw` + <script is:inline>.
  build: { inlineStylesheets: 'always' },
  // Limite d'inlining des assets à zéro : sans elle, Vite transforme les petits fichiers en URI `data:`
  // (un script `data:` est refusé par SCRIPT_DATA_URI de check-dist, et `data:` n'est jamais permis par la CSP).
  vite: { build: { assetsInlineLimit: 0 } },
  image: { service: { entrypoint: 'astro/assets/services/noop' } },
  devToolbar: { enabled: false },
  // CSP en <meta> par page (D-07, option A) : Astro hache les <style> ; il ne hache pas les <script is:inline>,
  // d'où les empreintes calculées par node:crypto sur src/scripts/*.js. Aucun mot-clé « unsafe-* » (check-dist CSP_TROP_PERMISSIVE).
  // Le meta est émis en fin de <head>, après le script d'ordre : il ne le couvre pas (l'en-tête HTTP rendu pour
  // Caddy le couvre). Après une modification d'un script, redémarrer `astro dev` (empreinte calculée au démarrage).
  security: {
    csp: {
      directives: ["default-src 'none'", "img-src 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"],
      scriptDirective: { hashes: scriptsEnLigne(racine).map((s) => s.empreinte) },
    },
  },
});
