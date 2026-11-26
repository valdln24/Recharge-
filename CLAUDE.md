# Recharge · consignes pour Claude

Recharge (getrecharge.fr) : appli web pour vendeuses et vendeurs à domicile (VDI). Promesse : « Vos clients rachètent. Au bon moment. »
Fondateur : Valentin. Lancement public le 1er décembre 2026.

## Règles permanentes (à respecter sans exception)
- Réponses en français, courtes, chaleureuses, pensées mobile d'abord. Écriture neutre (vendeuses et vendeurs).
- Aucun secret (clés Stripe, Resend, Anthropic…) dans le code ni dans le chat : ce sont des secrets Cloudflare. Ne jamais demander une clé dans le chat.
- Ne jamais demander ni stocker les identifiants du back-office d'une marque.
- Ne rien inventer : écrire [À COMPLÉTER : …]. Pas de faux chiffres ; toute estimation est présentée comme telle.
- « On cache, on ne supprime pas » (fonctions et pages).
- L'email personnel du fondateur est privé : jamais dans le code ni dans une requête externe. L'accès admin passe par le secret Cloudflare ADMIN_EMAILS.
- Pas de nouveaux emojis système dans l'interface (ceux déjà présents restent).
- Ne pas lancer de Skills automatiquement.

## Git et mise en ligne
- On travaille sur la branche `claude/conformite`. Commit + push à chaque étape terminée.
- La branche publiée est `claude/recharge-v0` (Cloudflare déploie depuis elle).
- Ne JAMAIS fusionner ni pousser sur `claude/recharge-v0` sans que Valentin écrive « mets en ligne ».
- Messages de commit en français, terminés par les lignes d'attribution demandées par la session.

## Technique
- Cloudflare Worker + fichiers statiques (`public/`), API dans `worker/` (index.js, billing.js, coach.js, importer.js, digest.js, reminders.js, admin.js, store.js).
- Comptes dans un Durable Object SQLite (`worker/store.js`, migrations `migrations/*.sql`).
- L'appli tient dans `public/app/index.html` (état `S`, `render()`, `actions`, `openSheet`). `?demo` = données d'exemple.
- Paiement Stripe (prix fixés côté serveur dans `TIERS`, `worker/billing.js`), emails Resend, coach IA Anthropic.
- Tests : `npx wrangler dev --local --port 8787 --var DEV_SHOW_LINK:true` puis Playwright. Vérif build : `npx wrangler deploy --dry-run`.
- Sécurité : voir SECURITE.md (14 attaques vérifiées, en-têtes dans `public/_headers`).

## Où on en est (26/11/2026)
- En ligne : jour 1, email du matin, pause d'abonnement, ergonomie simplifiée, sécurité, email de bienvenue après abonnement.
- Prix en ligne : Pro 14,90 €/mois ; à l'année « 2 mois offerts » (Pro 149 €/an, fondateur 11,90 €/mois ou 119 €/an ; Starter 9,90 / 99, fondateur 5,90 / 59 ; Équipe 9,90 / 99 par personne, fondateur 7,90 / 79).
- Côté Valentin : ajout de l'activité Recharge en micro-entreprise sur son SIRET (message à Fiska d'abord), limites des codes promo Stripe, blocage du site par SFR à signaler, publier les 3 posts Instagram et les bannières.
