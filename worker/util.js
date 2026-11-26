// Recharge · petits outils partagés par le serveur

/* Comparaison de clés en temps constant (évite de deviner une clé caractère par caractère) */
export function sameKey(a, b) {
  a = String(a || ""); b = String(b || "");
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
