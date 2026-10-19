# Intégration de l'interface de la simulation dans le PHP — audit et suivi

Ouvert le 19/10/2026. Consigne : `PAPPERBOARD-CHATGPT/docs/CONSIGNE-CLAUDE-UI-PHP.md`
(référence d'interface `PAPPERBOARD-CHATGPT@57add97`, `docs/simulation/`).
Base de production : `3be45e5` (identique à la référence lue par la consigne).
Tests de départ sur cette base, 19/10/2026 (mesuré, `bash tests/run.sh` en local, Playwright
présent) : tout vert (e2e 426, charge, configuration, archivage, protection, charte, navigateur, galerie).

Décisions de l'utilisateur du 19/10/2026 :
- Travail sur la branche, mise en ligne (avance de `main`) **seulement sur son feu vert**.
- **AG-007 refusé** : moutarde `#B18400` et neutre de série gardés (palette d'AG-006).
- **Cinq onglets** : Préparer → Pilotage → Animer → Bilan → Réglages (Réglages gardé).
- Niveau du public, durée et public « Autres » **inclus** dans ce chantier.

Non repris de la simulation (outil réel, pas un bac à sable) : badge « Bac à sable »,
« Recommencer », bandeau « Simulation interactive », « Simuler une réponse / inscription /
question », carte « À vous de jouer », podium et scores fictifs, synchronisation par
`localStorage`, `unsafe-inline` de la CSP.

## Tableau des écarts (audit du 19/10/2026, lu sur `3be45e5`)

| Fonction | Preuve PHP | Simulation | Écart | Action |
|---|---|---|---|---|
| Créer un atelier vide | `admin.php:81`, `api.php:404` | dialogue « Créer un atelier » | formulaire en ligne, pas de choix vide / JSON | dialogue de création à deux voies |
| Créer depuis un JSON | `assets/admin.js:1100` (aperçu sans session), `api.php:630` | voie « Générer ou importer un JSON » à la création | l'import n'existe que dans une session ouverte | aperçu sans session ; à la confirmation `session_create` puis `questions_import` ; si l'import échoue, `session_delete` (pas de session orpheline, aucune API nouvelle) |
| Relecture par une autre IA | `admin.php:346`, `assets/admin.js:1013`, `:1041` | absente | à préserver | gardée dans les deux voies ; retour attendu précisé (version JSON corrigée à recoller, puis « Vérifier » de nouveau) |
| Public / niveau / durée | `admin.php:319`, `:326`, `assets/admin.js:868` | Autres + champ 160 c., 5 niveaux, nombre 1-30 ou durée 15-180 min | ni niveau, ni durée, ni « Autres » ; nombre 3-20 | ajoutés à la consigne copiée ; format d'import inchangé |
| Mes ateliers : ouvrir, dupliquer, archiver, supprimer | `assets/admin.js:58-97`, `api.php:412`, `:432`, `:520` | lignes avec actions, archives séparées | présent, présentation en liste brute | restylé en cartes ; règles d'archivage anonyme et confirmations inchangées |
| Archives : restaurer | `admin.php:133`, `api.php:501` (`archive_reuse`) | « Restaurer » | une archive est anonymisée : la restaurer à l'identique est impossible | garder « Réutiliser les questions » (nouvelle session sans résultats) |
| Bibliothèque de séances et thèmes | `admin.php:88-116` | « Bibliothèque de modèles » | présent | restylé, distinct des ateliers et des archives |
| Onglets de l'atelier | `admin.php:152-157` | Préparer, Pilotage, Animer, Bilan | pas d'onglet Pilotage | onglet Pilotage ajouté ; Réglages gardé en 5ᵉ |
| Pilotage : QR, code, lien, copier, partager, inscriptions, QR projeté | `admin.php:209-221`, `assets/admin.js:1061-1085` | carte « Rejoindre l'atelier » | dans Animer | déplacé dans Pilotage, mêmes identifiants |
| Signaux, Oser demander, pseudonymes, podium | `admin.php:225-261`, `assets/admin.js:482` | Pilotage | dans Animer | déplacés dans Pilotage, mêmes identifiants ; résumé compact dans Animer |
| Animer : précédente / suivante en haut, vote, publication, réinitialiser | `admin.php:223-240`, `assets/admin.js:557`, `:595` | trois colonnes : liste, question, participation | une seule carte | rail des questions (clic = projeter), question au centre, participation à droite ; boutons en haut ; « Afficher / Masquer les graphes et réponses » |
| Préparer : liste, ordre, modifier, brise-glace, clôture, défi, conclusion | `admin.php:159-205`, `assets/admin.js:621` | cartes numérotées, trois cartes « séquences » | boutons texte en ligne | numéro en pastille, icônes ↑ ↓ et suppression, trois cartes de séquences |
| Bilan et exports | `admin.php:264-296` | métriques + exports | présent | restylé ; filtres de confidentialité inchangés |
| Projection : plein écran, commandes, bouton unique | `screen.php:19-58`, `assets/screen.js:241`, `:384` | commandes en haut, bouton unique Afficher / Masquer | barre de pilotage en bas | barre en haut ; libellés « graphes et réponses » |
| QR agrandi | `assets/screen.js:447` (touche Q) | clic → fenêtre, Échap, extérieur, retour du focus | touche seulement | fenêtre agrandie au clic (projection et Pilotage) |
| Participant | `index.php`, `assets/app.js` | aperçu participant | présent (refait le 18/10/2026) | inchangé dans ce chantier sauf écart constaté |

## Réalisé le 19/10/2026 (branche, pas en ligne)

Commits `7ab89e6`, `6df8842`, `fcdc747`. Mesuré en local (`bash tests/run.sh`, Playwright) : e2e 432,
navigateur 103, galerie 768, charte 15 ; tout vert.

- **Espace animateur** : onglets Préparer → Pilotage → Animer → Bilan → Réglages ; Animer en trois
  colonnes (questions cliquables pour projeter, question au centre avec Précédente / Suivante en haut,
  participation) ; Pilotage (invitation, QR agrandi, accueil, signaux effaçables, Oser demander,
  pseudonymes) ; Mes ateliers / Bibliothèque / Archives en onglets.
- **Création** : fenêtre « Créer un atelier » (vide ou JSON). Voie JSON : aperçu sans session,
  session créée à la validation, supprimée si l'import est refusé (test navigateur : annuler ne crée
  rien, valider en crée une seule). Public « Autres » (160 caractères), niveau, nombre 1 à 30 ou
  durée 15 à 180 min avec estimation. La relecture par une autre IA demande maintenant la version
  JSON corrigée, à recoller puis revérifier ; modifier le JSON retire l'aperçu.
- **Écart signalé** : « Ajouter depuis un JSON » gardé dans Préparer pour compléter un atelier
  existant (la simulation ne le propose qu'à la création). « Projeter » retiré de la liste de
  Préparer : la liste d'Animer le remplace.
- **Serveur** : commandes `welcome` (retour à l'accueil) et `signals_clear` (e2e : l'effacement ne
  réveille pas les appareils).
- **Projection** : bouton central à étapes gardé (point à ne pas défaire du 16/10/2026) ; son étape
  d'affichage s'appelle « Afficher les graphes et réponses » et « Masquer les graphes et réponses »
  apparaît seul ensuite, même sans réponse. Commandes en haut à partir de 761 px ; **en bas sur
  téléphone** (en haut, repliées, elles faisaient sortir les gommettes de l'écran à 390 px, mesuré).
  QR cliquable : agrandi, fermé par « Fermer », Échap ou clic à côté, focus rendu.

Mesures navigateur du 19/10/2026 (démo, 10 formes, résultats affichés, animateur connecté) :
- Espace animateur, 5 onglets + génération, à 1920×1080, 1280×720, 1024×768, 390×844 : aucun
  débordement horizontal, aucune cible sous 44 px, aucune erreur JS.
- Projection : dernière réponse dans l'écran pour les 10 formes aux 4 tailles. À 390 px (tactile),
  polices de 13,6 à 18 px ; gommettes à 12 px, comme sur la base `3be45e5`.

**Pas testé** : vrais appareils distants (seulement plusieurs contextes de navigateur sur le même
serveur local), lecteur d'écran, projection physique, sondage, échelle et étapes en plein écran réel.
