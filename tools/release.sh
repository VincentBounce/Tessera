#!/bin/zsh
# A GitHub release of Tessera: its two single-file bundles (tools/bundle.py, as « _Make Tessera.html.command » makes
# them in « Tessera resources »), tagged v<version> at the commit pushed, its notes the commits since the last release.
# tools/release.sh [--dry]   (--dry: the bundles made and checked, the notes shown, nothing published)
repo="${0:A:h:h}"; cd "$repo" || exit 1
v=$(grep -o "VERSION = '[^']*'" main.js | cut -d"'" -f2)
[[ -z $(git status --porcelain --untracked-files=no) ]] || { echo "changes not committed: commit and push first"; exit 1; }
[[ $(git rev-parse HEAD) == $(git rev-parse @{u}) ]] || { echo "HEAD not pushed: push first"; exit 1; }
gh release view "v$v" >/dev/null 2>&1 && { echo "v$v released already"; exit 1; }
plain=$(python3 tools/bundle.py --plain) && packed=$(python3 tools/bundle.py) || exit 1
# the compressed one: no comment left (its base64, its URLs and its file types aside)
python3 - "$packed" <<'EOF' || exit 1
import re, sys
t = re.sub(r'[A-Za-z0-9+/=]{200,}', '', open(sys.argv[1], encoding='utf-8').read())
t = re.sub(r'\b[a-z]+://|\b[a-z]+/\*', '', t)  # (a URL's //, a file type's /*: image/*)
bad = [m for m in ('//', '/*', '<!--') if m in t]
if bad: sys.exit(f'comments left in the compressed bundle: {bad}')
EOF
last=$(gh release list --limit 1 --json tagName -q '.[0].tagName')
notes=$([[ -n $last ]] && git log --format='- %s' "$last..HEAD" || echo "The first release; its history: https://github.com/VincentBounce/Tessera/commits/main")  # (the first: its thousands of commits linked, not listed)
echo "v$v: $packed\n      $plain\n\n$notes"
[[ $1 == --dry ]] && exit 0
# (sent from a folder with no # in its path: gh reads « file#label », and the repo's folder is « #Code »)
up=$(mktemp -d) && cp "$packed" "$plain" "$up/" || exit 1
gh release create "v$v" "$up/${packed:t}" "$up/${plain:t}" --title "Tessera v$v" --notes "$notes" --target "$(git rev-parse HEAD)"
rm -rf "$up"
