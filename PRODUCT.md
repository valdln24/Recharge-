# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Vendeuses et vendeurs à domicile en France (VDI, vente directe : cosmétiques, bien-être, maison). Surtout des femmes, souvent peu à l'aise avec la technique, qui travaillent depuis leur téléphone entre deux réunions, deux trajets ou le soir. Persona de référence : « Sandrine, 46 ans, conseillère VDI, iPhone, enregistre ses ventes entre deux rendez-vous ». Audience secondaire : les animatrices d'équipe (offre Équipe), qui suivent plusieurs vendeuses.

## Product Purpose

Recharge dit chaque jour à la vendeuse quelle cliente recontacter, parce que son produit arrive à sa fin, et lui prépare le message. Le succès : la vendeuse enregistre ses ventes (le plus grand risque est qu'elle ne le fasse pas) et ses clientes rachètent au bon moment.

## Positioning

« Vos clients rachètent. Au bon moment. » Le rythme de rachat est appris client par client et produit par produit (rythme de la cliente, sinon rythme appris, sinon durée du produit), avec relance 5 jours avant la fin. Aucun outil de marque ni CRM générique ne prépare la relance du jour, message compris, à partir d'un carnet photographié.

## Operating Context

Saisie en quelques secondes (molette, dictée, une phrase), import d'une photo de carnet ou d'une capture Excel lue par l'IA, envoi par WhatsApp ou SMS. Appli web mobile d'abord, utilisable aussi sur ordinateur. Site vitrine et lead magnet (Playbook PDF) sur le même domaine.

## Capabilities and Constraints

- Appli : un seul fichier `public/app/index.html` (HTML, CSS et JS sans framework), données locales + sauvegarde sur compte. Site : `public/index.html` + `assets/site.css`. Cloudflare Workers.
- Offres Starter, Pro, Équipe (prix fondateur) via Stripe ; ne pas toucher à l'intégration Stripe ni aux données de production.
- Ne jamais demander les identifiants du back-office d'une marque.
- Pas de React : les bibliothèques de composants React ne s'appliquent pas telles quelles.

## Brand Commitments

- Nom : Recharge. Titre gardé : « Vos clients rachètent. Au bon moment. »
- Tout en français, ton simple et chaleureux, sans jargon, vouvoiement par défaut.
- Palette « Fusion » gardée et disciplinée (choix de l'utilisatrice, 24/11/2026) : bleu nuit #1C1A22, orange #FF782E, lavande #7B83F6, sable #F4EFE8. Police Manrope.
- Logo : anneau dégradé + flèche + éclair (SVG du site).
- Ton visuel choisi : sobre et chaleureux. Qualité de référence : Linear, Attio, Stripe, Notion, sans les copier.

## Evidence on Hand

Aucun témoignage, chiffre client ni logo de marque partenaire réel : ne jamais en inventer. Les estimations sont étiquetées comme telles. Les informations manquantes portent un marqueur [À COMPLÉTER : ...].

## Product Principles

1. La relance du jour d'abord : chaque écran mène à « qui contacter, avec quel message ».
2. Saisir doit coûter moins de 10 secondes, sinon la vendeuse ne le fera pas.
3. Aucune fausse promesse : pas de chiffre inventé, estimations signalées.
4. Ne rien casser de ce qui marche ; on cache, on ne supprime pas.

## Accessibility & Inclusion

Lecture sur téléphone en extérieur : contraste AA minimum (4,5:1 pour le texte), texte jamais sous 12 px, cibles tactiles de 44 px. Respect de « réduire les animations ».
