// Faux exécutable claude (phase 10.3, plan 03) : aucun appel au vrai binaire, aucun réseau, aucun identifiant.
//
// Un script sh POSIX (0755) dans un dossier temporaire. Chaque appel : numéroté, scénario correspondant servi sur la
// sortie standard (le dernier scénario est répété au-delà), journal des arguments et des NOMS des variables
// d'environnement (jamais leurs valeurs), plus « jeton_attendu=oui|non » en comparant la variable du secret à la
// valeur attendue passée à la création. `--version` répond sans consommer de scénario. L'entrée standard est lue puis
// jetée, sauf option garderEntree (un fichier privé par appel, pour les tests de prompt).
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface ScenarioClaude {
  stdout: string;
  code?: number;
  /** Le faux claude dort ce nombre de secondes avant de répondre (test du délai). */
  dormirS?: number;
}

export interface OptionsFauxClaude {
  secretAttendu?: { nom: string; valeur: string };
  garderEntree?: boolean;
}

export interface AppelClaude {
  args: string[];
  envNoms: string[];
  jetonAttendu: boolean;
}

export interface FauxClaude {
  chemin: string;
  journal(): AppelClaude[];
  entrees(): string[];
  detruire(): void;
}

const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

export function creerFauxClaude(scenarios: ScenarioClaude[], o: OptionsFauxClaude = {}): FauxClaude {
  if (scenarios.length === 0) throw new Error('au moins un scénario attendu');
  const racine = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-faux-claude-')));
  const sc = path.join(racine, 'scenarios');
  const appels = path.join(racine, 'appels');
  mkdirSync(sc);
  mkdirSync(appels);
  scenarios.forEach((s, i) => {
    const n = String(i).padStart(3, '0');
    writeFileSync(path.join(sc, `${n}.out`), s.stdout);
    writeFileSync(path.join(sc, `${n}.code`), String(s.code ?? 0));
    writeFileSync(path.join(sc, `${n}.sleep`), String(s.dormirS ?? 0));
  });
  const dernier = String(scenarios.length - 1).padStart(3, '0');
  const secret = o.secretAttendu;
  const script = `#!/bin/sh
SC=${quote(sc)}
AP=${quote(appels)}
if [ "$1" = "--version" ]; then
  printf '2.1.105 (Claude Code)\\n'
  exit 0
fi
N=$(ls "$AP" | wc -l | tr -d ' ')
I=$(printf '%03d' "$N")
mkdir "$AP/$I"
printf '%s\\0' "$@" > "$AP/$I/args"
env | sed -n 's/^\\([A-Za-z_][A-Za-z0-9_]*\\)=.*/\\1/p' > "$AP/$I/env"
${
  secret === undefined
    ? `printf 'non\\n' > "$AP/$I/jeton"`
    : `if [ "$(printenv ${quote(secret.nom)})" = ${quote(secret.valeur)} ]; then printf 'oui\\n' > "$AP/$I/jeton"; else printf 'non\\n' > "$AP/$I/jeton"; fi`
}
${o.garderEntree === true ? `cat > "$AP/$I/entree"` : 'cat > /dev/null'}
S="$SC/$I"
[ -f "$S.out" ] || S="$SC/${dernier}"
SLEEP=$(cat "$S.sleep")
[ "$SLEEP" -gt 0 ] && sleep "$SLEEP"
cat "$S.out"
exit "$(cat "$S.code")"
`;
  const chemin = path.join(racine, 'claude');
  writeFileSync(chemin, script);
  chmodSync(chemin, 0o755);

  const dossiersAppels = (): string[] => readdirSync(appels).sort();
  return {
    chemin,
    journal: () =>
      dossiersAppels().map((d) => ({
        args: readFileSync(path.join(appels, d, 'args'), 'utf8').split('\0').slice(0, -1),
        envNoms: readFileSync(path.join(appels, d, 'env'), 'utf8').split('\n').filter((l) => l !== ''),
        jetonAttendu: readFileSync(path.join(appels, d, 'jeton'), 'utf8').trim() === 'oui',
      })),
    entrees: () =>
      dossiersAppels().map((d) => {
        try {
          return readFileSync(path.join(appels, d, 'entree'), 'utf8');
        } catch {
          return '';
        }
      }),
    detruire: () => rmSync(racine, { recursive: true, force: true }),
  };
}
