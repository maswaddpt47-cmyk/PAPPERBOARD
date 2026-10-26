# Consigne d'audit Codex — WoocLight, ateliers rangés par partenaire (26/10/2026)

Rédigée le 26/10/2026 à partir de MD-LIB `consigne-audit-externe.md`, pour l'audit
ponctuel (`agora.md` §12, règle 4 : données personnelles gardées plus longtemps).
Elle complète `consigne-audit-codex.md` (10/10/2026) et
`consigne-audit-codex-17-10-2026.md` : le contexte ne contient que des faits, aucune
conclusion, et rien sur les protections déjà en place. À coller telle quelle dans Codex.

**Avant** : accès en lecture seule au seul dépôt `maswaddpt47-cmyk/PAPPERBOARD` ;
autorisations « Lecture seule » ; réflexion au plus haut niveau ; aucune donnée
réelle, capture ni identifiant.
**Après** : vérifier chaque point dans le code avant de le croire ; ranger le
rapport vérifié hors de tout dépôt public ; reporter les corrections dans
`CHANTIERS.md` ; l'utilisateur tranche.

```text
Tu es auditeur de sécurité et de conformité RGPD. Audit en LECTURE SEULE :
ne modifie aucun fichier, ne crée ni branche ni pull request, n'appelle aucune
URL de production.

CONTEXTE (faits, pas conclusions)
WoocLight : application web de participation en direct (type Wooclap) pour
des ateliers de médiation numérique, projet personnel d'un animateur, responsable
de traitement. Participants : seniors, collégiens (mineurs), travailleurs sociaux,
sans compte, avec un code de 5 caractères ou un QR code. PHP 8 sans framework ;
actions dans api.php, bibliothèque commune lib.php, pages index.php (participant),
admin.php (animateur, mot de passe, session PHP, CSRF), screen.php (projection) ;
JavaScript sans build dans assets/ ; stockage en fichiers JSON dans un dossier
défini par config.php (non versionné). Hébergement Alwaysdata. Une tâche horaire
(purge.php) supprime une session 30 jours (réglable : purge_days) après la
dernière action de l'animateur, après en avoir écrit une archive.

CHANGEMENTS À EXAMINER EN PRIORITÉ (26/10/2026)
1. Partenaires : fichier partners.json (id, nom, date) dans le dossier de
   données ; fonctions wl_partners, wl_partner_resolve, wl_partner_name (lib.php).
2. Actions session_file, session_unfile, partner_close (api.php) : un atelier
   terminé, hors démonstration, reçoit les champs `partner` et `filed` ; il est
   alors gardé COMPLET (réponses une à une, textes écrits par les participants,
   pseudonymes, identifiants des appareils) jusqu'à partner_close, au plus
   WL_PARTNER_DAYS (365) jours après `filed` : wl_retention_start (lib.php)
   décale la date prise en compte par wl_purge.
3. partner_close : chaque atelier du partenaire passe par wl_archive_session
   puis est supprimé (wl_delete_session) ; l'archive porte le nom du partenaire.
4. Export format=cycle&partner=ID (api_export_cycle, api.php) : un CSV qui
   réunit les résultats de tous les ateliers d'un partenaire.
5. Liste des sessions (action `sessions`) : nouveaux champs partner, filed,
   expires, et liste des partenaires.
6. Textes d'information mis à jour : index.php (« Confidentialité »),
   docs/registre-traitement.md (à lire seulement en fin d'audit, voir la règle).
7. Import de questions (wl_import_parse, wl_import_json, wl_shorten) : la liste
   JSON est cherchée à partir de chaque « [ » du texte collé ; une explication
   de plus de 400 caractères est coupée.

RÈGLE DE MÉTHODE
Ne lis PAS les fichiers .md du dépôt (CLAUDE.md, CHANTIERS.md, AGORA.md,
README.md, docs/…) avant d'avoir terminé ton propre relevé : ils contiennent les
conclusions d'une autre IA, et on veut ton regard indépendant. Tu peux les
lire à la fin, uniquement pour signaler un désaccord avec eux.

À EXAMINER
1. Durée réelle de conservation : un atelier rangé peut-il échapper à la limite
   de 365 jours (rangé de nouveau, sorti puis rangé, rouvert après rangement,
   champs `filed` ou `partner` modifiés par une autre action, partenaire
   supprimé ou inexistant, horloge, purge qui échoue en boucle) ? À l'inverse,
   peut-il être purgé avant ?
2. Contrôle d'accès des nouvelles actions et de l'export du cycle : rôle requis,
   CSRF, identifiant de partenaire ou code de session forcé, export d'un partenaire
   qui n'existe pas, énumération.
3. Données personnelles conservées 12 mois : lesquelles exactement (lire la
   structure d'une session), sont-elles toutes nécessaires au bilan de fin de
   cycle, que contient le CSV du cycle (textes écrits par les participants,
   réponses masquées par l'animateur), que contient l'archive après partner_close
   (rien qui vienne d'un participant pris à part ?).
4. Cohérence avec l'information donnée aux participants (index.php) : durée,
   finalité, destinataires ; cas des mineurs.
5. Injections : nom du partenaire (longueur, caractères, affichage dans admin.js,
   nom du fichier exporté, CSV : formules), JSON importé (recherche de la liste
   à partir de chaque « [ » : coût sur un texte de 60 Ko plein de crochets).
6. Concurrence : partners.json écrit sous verrou ? partner_close pendant qu'un
   participant écrit, ou pendant la purge horaire.

FORMAT DE RÉPONSE (en français)
Un tableau, un problème par ligne, du plus grave au moins grave :
| N° | Gravité (critique / haute / moyenne / basse) | fichier:ligne |
| Problème | Scénario concret (qui, comment, résultat) |
| Correction proposée | Confiance (certain / probable / à vérifier) |

Règles :
- Pas de problème sans fichier:ligne et sans scénario concret. Un risque
  théorique sans chemin d'exploitation va dans une liste à part
  « Remarques ».
- Chaque ligne doit avoir été vérifiée en lisant le code appelant.
- Termine par « Ce que je n'ai pas pu vérifier ».
- Si tu ne trouves rien de grave dans une catégorie, dis-le en une ligne.
```
