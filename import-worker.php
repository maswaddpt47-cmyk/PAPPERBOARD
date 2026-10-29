<?php
// Sert uniquement les deux workers épinglés de l'import. Aucun fichier utilisateur
// ni chemin fourni dans la requête n'est lu. La CSP propre au worker interdit
// les connexions externes, même quand le moteur lit un PDF non fiable.
declare(strict_types=1);
require __DIR__ . '/lib.php';
wl_security_headers();
$engine = $_GET['engine'] ?? '';
if (!is_string($engine) || !in_array($engine, ['pdf', 'ocr'], true)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Module inconnu.');
}
header('Content-Type: text/javascript; charset=utf-8');
header('Cross-Origin-Resource-Policy: same-origin');
header('Cache-Control: public, max-age=86400');
// WebAssembly est nécessaire au moteur OCR, dans ce worker seulement.
// Aucun eval JavaScript, aucun worker enfant, aucun accès réseau à un tiers.
header("Content-Security-Policy: default-src 'none'; script-src 'self'"
    . ($engine === 'ocr' ? " 'wasm-unsafe-eval'" : '')
    . "; connect-src 'self'; worker-src 'none'; base-uri 'none'; frame-ancestors 'none'");
readfile(__DIR__ . ($engine === 'pdf'
    ? '/assets/vendor/mentimeter/pdfjs/pdf.worker.mjs'
    : '/assets/vendor/mentimeter/tesseract/dist/worker.min.js'));
