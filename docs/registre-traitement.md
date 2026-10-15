# Fiche de traitement — WoocLight

Fiche du registre des traitements tenu par l'utilisateur, **responsable de
traitement** depuis le 14/10/2026 (projet personnel, le CD47 n'est pas
concerné). Rédaction assistée par Claude (IA), à relire et valider par le
responsable. Son nom et son adresse de contact ne figurent pas ici (dépôt
public) : ils sont dans `config.php` et affichés aux participants
(« Confidentialité »). Version V0.4 (15/10/2026).

| Rubrique | Contenu |
|---|---|
| Nom du traitement | WoocLight — participation en direct à des ateliers de médiation numérique |
| Responsable | L'animateur qui organise l'atelier (`responsable` dans `config.php`) |
| Finalité | Recueillir les réponses anonymes des participants à un atelier (sondages, quiz, nuages de mots) pour animer la séance et en dresser le bilan |
| Base légale | Intérêt légitime de l'organisateur à animer l'atelier (art. 6.1.f RGPD) ; texte affiché réglable (`base_legale` dans `config.php`) |
| Personnes concernées | Participants aux ateliers (adultes et éventuellement mineurs) ; l'animateur |
| Données collectées | Réponses aux questions ; identifiant aléatoire du téléphone (cookie + stockage local, une journée, sans lien avec l'identité, différent d'une session à l'autre) ; empreinte irréversible de l'adresse IP (HMAC avec sel secret) pour limiter les abus, effacée au bout de 2 heures au plus. **Aucun nom, e-mail ni compte.** Données **pseudonymisées**, pas anonymes au sens du RGPD. |
| Données sensibles | Aucune demandée. Risque résiduel : un participant peut taper un nom ou une information personnelle dans une réponse libre → l'animateur peut masquer la réponse, la session peut être supprimée immédiatement |
| Mineurs | Possible : aucune donnée identifiante demandée |
| Destinataires | L'animateur ; les participants de la séance voient les résultats projetés (réponses masquées exclues) |
| Durée de conservation | **30 jours** après la dernière action de l'animateur (`purge_days`, réglable ; l'activité des participants ne la prolonge pas), par une tâche planifiée **horaire** (`purge.php`) : les réponses une à une, les textes écrits par les participants (réponses libres, nuage, mur, post-it), les identifiants d'appareil et les traces d'IP sont **supprimés**. Seule une **archive anonyme** est gardée sans limite : questions, résultats regroupés (nombres, pourcentages, moyennes), récap, conclusion et synthèse de l'animateur — données qui ne permettent plus de remonter à une personne (anonymisation par agrégation, décision du responsable du 15/10/2026). Archivage ou suppression manuels possibles à tout moment |
| Exports | CSV et version imprimable des résultats, téléchargés par l'animateur, **réponses masquées comprises** : à supprimer une fois le bilan fait ; la purge du serveur ne les atteint pas |
| Hébergement | Alwaysdata (Paris, France), compte personnel — données dans un dossier non accessible depuis internet |
| Sous-traitants | Alwaysdata (hébergeur). GitHub (Microsoft, États-Unis) héberge **le code seulement**, jamais de données de participants |
| Transferts hors UE | Aucun pour les données de participants |
| Sécurité | HTTPS forcé ; mot de passe animateur haché (bcrypt) hors du dépôt de code ; blocage après 5 échecs de connexion ; jetons anti-CSRF ; politique de sécurité du contenu stricte (aucun script externe) ; limites de taux ; écriture des fichiers sous verrou ; accès SSH par clé seule |
| Droits des personnes | Les réponses ne sont pas rattachées à une identité : l'exercice des droits passe par la suppression de la session (animateur) ou du cookie (participant). Pendant l'atelier, l'animateur masque ou supprime une réponse sur demande ; ensuite, écrire à l'adresse `contact` affichée. Information en bas de la page participant (« Confidentialité » : version courte lisible par un collégien, puis base légale, destinataires, durée, droits, CNIL) |
| Analyse d'impact | Non requise a priori (pas de donnée sensible collectée, pas de profilage, pas de traitement à grande échelle) |
