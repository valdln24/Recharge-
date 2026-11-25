# Skills de design installés dans Recharge

Installés le 24 nov. 2026 avec le CLI officiel `npx skills`, en copie locale au projet, dans `.claude/skills/`.
Les versions exactes (dépôt, commit, empreinte) sont notées dans `skills-lock.json`.
Pour tout réinstaller à l'identique : `npx skills experimental_install`. Pour mettre à jour : `npx skills update -p`.

Claude Code les détecte automatiquement à l'ouverture du projet. On peut les appeler par leur nom (ex. `/impeccable`).

## Règle d'or : l'identité Recharge passe avant tout skill

Chaque skill a ses goûts. Quand l'un d'eux contredit ces règles, **ce sont ces règles qui gagnent** :

- **Objectif :** un SaaS premium, moderne, minimaliste, élégant et professionnel. Mobile d'abord.
- **Police :** Manrope partout. On ne la remplace pas.
- **Couleurs de l'appli et du site :**
  - sable `#F4EFE8` en fond ;
  - encre `#1C1A22` pour le texte et les boutons ;
  - orange `#FF782E` pour l'accent et les actions ;
  - lavande `#7B83F6` en accent secondaire ;
  - rouge `#E5364B` pour les retards, vert `#35B879` pour ce qui va bien.
- **Vidéos :** fond bleu nuit `#08152E`, comme la vidéo 01.
- **Textes :** tout en français, ton simple et chaleureux, sans jargon. Le titre « Vos clients rachètent. Au bon moment. » ne change pas.
- **À éviter absolument :**
  - le look « généré par IA » ou template ;
  - les animations excessives ;
  - les dégradés sans raison ;
  - les composants répétitifs ;
  - les emojis dans les visuels de marque.
- **Priorités :** une expérience sans accroc, un design system cohérent, des animations fluides et brèves, la performance, le mobile, la finition.
- **Données :** pas de faux chiffres, pas de fausses fonctions. S'il manque une info : `[À COMPLÉTER : ...]`.
- **Méthode :** ne rien casser de ce qui marche ; on cache, on ne supprime pas.

## Les 8 skills

| Skill | Source | Rôle | Quand l'utiliser |
|---|---|---|---|
| **impeccable** | pbakaus/impeccable (déjà présent) | Méthode complète : critiquer, auditer, polir, animer une interface, tenir un DESIGN.md | Le point d'entrée pour tout travail de design sur l'appli ou le site |
| **frontend-design** | anthropics/skills | Direction artistique, typographie, éviter les choix « par défaut » | Créer un nouvel écran ou une nouvelle page, chercher une idée forte |
| **ui-ux-pro-max** | nextlevelbuilder/ui-ux-pro-max-skill | Base de données consultable : 141 règles UX, styles, palettes, graphiques, accessibilité | Vérifier une règle UX précise, choisir un type de graphique, contrôler l'accessibilité |
| **emil-design-eng** | emilkowalski/skills | Le détail qui rend une interface agréable : états d'appui et de survol, transitions, timing | Finir un composant (bouton, menu, feuille, toast) |
| **review-animations** *(ajouté en plus)* | emilkowalski/skills | Relecture critique des animations existantes, avec des standards précis | Avant de valider une animation de l'appli, du site ou d'une vidéo |
| **web-design-guidelines** | vercel-labs/agent-skills | Audit des pages par rapport aux règles d'interface de Vercel (accessibilité, formulaires, focus…) | Relecture finale d'une page avant de la mettre en ligne |
| **design-taste-frontend** | Leonxlnx/taste-skill | Anti « look IA » pour les pages vitrines, avec un contrôle dans un vrai navigateur | Page d'accueil et pages marketing du site, quand ça fait « template » |
| **vercel-react-best-practices** | vercel-labs/agent-skills | Performance React / Next.js | **Peu utile aujourd'hui :** Recharge est en HTML/JS sans React. À garder pour plus tard |

## Comment les combiner

1. **Nouvel écran de l'appli :**
   - `impeccable` pour la méthode et le contexte ;
   - `frontend-design` pour l'intention ;
   - `emil-design-eng` pour les détails d'interaction ;
   - `web-design-guidelines` pour l'audit final.
2. **Page du site :**
   - `impeccable` ;
   - `design-taste-frontend`, seulement pour sa critique anti-template et son contrôle final ;
   - `web-design-guidelines`.
3. **Animation (appli ou vidéo) :**
   - `emil-design-eng` pour décider ;
   - `review-animations` pour relire.
4. **Doute sur une règle UX ou d'accessibilité :** consulter `ui-ux-pro-max`, sans prendre ses palettes ni ses styles.
5. Toujours terminer par une vérification sur mobile (390 px de large) avec une capture.

## Conflits connus entre leurs consignes

