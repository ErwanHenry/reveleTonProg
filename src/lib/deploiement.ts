// Lecture stricte de RTP_DEPLOIEMENT (IN-06), partagée par les gardes de déploiement (config/site.yml,
// config/hebergeur.yml) et le CLI check-dist. « 1 » : contrôle avant déploiement. Absente, vide ou « 0 » :
// hors déploiement. Toute autre valeur (true, yes, oui…) est refusée au lieu d'être lue comme « non » :
// une faute de frappe dans le job de déploiement ne doit pas désactiver les gardes en silence.
export class DeploiementInvalideError extends Error {}

/** Vrai pour RTP_DEPLOIEMENT=1, faux si absente, vide ou 0 ; lève DeploiementInvalideError pour toute autre valeur. */
export function estDeploiement(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.RTP_DEPLOIEMENT;
  if (v === undefined || v === '' || v === '0') return false;
  if (v === '1') return true;
  throw new DeploiementInvalideError(`RTP_DEPLOIEMENT doit valoir 1 (déploiement), 0 ou rester vide ; reçu « ${v.slice(0, 20)} »`);
}
