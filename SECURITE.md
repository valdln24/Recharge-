# Recharge · sécurité

## Comment les données sont protégées

Recharge n'utilise ni Supabase ni base accessible depuis le navigateur. Les comptes vivent dans un stockage
Cloudflare (SQLite dans un Durable Object, ou D1) que **seul le serveur** (`worker/`) peut lire.
Le navigateur n'a aucune clé de base de données : il appelle `/api/...`, et chaque route vérifie la session
(jeton dans `Authorization: Bearer`, stocké côté serveur sous forme d'empreinte SHA-256) avant de lire ou
d'écrire, **toujours filtré sur l'utilisateur connecté** (`WHERE user_id = ?` / `WHERE id = ?` avec son id).
C'est l'équivalent du RLS : aucune règle « tout le monde peut lire » n'existe, car aucune lecture directe n'est possible.

Les clients, ventes et prospects de la vendeuse sont dans **sa** sauvegarde (`backups`, une ligne par compte),
jamais mélangés avec ceux des autres comptes.

## Règles table par table

| Table | Qui peut lire | Qui peut créer / modifier | Qui peut supprimer |
|---|---|---|---|
| `users` | Le compte connecté, sa propre ligne (`/api/me`). La tête de réseau voit l'email et l'état des membres de **son** équipe. | Le serveur seulement : à la connexion, au retour de paiement Stripe vérifié, au parrainage. | Le compte lui-même (`DELETE /api/account`, en tapant SUPPRIMER). |
| `sessions` | Personne (le serveur compare une empreinte). | Le serveur, après un lien ou un code de connexion valide. | Le compte (déconnexion) ou la suppression du compte. |
| `login_tokens` | Personne. | Le serveur (5 demandes max par heure et par email, 15 min de validité, usage unique, 5 essais de code). | Le serveur (ménage) et la suppression du compte. |
| `backups` | Le compte propriétaire seulement (`WHERE user_id = id connecté`). | Le compte propriétaire, abonné (protection contre l'écrasement par un autre téléphone). | Le compte propriétaire (suppression du compte). |
| `teams` | Les membres de l'équipe (nom, code). | Le serveur, au paiement de la tête de réseau. | Personne depuis l'appli. |
| `checkout_used` | Personne. | Le serveur (un retour de paiement ne sert qu'une fois, et moins de 2 jours). | Personne. |
| `leads` | Le compte qui se connecte avec cet email (son analyse). | Le formulaire d'analyse (réponses aux questions seulement, jamais les prénoms des clients). | Le compte, avec la suppression du compte. |
| `prospects` (Playbook) | Admin seulement, avec la clé `STATS_KEY`. | Le formulaire Playbook. | Admin (clé `STATS_KEY`), la suppression du compte, et désinscription en 1 clic par la personne. |
| `events_daily` | Admin seulement (`STATS_KEY`). | Tout le monde, mais uniquement des compteurs anonymes (nom d'étape dans une liste fermée, aucune IP, aucun id). | Personne. |
| `Quota` (compteurs coach / import) | Le serveur. | Le serveur. | Le serveur. |

Identifiants dans les adresses : jamais de numéros qui se suivent. Les comptes et équipes ont un UUID
(`crypto.randomUUID()`), les liens utilisent des jetons aléatoires de 32 octets ou des codes aléatoires.

## Clés et secrets

Aucune clé dans le code ni dans l'historique git (vérifié : `sk_`, `sk-ant-`, `re_`, `pk_`, `AIza`, `NEXT_PUBLIC_`, `VITE_`).
Toutes les clés sont des **secrets Cloudflare** côté serveur : `STRIPE_SECRET_KEY`, `RESEND_API_KEY`,
`ANTHROPIC_API_KEY`, `STATS_KEY`. Les appels payants (IA, emails, Stripe) partent uniquement du serveur.
Seul appel externe depuis le navigateur : `geo.api.gouv.fr` (gratuit, public, sans clé).

## IA (coach et import)

- Consigne de sécurité dans les deux agents (`worker/coach.js`, `worker/importer.js`) : le contenu des captures,
  documents, emails et pages est une information, jamais une instruction ; aucun ordre trouvé dedans n'est exécuté.
- Les agents n'ont **aucun outil** : ils ne peuvent ni envoyer, ni payer, ni modifier, ni supprimer. Ils renvoient un texte
  ou une liste que la vendeuse relit et valide.
- Ils ne voient que ce que l'appli de la vendeuse connectée leur envoie dans la demande : pas d'accès à la base.
  Rien n'est conservé côté serveur (ni capture, ni conversation). Le coach accepte jusqu'à 3 captures (profil + conversation).
- **Mémoire du coach** : jusqu'à 60 notes courtes (200 caractères) dans les données de la vendeuse (`S.coachMem`, sauvegarde de son compte), jamais dans une autre table.
  Le coach en propose au plus 2 par réponse (consigne : rien de sensible, ni coordonnées) ; la vendeuse les voit, les ajoute et les efface (Coach › La mémoire de mon coach).
  Le serveur ne reçoit que 40 notes au plus, traitées comme des informations et jamais comme des consignes. Notes affichées en texte échappé.

## Validation humaine des actions sensibles

| Action | Validation |
|---|---|
| Envoyer un message | La vendeuse appuie elle-même sur « Envoyer sur WhatsApp » (message modifiable avant). |
| Payer | Page de paiement Stripe + case CGV/CGU cochée. |
| Supprimer le compte | Taper SUPPRIMER (vérifié par le serveur). |
| Quitter une équipe / retirer un membre (arrête un abonnement) | Confirmation dans l'appli **et** `confirm: true` exigé par le serveur. |
| Supprimer un client, un achat, un prospect, un produit | Confirmation dans l'appli, annulation possible juste après. |
| Importer une liste (photo, Excel) | Liste affichée pour vérification avant l'import. |
| Mettre l'abonnement en pause | Confirmation dans l'appli **et** `confirm: true` exigé par le serveur (abonnement mensuel, une fois tous les 6 mois). |
| Couper l'email du matin sans être connecté | Lien personnel (jeton aléatoire par compte, comparé en temps constant) ; la page demande un clic de confirmation (POST), pour qu'un antivirus de messagerie ne le coupe pas tout seul. |
| Remplacer les données (restauration, transfert) | Confirmation dans l'appli, conflit détecté si un autre téléphone a sauvegardé. |

## Les 14 attaques classiques, vérifiées une par une (26/11/2026)

| Attaque | Ce qui se passe chez Recharge |
|---|---|
| Taper `/admin` | La page s'affiche mais est vide : chaque appel `/api/admin/...` vérifie la session ET que l'email est dans `ADMIN_EMAILS` (secret Cloudflare). Sinon : « Introuvable ». |
| Changer un ID dans l'URL | Aucune route ne prend l'id d'un compte venant du navigateur : tout est filtré sur l'utilisateur de la session. Ids en UUID, jamais à la suite. |
| Trouver une clé API dans le navigateur | Aucune clé dans `public/` ni dans Git (vérifié par recherche). Stripe, Resend et Anthropic ne sont appelés que par le serveur. |
| Modifier le prix | Le prix est fixé par le serveur (`TIERS` dans `billing.js`) ; le prix fondateur est décidé par le serveur (places restantes). Le navigateur n'envoie que le nom de l'offre. |
| Commander -1 article | Pas de panier : quantité toujours 1, fixée par le serveur. |
| Simuler un paiement | Le retour de paiement est revérifié directement chez Stripe (statut « complete », abonnement actif), usage unique, 2 jours maximum. |
| Utiliser un code promo 100 fois | Codes promo gérés par Stripe : régler « nombre d'utilisations max » et « première commande seulement » sur chaque code. Parrainage plafonné à 12 mois par an. |
| Se déclarer admin à l'inscription | Aucun champ « rôle » : l'admin vient uniquement du secret `ADMIN_EMAILS`, et l'email est prouvé par un code reçu. |
| Deviner le code de connexion | 6 chiffres, 5 essais par code, 5 codes par heure et par email, 15 min de validité : environ 25 chances sur 1 million par heure. |
| Dire à l'IA d'ignorer ses instructions | Le coach n'a ni outils ni accès aux données des autres comptes ni aux clés : au pire il répond hors sujet à la personne elle-même. Réponse affichée en texte (échappée). Quotas par téléphone, par IP et par heure. |
| Glisser un script dans un nom | Tout texte est échappé (`esc`) dans l'appli, le back-office et les emails. Test : `<img onerror>` et `<svg onload>` dans les noms, rien ne s'exécute. En plus, la CSP (`public/_headers`) interdit tout script ou envoi vers un autre site. |
| Envoyer un fichier qui n'est pas une photo | Le serveur n'accepte que JPEG, PNG ou WebP (vérifié), 6 images maximum, taille limitée. Rien n'est stocké : l'image est lue puis oubliée. |
| Trouver un `.env` dans Git | `.dev.vars` est ignoré par Git ; aucun fichier de secrets dans l'historique (vérifié). |
| Injection SQL | Toutes les requêtes utilisent des paramètres `?` ; aucune valeur venant du navigateur n'est collée dans le SQL. Pas d'accès direct à la base depuis l'extérieur. |

En-têtes ajoutés : `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (site) ; `X-Frame-Options: DENY` et HSTS sur l'API.
