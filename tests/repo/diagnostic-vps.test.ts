// HEB-03 : le script de diagnostic du VPS reste en lecture seule (Phase 6).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = fs.readFileSync(path.join(ROOT, 'ops/diagnostic-vps.sh'), 'utf8');
// Code seulement : commentaires et lignes vides retirés.
const code = script
  .split('\n')
  .map((l) => l.replace(/(^|\s)#.*$/, ''))
  .filter((l) => l.trim() !== '')
  .join('\n');

describe('ops/diagnostic-vps.sh (lecture seule)', () => {
  it('ne contient aucune commande qui modifie la machine', () => {
    const interdits: [RegExp, string][] = [
      [/\b(rm|mv|cp|dd|truncate|shred|mkfs\w*|mount|umount|chmod|chown|chattr|ln|touch|mkdir|rmdir|tee|install)\b/, 'commande de fichier'],
      [/\bsed\s+-i\b/, 'sed -i'],
      [/\bsystemctl\s+(start|stop|restart|reload|enable|disable|mask|kill|daemon-reload)\b/, 'systemctl qui agit'],
      [/\b(apt|apt-get|dpkg|snap)\s+(install|remove|purge|upgrade|update|full-upgrade|autoremove|-i)\b/, 'gestionnaire de paquets qui agit'],
      [/\bdocker\s+(rm|rmi|stop|kill|run|exec|prune|system\s+prune|volume\s+rm|start|restart|compose)\b/, 'docker qui agit'],
      [/\bcaddy\s+(reload|start|stop|run|fmt\s+--overwrite|trust|untrust)\b/, 'caddy qui agit'],
      [/\b(kill|pkill|killall|reboot|shutdown|poweroff|halt|crontab\s+-[er]|ufw\s+(allow|deny|enable|disable|delete|reset)|journalctl\s+--vacuum\w*)\b/, 'action système'],
      [/\b(curl|wget|nc|scp|sftp|ssh)\b/, 'réseau sortant'],
      [/\bsudo\b/, 'sudo'],
    ];
    for (const [re, quoi] of interdits) assert.doesNotMatch(code, re, `${quoi} interdit dans le diagnostic`);
  });

  it("ne redirige la sortie que vers /dev/null (aucune écriture de fichier)", () => {
    const redirections = code.match(/\d?>>?\s*[^\s&|)]+/g) ?? [];
    for (const r of redirections) assert.match(r, /^\d?>>?\s*\/dev\/null$/, `redirection interdite : ${r}`);
  });

  it("dit que le rapport brut ne va pas dans le dépôt public", () => {
    assert.match(script, /ne va jamais dans le dépôt public/);
  });
});
