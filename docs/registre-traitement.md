# Fiche de traitement — WoocLight

Projet de fiche pour le registre des traitements du Département de
Lot-et-Garonne. Rédaction assistée par Claude (IA) le 09/10/2026, **à relire
et valider par le DPD** (`contact-dpd@lotetgaronne.fr`) avant inscription.
Version V0.1.

| Rubrique | Contenu |
|---|---|
| Nom du traitement | WoocLight — participation en direct aux ateliers de médiation numérique |
| Responsable | Conseil départemental de Lot-et-Garonne |
| Service | Médiation numérique (conseiller numérique) |
| Finalité | Recueillir les réponses anonymes des participants à un atelier (sondages, quiz, nuages de mots) pour animer la séance et en dresser le bilan |
| Base légale | Mission d'intérêt public (art. 6.1.e RGPD) — à confirmer par le DPD |
| Personnes concernées | Participants aux ateliers (seniors, collégiens, travailleurs sociaux, agents) ; l'animateur |
| Données collectées | Réponses aux questions ; identifiant aléatoire du téléphone (cookie + stockage local, sans lien avec l'identité) ; empreinte irréversible de l'adresse IP (HMAC avec sel secret) pour limiter les abus, effacée au bout de 2 heures au plus. **Aucun nom, e-mail ni compte.** |
| Données sensibles | Aucune demandée. Risque résiduel : un participant peut taper un nom ou une information personnelle dans une réponse libre → l'animateur peut masquer la réponse, la session peut être supprimée immédiatement |
| Mineurs | Possible (collégiens) : aucune donnée identifiante demandée |
| Destinataires | L'animateur ; les participants de la séance voient les résultats projetés (réponses masquées exclues) |
| Durée de conservation | Suppression automatique de la session et de toutes ses réponses **30 jours** après sa dernière activité (réglable). Suppression manuelle possible à tout moment. **Durée à valider avec les Archives départementales** (élimination d'archives publiques, tableau de gestion) |
| Exports | CSV et version imprimable des résultats agrégés, téléchargés par l'animateur : leur conservation suit les règles du service |
| Hébergement | Alwaysdata (Paris, France) — hébergement mutualisé, données dans un dossier non accessible depuis internet |
| Sous-traitants | Alwaysdata (hébergeur). GitHub (Microsoft, États-Unis) héberge **le code seulement**, jamais de données de participants |
| Transferts hors UE | Aucun pour les données de participants |
| Sécurité | HTTPS ; mot de passe animateur haché (bcrypt) hors du dépôt de code ; blocage après 5 échecs de connexion ; jetons anti-CSRF ; politique de sécurité du contenu stricte (aucun script externe) ; limites de taux ; écriture des fichiers sous verrou |
| Droits des personnes | Les réponses ne sont pas rattachées à une identité : l'exercice des droits passe par la suppression de la session (animateur) ou du cookie (participant). Information affichée en bas de la page participant (« Confidentialité ») |
| Analyse d'impact | Non requise a priori (pas de donnée sensible collectée, pas de profilage) — à confirmer par le DPD |
