<?php
// Modèle de configuration. Copier en config.php SUR LE SERVEUR (jamais dans
// le dépôt : config.php est exclu par .gitignore et par le déploiement).
// Voir README.md, « Installation », pour générer le hash et les secrets.
return [
    // Hash du mot de passe animateur, généré en SSH par l'utilisateur :
    //   php -r 'echo password_hash("votre-mot-de-passe", PASSWORD_DEFAULT), "\n";'
    'admin_hash' => '',

    // Secret aléatoire (sel du hachage des IP, jetons CSRF des participants).
    // Généré en SSH : php -r 'echo bin2hex(random_bytes(32)), "\n";'
    'secret' => '',

    // Dossier des données, HORS de la racine web (créé automatiquement).
    // Vide : dossier data/ de l'application, protégé par .htaccess.
    'data_dir' => '/home/COMPTE/wooclight-data',

    // URL publique de l'application, utilisée dans le QR code.
    // Vide : déduite de la requête.
    'base_url' => '',

    'poll_ms' => 2000,          // intervalle de rafraîchissement des écrans
    'max_participants' => 150,  // par session
    'purge_days' => 30,         // sessions supprimées après N jours sans activité
    'max_text' => 80,           // longueur maximale d'une réponse libre
    'max_posts' => 5,           // messages ou post-its par participant et par question

    // Limites de taux (par minute). Dans un atelier, tous les téléphones
    // partagent souvent la même IP publique (wifi) : la limite par IP doit
    // rester large, la limite par participant est la vraie protection.
    'rate_ip' => 900,
    'rate_token' => 30,
    'rate_join' => 60,   // nouvelles inscriptions par minute et par IP (ralentit les faux participants)

    // Mots refusés dans les réponses libres et le nuage de mots
    // (comparaison sans casse ni accents, mot entier).
    'banned_words' => [],
];
