# Bloc WoocLight pour la routine d'audit trimestriel

Préparé le 10/10/2026, mis à jour le 14/10/2026 (projet personnel). À **ajouter** (pas remplacer) dans le champ
« Instructions » de la routine `trig_01J6ZMsLHKbgXAQsRYgQL16q`, modifiable par
l'utilisateur seul dans l'interface Routines de claude.ai. Attacher aussi le
dépôt `maswaddpt47-cmyk/PAPPERBOARD` à la routine.

```text
PROJET AJOUTÉ LE 10/10/2026 : maswaddpt47-cmyk/PAPPERBOARD (application WoocLight,
participation en direct type Wooclap). PROJET PERSONNEL depuis le 14/10/2026 :
le CD47 n'est pas concerné (ni sa charte, ni son DPD, ni ses Archives) ; le
responsable de traitement est l'utilisateur. PHP 8 sans framework, données en
fichiers JSON hors de la racine web, hébergé chez Alwaysdata (compte personnel
wooclight, appli à la racine www/), déployé automatiquement par
.github/workflows/ci-deploy.yml (rsync SSH) quand main avance, sans approbation
manuelle : le garde-fou est le ruleset de main.

En plus de /security-review et de la checklist rgpd-securite.md :
a) Lancer `bash tests/run.sh` sur main : tout doit passer (e2e, coût, charge).
   Un test retiré ou affaibli depuis le dernier audit est une trouvaille.
b) Aucun config.php ni secret dans le dépôt ; .htaccess refuse toujours lib.php,
   purge.php, config*.php, data/, tests/, scripts/, *.md.
c) Workflow : permissions contents: read, actions épinglées par SHA, déploiement
   seulement depuis main, vérification de l'empreinte
   SSH (secret ALWAYSDATA_KNOWN_HOSTS), contrôle post-déploiement des fichiers refusés.
d) Réglages du dépôt : ruleset sur main (pas de suppression ni force-push, tests
   requis), GitHub Pages désactivé.
e) RGPD : confronter le code à docs/registre-traitement.md et au texte
   « Confidentialité » d'index.php ; une mesure décrite qui n'est plus vraie est une
   trouvaille. Vérifier purge (purge_days, seule l'activité de l'animateur la
   repousse, purge.php prévu en tâche planifiée horaire), jeton participant 24 h,
   IP seulement hachée, aucune donnée personnelle demandée.

Points déjà connus, à ne pas re-signaler comme découverte (dire s'ils sont toujours là) :
- Identités multiples possibles (participation sans compte) : atténuées par
  « Fermer les inscriptions » et la limite rate_join, choix assumé.
- Lecture publique, avec le code de session, de ce qui a été publié par l'animateur.
- Durée de purge (30 j) à fixer par le responsable de traitement.
- Pas d'approbation manuelle du déploiement : choix assumé (14/10/2026).
```
