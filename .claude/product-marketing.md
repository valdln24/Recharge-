# Contexte produit et marketing : Recharge

Fichier lu automatiquement par les skills marketing (copywriting, cro, onboarding, paywalls, pricing, referrals, seo-audit, ai-seo, launch, emails).
Il ne contient que des faits tirés du code et du site. Ce qui n'est pas connu est marqué [À COMPLÉTER].

## Le produit
- **Nom :** Recharge.
- **Site :** https://getrecharge.fr. **Appli web :** /app, mobile d'abord, installable sur l'écran d'accueil.
- **En une phrase (site) :** « Recharge calcule quand chaque client arrive au bout de son produit et prépare votre message de relance WhatsApp. Pour les pros de la vente directe, toutes marques. »
- **Titre du site, à ne pas changer :** « Vos clients rachètent. Au bon moment. »
- **Le fonctionnement réel :**
  - on note une vente (client, produit, quantité) ;
  - Recharge estime la date de fin du produit ;
  - le client apparaît dans « Mon plan du jour » quand il faut le relancer ;
  - un bouton ouvre WhatsApp avec le message prêt.
- **Autres espaces de l'appli et du site :**
  - fiche client : historique, ressenti, coordonnées ;
  - carte de fidélité, recommandations et contacts donnés par les clients ;
  - prospects, coach, équipe, statistiques ;
  - analyse gratuite (/analyse) et Playbook de la vente directe (/playbook).

## Pour qui
- **Cible :** les vendeuses et vendeurs indépendants en vente directe, toutes marques (par exemple aloe vera, compléments, cosmétiques), surtout sur mobile et WhatsApp.
- **Têtes de réseau :** une offre Équipe, à partir de 5 personnes.
- **Langue :** le français, pour un marché en France. [À COMPLÉTER : autres pays francophones visés ?]
- **Histoire du fondateur (site) :** « J'ai grandi dans la vente directe. » [À COMPLÉTER : détails validés à réutiliser]

## Prix (tirés de worker/billing.js)

| Offre | Mensuel | Annuel | Prix fondateur mensuel | Prix fondateur annuel |
|---|---|---|---|---|
| Starter | 9,90 € / mois | 89 € / an | 5,90 € / mois | 59 € / an |
| Pro | 19,90 € / mois | 179 € / an | 11,90 € / mois | 119 € / an |
| Équipe | 9,90 € / mois et par personne | 89 € / an et par personne | 7,90 € / mois et par personne | 71 € / an et par personne |

- **Équipe :** 5 personnes minimum. Chacun paie sa part et rejoint l'équipe avec un code.
- **Prix fondateur :** réservé aux 50 premiers (compteur réel sur le site), conservé tant que l'abonnement continue.
- **Essai :** 14 jours, puis paiement par Stripe.
- **Parrainage :** des mois offerts sont prévus dans le code (`ref_months`). [À COMPLÉTER : règle exacte affichée aux utilisateurs]
- **Version gratuite :** existe (« Continuer en version gratuite »). [À COMPLÉTER : limites exactes]

## Parcours de conversion actuel
1. Analyse gratuite.
2. Écran « ce que Recharge vous rend » : estimation basée sur les réponses de l'utilisateur, jamais un chiffre inventé.
3. Paywall : Apple Pay, Google Pay, carte, et frise de l'essai.
4. Onboarding.

## Voix et règles
- **Ton :** tout en français, simple et chaleureux, sans jargon. Vouvoiement sur le site. Dans l'appli, l'utilisateur choisit le tu ou le vous pour ses messages.
- **Interdits :**
  - les faux chiffres et les témoignages inventés ;
  - les promesses de résultat ;
  - le mot « gratuit » s'il n'est pas vrai ;
  - les comparatifs nommés sans preuve.
- **S'il manque une info :** [À COMPLÉTER : ...].
- **Identité visuelle :** voir docs/skills-design.md (Manrope ; sable, encre, orange #FF782E, lavande ; bleu nuit pour les vidéos ; aucun emoji dans les visuels de marque).

## Preuves disponibles
- [À COMPLÉTER : nombre réel d'utilisateurs, témoignages réels avec accord, résultats mesurés]. Aucun pour l'instant : ne rien affirmer.

## Concurrents et alternatives
- **Ce que font les gens aujourd'hui :** le carnet papier, les notes du téléphone, la mémoire, les groupes WhatsApp. C'est le « désordre » montré dans la vidéo 01.
- [À COMPLÉTER : outils concurrents nommés, seulement avec une base objective]

## Learnings
- [À COMPLÉTER au fil des tests : angles déjà essayés et résultats]
