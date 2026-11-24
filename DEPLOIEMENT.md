# Mettre Recharge en ligne (Cloudflare)

Recharge est maintenant un **projet Cloudflare Worker** :

- `public/` : le site et l'appli (comme avant) ;
- `worker/index.js` : le petit serveur (comptes, sauvegarde) ;
- `migrations/` : la structure de la base des comptes (créée automatiquement) ;
- `wrangler.jsonc` : la configuration (aucun secret dedans).

On ne dépose plus un dossier à la main : Cloudflare met le site à jour **tout seul à chaque modification sur GitHub**.

---

## Étape 1 · La base de données : rien à faire
Les comptes, les sauvegardes et les abonnements sont rangés dans un stockage Cloudflare (Durable Object) **créé automatiquement** à la mise en ligne. Une base D1 reste possible (facultatif) : dans ce cas, décommentez `d1_databases` dans `wrangler.jsonc` et appliquez `migrations/0001_comptes.sql` puis `migrations/0002_abonnement.sql`.

## Étape 2 · Le compte d'envoi d'emails Resend (10 min, une seule fois)

1. Créez un compte gratuit sur resend.com.
2. **API Keys** › **Create API Key** (droit « Sending access ») › copiez la clé (elle commence par `re_`).
3. Pour envoyer à n'importe quelle adresse, il faut un **nom de domaine** à vous (ex. `recharge-vdi.fr`), ajouté dans **Domains** sur Resend. Sans domaine, Resend n'envoie qu'à **votre propre adresse** : parfait pour tester.
   Domaine d'envoi : getrecharge.fr

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
| `APP_ORIGIN` | `https://getrecharge.fr` | adresse publique du site : liens de parrainage, d'équipe et du Playbook. Le lien de connexion et le retour de paiement renvoient vers l'adresse où la vendeuse se trouve déjà |
| `EMAIL_FROM` | `Recharge <bonjour@getrecharge.fr>` | expéditeur des emails (domaine validé dans Resend) |
| `REQUIRE_PAID` | `true` | la sauvegarde en ligne est réservée aux abonnées |
| `DEV_SHOW_LINK` | `false` | **toujours `false` en ligne** (sert seulement aux tests sur ordinateur) |

## Activer le coach IA (10 min, une seule fois)
Le chat du coach (questions et captures d'écran) utilise l'IA d'Anthropic. Sans clé, l'appli affiche « Le coach IA sera bientôt activé » et tout le reste fonctionne.
1. Créez un compte sur **console.anthropic.com**, ajoutez un moyen de paiement, puis **API Keys › Create Key**. Copiez la clé.
2. Dans Cloudflare : **Workers & Pages › recharge › Settings › Variables and Secrets › Add**.
3. Type **Secret**, nom **ANTHROPIC_API_KEY**, valeur : la clé. Enregistrez (« Deploy »).
4. Vérifiez : `https://getrecharge.fr/api/health` doit afficher `"coach":true`.

Limite intégrée : 30 questions par heure et par connexion, pour éviter les abus. Conseil : fixez aussi une limite de dépense mensuelle dans la console Anthropic (Limits).

## Activer le paiement Stripe (15 min, une seule fois)
L'abonnement (9,90 €/mois ou 99 €/an, 14 jours d'essai) se paie sur la page sécurisée de Stripe. Recharge ne voit jamais la carte bancaire. Pas de produit à créer : les prix sont envoyés par Recharge.
1. Créez un compte sur **dashboard.stripe.com** et complétez les informations de votre entreprise (obligatoire pour encaisser).
2. Pour tester d'abord : activez le **mode test**, puis **Développeurs › Clés API** : copiez la **clé secrète** (`sk_test_…`). Carte de test : `4242 4242 4242 4242`, date future, n'importe quel code.
3. **Paramètres › Facturation › Portail client** : cliquez **Activer** (sert à « Gérer mon abonnement » : factures, carte, résiliation).
4. Dans Cloudflare : **Workers & Pages › recharge › Settings › Variables and Secrets › Add** : type **Secret**, nom **STRIPE_SECRET_KEY**, valeur : la clé.
5. Vérifiez : `/api/health` doit afficher `"billing":true`.
6. Quand tout marche en test : refaites les étapes 2 à 4 en **mode réel** (`sk_live_…`), en remplaçant la valeur du secret.

Pas de webhook à configurer : l'état de l'abonnement (actif, résilié) est revérifié chez Stripe au plus toutes les 12 h.

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

## Adresse getrecharge.fr (déménagement depuis recharge.delaineval.workers.dev)
- **Domaines branchés sur le Worker `recharge`** (Cloudflare › Workers & Pages › recharge › Settings › Domains & Routes) : `getrecharge.fr` (adresse publique), `www.getrecharge.fr` et `api.getrecharge.fr` (alias). Le site, l'appli et l'API sont servis ensemble, à la même adresse : il n'y a pas de CORS, c'est voulu.
- **Ne pas désactiver `recharge.delaineval.workers.dev`** ni le rediriger : les vendeuses y ont encore leurs clients, gardés dans leur navigateur. Sur cette ancienne adresse, l'appli affiche un bandeau « Recharge a une nouvelle adresse » et un bouton « Emporter mes clients » qui copie leurs données vers getrecharge.fr, sans rien effacer ni passer par le serveur.
- **Emails** : une fois `getrecharge.fr` validé dans Resend (enregistrements DNS), `EMAIL_FROM` = `Recharge <bonjour@getrecharge.fr>`. Pour recevoir les réponses, activer Cloudflare › getrecharge.fr › Email › Email Routing et faire suivre bonjour@ vers votre boîte personnelle.
- **Stripe** : aucun webhook. Si une adresse de site est renseignée dans le tableau de bord Stripe (portail client, informations publiques), la remplacer par https://getrecharge.fr.
