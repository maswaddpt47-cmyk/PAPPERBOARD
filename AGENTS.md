# Communication et gestion des blocages

Consigne explicite de l’utilisateur du 19/10/2026. À appliquer par Codex et
Claude, avec les règles du dépôt dans `CLAUDE.md` et l’état dans `CHANTIERS.md`.

- Avant de commencer, annoncer brièvement l’action et le résultat attendu.
- Dès qu’un blocage est détecté, prévenir immédiatement, sans attendre la fin
  des recherches. Donner la cause connue, ce qui est déjà livré, la solution
  proposée et l’éventuelle action précise attendue de l’utilisateur. Écrire
  « cause inconnue » si elle n’est pas établie.
- Pendant le travail, donner un point utile au plus toutes les 60 secondes :
  résultat acquis, obstacle actuel, prochaine action. Éviter les messages vides.
- Borner les commandes réseau en ligne de commande à 15 secondes. Le délai
  d’expiration d’une commande ne borne pas l’attente d’une autorisation de
  l’outil : avertir avant un appel susceptible de demander cette autorisation.
- Préférer un connecteur qui fonctionne à une voie réseau déjà bloquée. Si
  une demande d’autorisation réseau a immobilisé la session, ne pas relancer
  cette voie sans nouvelle information ou demande explicite de l’utilisateur.
- Après un échec, annoncer le changement de méthode. Ne pas répéter une même
  tentative sans élément nouveau. Une solution de repli qui échoue conduit à
  un constat de blocage et à une action précise, pas à une attente indéfinie.
- Continuer les tâches indépendantes autorisées ; laisser en attente celles
  qui dépendent d’une réponse, d’un accès ou d’une approbation manquante.
- Ne pas contourner un refus d’accès ou d’approbation. Expliquer la limite et
  proposer une voie autorisée ou l’action nécessaire pour obtenir l’accès.
- Distinguer clairement code local, code poussé, aperçu en ligne et application
  complète opérationnelle. Annoncer uniquement les tests effectivement exécutés.
- Terminer par le résultat accessible, les limites restantes et, si nécessaire,
  une seule prochaine action clairement formulée.

Ces consignes persistent avec le dépôt. Elles ne changent pas les délais ou
les fenêtres d’autorisation imposés par la plateforme.


## Autorisation en cours — 19/10/2026

L’utilisateur a donné le feu vert explicite pour intégrer l’interface fidèle à
la simulation dans PAPPERBOARD et publier sur Alwaysdata après vérification.
Cette autorisation remplace le gel précédent pour ce chantier. Ne pas redemander
la même permission ; signaler immédiatement les obstacles réels.
