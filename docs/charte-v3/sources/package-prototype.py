from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
for name in ('style.css', 'refinements.css'):
    css = (root / name).read_text().replace('</style', '<\\/style')
    html = html.replace(f'<link rel="stylesheet" href="{name}">', f'<style>\n{css}\n</style>')
for name in ('icons.js', 'preparation-tools.js', 'app.js'):
    script = (root / name).read_text().replace('</script', '<\\/script')
    html = html.replace(f'<script src="{name}"></script>', f'<script>\n{script}\n</script>')
assert not re.search(r'<script[^>]+src=', html)
assert not re.search(r'<link[^>]+stylesheet', html)
assert 'connect-src \'none\'' in html
out = root / 'wooclight-sandbox.html'
out.write_text(html)
for html_name in ('wooclight-sandbox-v2.html', 'wooclight-sandbox-v3.html'):
    (root / html_name).write_text(html)
for archive_name in ('wooclight-sandbox.zip', 'wooclight-sandbox-v2.zip', 'wooclight-sandbox-v3.zip'):
    with ZipFile(root.parent / archive_name, 'w', ZIP_DEFLATED) as z:
        for name in ('wooclight-sandbox-v3.html', 'README.txt', 'exemple-import.json', 'index.html', 'style.css', 'refinements.css', 'icons.js', 'preparation-tools.js', 'app.js', 'qa.cjs', 'qa-preparation.cjs'):
            z.write(root / name, 'wooclight-sandbox/' + name)
print(f'HTML autonome : {out.stat().st_size:,} octets')
print('Version actualisée : wooclight-sandbox-v3.html / wooclight-sandbox-v3.zip')