- **frontend-design et notre palette.** Ce skill cite un fond crème avec un accent terracotta comme une « signature d'IA ». Le sable et l'orange de Recharge en sont proches, mais c'est notre identité, choisie et cohérente entre le site et l'appli : on la garde. On applique seulement son autre conseil : varier la hiérarchie des cartes plutôt que des cartes toutes identiques.
- **frontend-design et design-taste-frontend sur la typographie.** Les deux poussent à changer de police pour se démarquer. Non : Manrope reste.
- **design-taste-frontend et les visuels.** Il veut de vraies photos (y compris des photos d'illustration), des effets « shader » et un « moment » marquant par page. Pour Recharge :
  - pas de photos de banque d'images ;
  - pas d'effets shader ;
  - de vraies captures ou de vrais éléments de l'appli ;
  - une seule entrée animée sobre.
  Ses assets (40 Mo de photos et d'icônes) ne sont pas à utiliser sans accord.
- **ui-ux-pro-max et les palettes.** Il propose des palettes et des styles issus de sa base de données. On ne s'en sert pas pour l'identité, seulement pour les règles UX et d'accessibilité.
- **impeccable et emil-design-eng sur les animations.** Ils sont alignés : durées courtes (moins de 300 ms pour l'interface), courbes `ease-out`, jamais `ease-in` à l'apparition, et respect de `prefers-reduced-motion`. C'est la règle de Recharge.
- **vercel-react-best-practices.** Il ne s'applique pas au code actuel. Ne pas réécrire l'appli en React à cause de lui.
- **web-design-guidelines.** Il contient une copie des règles de Vercel. La mise à jour décrite dans le skill passe par `curl` vers GitHub : à faire seulement volontairement.

## Ce qui a été vérifié à l'installation

- Chaque dépôt et chaque `SKILL.md` a été lu avant l'installation. Aucun script n'installe de paquet ni ne télécharge de code caché.
- Les scripts de `ui-ux-pro-max` sont en Python 3, sans dépendance : la recherche a été testée et fonctionne.
- Les scripts de `design-taste-frontend` utilisent seulement Node et Playwright, déjà présents dans le projet.
- Chaque skill a un en-tête `name` et `description` valide, et Claude Code les liste bien dans ses skills disponibles.
- Aucune fonctionnalité de Recharge n'a été modifiée : seuls `.claude/skills/`, `skills-lock.json` et ce document ont été ajoutés.

### Skill étudié mais non installé

- **webapp-testing** (anthropics/skills) : il demande Playwright en Python, alors que le projet utilise Playwright pour Node.

---

# Skills marketing, acquisition et qualité (ajoutés le 25 nov. 2026)

Les skills marketing commencent par lire `.claude/product-marketing.md`. Ce fichier rassemble les faits réels de Recharge (prix, parcours, cible, règles de ton), sans aucun chiffre inventé. Il faut le tenir à jour.

| Skill | Source | Rôle pour Recharge |
|---|---|---|
| **copywriting** | coreyhaines31/marketingskills | Textes des pages : accueil, tarifs, équipe. Refuse les affirmations sans preuve |
| **cro** | coreyhaines31/marketingskills | Faire mieux convertir une page ou un formulaire (accueil, tarifs, /analyse) |
| **onboarding** | coreyhaines31/marketingskills | Premier usage de l'appli, « moment clé », écrans vides |
| **paywalls** | coreyhaines31/marketingskills | L'écran d'abonnement et le moment où on propose de payer |
| **pricing** | coreyhaines31/marketingskills | Prix, formules, essai, offre fondateur, Équipe au siège |
| **referrals** | coreyhaines31/marketingskills | Parrainage et bouche-à-oreille : le cœur du réseau en vente directe |
| **emails** | coreyhaines31/marketingskills | Séquences d'e-mails : bienvenue, fin d'essai, relance |
| **launch** | coreyhaines31/marketingskills | Préparer le lancement et l'accès anticipé |
| **seo-audit** | coreyhaines31/marketingskills | Référencement Google du site |
| **ai-seo** | coreyhaines31/marketingskills | Être cité par ChatGPT, Perplexity et les autres IA (avec le point 10 de la conformité : llms.txt) |
| **stop-slop** | hardikpandya/stop-slop | Retirer les tics d'écriture « IA » des textes. Il est pensé pour l'anglais : appliquer l'esprit en français |
| **verification-before-completion** | obra/superpowers | Interdit d'annoncer « c'est fait » sans preuve vérifiée : une règle de Recharge |

**Pour combiner :**
- **Une page :** `copywriting`, puis `stop-slop`, puis `cro`, puis `web-design-guidelines`.
- **Le parcours d'achat :** `onboarding`, puis `paywalls`, puis `pricing`.
- **Croissance :** `referrals` et `launch`.
- **Visibilité :** `seo-audit` et `ai-seo`.

**Conflits à surveiller :**
- Ces skills sont écrits pour des SaaS anglophones B2B : adapter au public français de la vente directe, au vouvoiement et au mobile.
- `paywalls` et `cro` poussent parfois l'urgence et la rareté. Chez Recharge, ce n'est permis qu'avec un compteur réel (les places fondateur), jamais avec un faux minuteur.
- Les recommandations de tests A/B demandent du trafic que Recharge n'a pas encore : les garder pour plus tard.

## Étudiés et non retenus (pour l'instant)

| Skill | Raison |
|---|---|
| ui-ux-pro-max via `uipro-cli` | Déjà installé (via `npx skills`) : ce serait un doublon |
| remotion-dev/skills | Les vidéos Recharge ont leur propre outil (HTML + Playwright + ffmpeg). Passer à Remotion obligerait à tout réécrire |
| Context Engineering (muratcankoylan) | Sert à concevoir des agents IA, pas le produit ni le marketing |
| sleek-design-mobile-apps | Pensé pour des applis natives iOS et Android. Recharge est une appli web, et impeccable, emil-design-eng et ui-ux-pro-max couvrent déjà le mobile |
| extract-design-system | Doublon d'impeccable, qui tient déjà un DESIGN.md |
| test-driven-development, playwright-best-practices, playwright-cli | Utiles pour les tests, mais hors du thème marketing. À ajouter si on monte une vraie suite de tests |
| polish, critique, bolder, delight, distill, quieter | Ce sont des commandes d'impeccable, déjà installé |
| autres skills de marketingskills (ads, cold-email, sms, influencer…) | Pas prioritaires sans budget publicitaire. Ils s'installent en une commande si besoin : `npx skills add coreyhaines31/marketingskills -s <nom> -a claude-code --copy -y` |
