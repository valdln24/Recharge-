---
name: Recharge
description: Vos clients rachètent. Au bon moment.
colors:
  bleu-nuit: "#1C1A22"
  bleu-nuit-2: "#2A2631"
  encre-2: "#57515C"
  encre-3: "#6B6471"
  sable: "#F4EFE8"
  sable-2: "#F1EBE3"
  papier: "#FFFFFF"
  trait: "#E7DFD5"
  trait-fort: "#D9CFC3"
  orange: "#FF782E"
  orange-texte: "#A8501A"
  orange-voile: "#FFF1E7"
  lavande: "#7B83F6"
  lavande-texte: "#4F55C9"
  lavande-voile: "#EEEEFD"
  vert-texte: "#17744A"
  vert-voile: "#E5F6EE"
  retard-texte: "#B82E44"
  retard-voile: "#FDE8EA"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.97rem"
    fontWeight: 500
    lineHeight: 1.5
  small:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.844rem"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 650
    lineHeight: 1.3
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  full: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.bleu-nuit}"
    textColor: "{colors.papier}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 20px"
  button-send:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.bleu-nuit}"
    rounded: "{rounded.md}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.bleu-nuit}"
    rounded: "{rounded.md}"
    height: "44px"
  button-quiet:
    textColor: "{colors.bleu-nuit}"
    height: "40px"
  input:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.bleu-nuit}"
    rounded: "{rounded.sm}"
    height: "48px"
    padding: "0 14px"
  list-group:
    backgroundColor: "{colors.papier}"
    rounded: "{rounded.lg}"
  chip:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.encre-2}"
    rounded: "{rounded.full}"
    height: "34px"
  chip-on:
    backgroundColor: "{colors.bleu-nuit}"
    textColor: "{colors.papier}"
    rounded: "{rounded.full}"
---

# Design System: Recharge

## Overview

**Creative North Star : « Le carnet bien tenu »**

Recharge remplace le carnet de la conseillère. Pas un tableau de bord de start-up : un carnet tenu avec soin, sur papier sable, à l'encre bleu nuit, où chaque page dit ce qu'il y a à faire aujourd'hui. La précision vient de la typographie et des alignements (Stripe, Linear), la simplicité de la lecture en liste (Notion, Attio) ; la chaleur vient des mots, du sable et d'un orange rare.

L'interface est un outil (mode Operate) : densité modérée, une seule action principale par écran, des listes plutôt que des cartes, des surfaces plates séparées par des traits fins. L'expression se concentre sur trois signatures : l'anneau de compte à rebours autour des initiales, la bulle de message prête à envoyer et la molette de durée.

Refusé (audit du 24/11/2026) : emojis en guise d'icônes, dégradés décoratifs, halos et ronds flous, ombre sous chaque bloc, pilules partout, deux couleurs de bouton principal, gris illisible.

**Key Characteristics :**
- Sable en fond, papier blanc pour les groupes, bleu nuit pour le texte et l'action.
- L'orange ne sert qu'à envoyer un message et à la marque.
- Listes groupées à traits fins ; cartes réservées à ce qui se déplace (fenêtres, notifications).
- Une famille d'icônes dessinée, trait de 1,75 px.
- Plat au repos ; l'ombre signale ce qui flotte.

## Colors

Une palette chaude et retenue : un fond papier, une encre, un accent rare.

