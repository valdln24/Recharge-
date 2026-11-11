# Mettre Recharge en ligne (Cloudflare)

Recharge est maintenant un **projet Cloudflare Worker** :

- `public/` : le site et l'appli (comme avant) ;
- `worker/index.js` : le petit serveur (comptes, sauvegarde) ;
- `migrations/` : la structure de la base de données D1 ;
- `wrangler.jsonc` : la configuration (aucun secret dedans).

On ne dépose plus un dossier à la main : Cloudflare met le site à jour **tout seul à chaque modification sur GitHub**.

---

## Étape 1 · Créer la base de données (5 min, une seule fois)

1. Cloudflare › **Stockage et bases de données** › **D1** › **Créer une base de données**.
2. Nom : `recharge` › Créer.
3. Copiez l'**identifiant** (Database ID, une suite de lettres et de chiffres) et envoyez-le à Claude, ou remplacez la ligne `database_id` dans `wrangler.jsonc`.
4. Dans la base `recharge`, onglet **Console** : collez tout le contenu du fichier `migrations/0001_comptes.sql`, puis **Exécuter**.

## Étape 2 · Le compte d'envoi d'emails Resend (10 min, une seule fois)

1. Créez un compte gratuit sur resend.com.
2. **API Keys** › **Create API Key** (droit « Sending access ») › copiez la clé (elle commence par `re_`).
3. Pour envoyer à n'importe quelle adresse, il faut un **nom de domaine** à vous (ex. `recharge-vdi.fr`), ajouté dans **Domains** sur Resend. Sans domaine, Resend n'envoie qu'à **votre propre adresse** : parfait pour tester.
   [À COMPLÉTER : nom de domaine pour l'envoi des emails]

## Étape 3 · Brancher GitHub (5 min, une seule fois)

1. Cloudflare › **Workers et Pages** › votre Worker **recharge** › **Paramètres** › **Builds** › **Connecter** › choisissez le dépôt `Recharge-`.
2. Branche : celle que Claude vous indique.
3. Commande de déploiement : `npx wrangler deploy` (valeur proposée par défaut).
4. Enregistrez. Chaque modification poussée sur GitHub met le site à jour en 1 à 2 minutes.

## Étape 4 · Les secrets (2 min)

Cloudflare › **Workers et Pages** › **recharge** › **Paramètres** › **Variables et secrets** › **Ajouter** :

| Nom | Type | Valeur |
|---|---|---|
| `RESEND_API_KEY` | **Secret** | la clé Resend (`re_…`) |

Les autres réglages sont dans `wrangler.jsonc` (rien de secret) :

| Nom | Valeur | Rôle |
|---|---|---|
| `APP_ORIGIN` | `https://recharge.delaineval.workers.dev` | adresse du site, utilisée dans le lien envoyé par email |
| `EMAIL_FROM` | `Recharge <onboarding@resend.dev>` | expéditeur des emails. [À COMPLÉTER : votre adresse une fois le domaine validé] |
| `REQUIRE_PAID` | `false` | passera à `true` en phase 3 (sauvegarde réservée aux offres payantes) |
| `DEV_SHOW_LINK` | `false` | **toujours `false` en ligne** (sert seulement aux tests sur ordinateur) |

## Vérifier que tout marche

1. Ouvrez l'appli › **Menu** › **Passer à la version complète** › votre email.
2. Vous recevez un email « 123456 : votre code de connexion à Recharge ».
3. Tapez le code : « C'est fait ! Vos données sont sauvegardées sur votre compte ✅ ».

En cas de problème : Cloudflare › **recharge** › **Observabilité** › **Journaux** montre les erreurs du serveur.

---

## Pour un développeur

```bash
npm install
echo 'DEV_SHOW_LINK="true"' > .dev.vars          # le lien et le code s'affichent dans l'appli, sans email
npx wrangler d1 migrations apply recharge --local
npm run dev                                        # http://127.0.0.1:8765
```