### Primary
- **Bleu nuit** (#1C1A22) : texte principal, bouton principal, élément actif de la navigation, onglet sélectionné. C'est la couleur de l'action.

### Secondary
- **Orange Recharge** (#FF782E) : uniquement le bouton « Envoyer » (WhatsApp, SMS), le bouton + de nouvelle vente et le logo. Texte bleu nuit dessus (6,5:1), jamais blanc (2,6:1). Version texte : **Orange encre** (#A8501A), pour un mot à souligner, jamais pour un paragraphe.

### Tertiary
- **Lavande** (#7B83F6) : information et coach (« Pourquoi ? », conseils, explications). Version texte **Lavande encre** (#4F55C9), voile #EEEEFD.

### Neutral
- **Sable** (#F4EFE8) : fond de l'appli et du site.
- **Sable 2** (#F1EBE3) : zones de saisie au repos, segments inactifs.
- **Papier** (#FFFFFF) : groupes de liste, fenêtres, champs.
- **Trait** (#E7DFD5) et **Trait fort** (#D9CFC3) : séparateurs et bordures.
- **Encre 2** (#57515C) : texte secondaire. **Encre 3** (#6B6471) : métadonnées, aides ; 4,98:1 sur sable (remplace #8A8390, illisible).

### États
- **Retard** (#B82E44 sur #FDE8EA), **Réussi** (#17744A sur #E5F6EE). Jamais l'orange pour l'urgence.

### Named Rules
**La règle de la voix unique.** Un écran a une seule action principale en bleu nuit. L'orange apparaît au plus une fois par vue, sur le geste d'envoi.
**La règle de l'encre lisible.** Aucun texte sous 4,5:1. Sur fond bleu nuit, le texte secondaire est un sable atténué (#C9C2D0), jamais un gris neutre.

## Typography

**Police :** Manrope (intégrée, licence SIL OFL), repli system-ui.

**Caractère :** une grotesque géométrique chaleureuse, ronde sans être enfantine ; les chiffres sont tabulaires partout où l'on compare.

### Hierarchy
- **Display** (800, 2rem, 1.1, -0.03em) : un seul par écran, le titre de page ou le chiffre clé de Résultats.
- **Title** (800, 1.375rem, 1.2) : titres de fenêtre.
- **Heading** (650, 1.0625rem, 1.3) : titres de groupe, nom de la cliente dans une ligne.
- **Body** (500, 0.97rem / 15.5 px, 1.5) : texte courant, messages. Mesure max 65ch.
- **Small** (500, 0.844rem / 13.5 px, 1.45) : métadonnées, raisons (« Gel aloe vera terminé depuis 2 j »).
- **Label** (650, 0.78rem / 12.5 px, 1.3) : libellés de champ, onglets, pastilles. Plancher absolu : 12 px.

### Named Rules
**La règle des trois graisses.** 500, 650, 800. Rien d'autre (plus de 550, 620, 700, 750).
**La règle des six tailles.** Toute taille hors de l'échelle est un défaut.

## Layout

Grille de 4 px : 4, 8, 12, 16, 24, 32, 48. Marge latérale mobile 16 px. Plus d'espace au-dessus d'un titre de groupe (32) qu'en dessous (12).

Mobile d'abord (390 px). Barre d'onglets en bas : Aujourd'hui, Clients, +, Résultats, Menu. À partir de 900 px : navigation latérale fixe de 240 px et contenu limité à 720 px de large (fiche ouverte à droite à partir de 1200 px). Cibles tactiles de 44 px minimum.

## Elevation & Depth

Plat au repos. La profondeur vient de la superposition sable → papier et des traits fins. Une seule ombre, pour ce qui flotte au-dessus du contenu : fenêtres (sheets), menu contextuel, notification, barre d'onglets.

### Shadow Vocabulary
- **Flottant** (`box-shadow: 0 1px 2px rgba(28,26,34,.06), 0 12px 32px -12px rgba(28,26,34,.22)`) : sheets, notifications, barre d'onglets.

### Named Rules
**La règle du plat.** Aucun bloc posé dans la page n'a d'ombre. Pas de halo coloré, pas de lueur, pas de dégradé de fond.

## Shapes

Arrondis : 6 (pastilles internes, badges), 10 (champs), 14 (boutons), 20 (groupes de liste, sheets), cercle seulement pour les avatars et les anneaux. Les pilules (999) sont réservées aux filtres et aux segments. Bordures de 1 px en Trait.

## Components

### Buttons
- **Forme :** arrondi 14 px, hauteur 48 (principal) ou 44 (secondaire), texte Label agrandi (650, 0.94rem).
- **Principal :** fond bleu nuit, texte papier. Un seul par vue.
- **Envoyer :** fond orange, texte bleu nuit, icône WhatsApp ou SMS. Seul usage de l'orange plein.
- **Secondaire :** fond papier, bordure Trait fort, texte bleu nuit.
- **Discret :** texte bleu nuit souligné au survol, sans fond (Copier, Autre message, Reporter).
- **États :** survol −4 % de luminosité, appui échelle .98 en 120 ms, focus anneau lavande 2 px décalé de 2 px, désactivé 40 % d'opacité, chargement : libellé remplacé par « … » et largeur gardée.

### Lists (composant principal)
- Groupe papier arrondi 20, lignes de 64 px minimum séparées par un trait inset de 16 px.
- Ligne : anneau ou avatar 40 px à gauche, nom (Heading) + raison (Small, Encre 3), action ou chevron à droite.
- Remplace les cartes du plan du jour, de Clients, de Résultats et du Menu.

### Chips & segments
- Pilule papier bordée, active en bleu nuit. Un seul style de sélecteur dans toute l'appli ; la molette reste réservée aux durées et quantités.

### Inputs / Fields
- Fond papier, bordure Trait fort, arrondi 10, hauteur 48, libellé Label au-dessus. Focus : bordure bleu nuit + anneau lavande voilé. Erreur : bordure Retard et message sous le champ, qui disparaît dès la saisie.
- Cases à cocher et interrupteurs dessinés (pas de case native orange).

### Sheets (modales)
- Montent du bas sur mobile (arrondi 20 en haut, poignée), fenêtre centrée de 560 px sur ordinateur. Titre (Title) sur une ligne, fermer à droite. Ombre Flottant.

### Notifications (toasts)
- Bleu nuit plein, texte papier, action « Annuler » en lavande clair. Pas de dégradé.

### Navigation
- Barre d'onglets papier, ombre Flottant, icônes 22 px au trait, libellé Label 12 px. Actif : icône pleine + texte bleu nuit ; inactif : Encre 3. Le + central est orange.
- Le coach est un onglet ou une entrée de menu, jamais un bouton flottant supplémentaire.

### États
- **Chargement :** squelettes de lignes (sable 2, pulsation d'opacité 1,2 s), jamais de spinner plein écran.
- **Vide :** une phrase qui dit quoi faire + un bouton principal (« Ajouter ma première cliente »). Pas d'illustration générique.
- **Erreur :** dire le problème et la solution, en français simple, avec un bouton pour réessayer.

### Icons
- Famille dessinée sur une grille de 24, trait 1,75 px, extrémités arrondies, une seule couleur (currentColor). Les signes bicolores MK restent pour les catégories et l'onboarding. **Aucun emoji dans l'interface** ; les emojis restent permis dans les messages envoyés aux clientes.

### Signature : l'anneau de relance
- Cercle de 40 px autour des initiales, rempli selon le temps restant. Bleu nuit en temps normal, orange encre le jour J, Retard au-delà. C'est le seul indicateur d'urgence.

## Motion

- Durées : 120 ms (appui), 180 ms (changement d'état), 260 ms (sheet, page). Courbe `cubic-bezier(.2,.8,.2,1)`.
- Un seul moment animé par écran ; rien n'apparaît en cascade. Pas de pulsation infinie.
- `prefers-reduced-motion` : transitions ramenées à un fondu de 1 ms.

## Do's and Don'ts

### Do:
- **Do** utiliser les tokens CSS (`--rc-*`) ; aucune couleur écrite en dur hors de `:root`.
- **Do** mettre une seule action principale par vue, en bleu nuit.
- **Do** présenter les ensembles de personnes en listes groupées à traits fins.
- **Do** dessiner chaque icône dans la famille au trait 1,75 px.
- **Do** garder les chiffres en `tabular-nums`.

### Don't:
- **Don't** utiliser un emoji comme icône d'interface.
- **Don't** mettre de dégradé, de halo, de rond flou ou d'ombre sur un bloc posé dans la page.
- **Don't** écrire en orange pour signaler une urgence ou un statut.
- **Don't** poser une étiquette (kicker) au-dessus d'un titre.
- **Don't** descendre sous 12 px ni sous 4,5:1.
- **Don't** empiler deux boutons principaux de même poids.
