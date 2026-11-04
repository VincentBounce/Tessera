#!/bin/zsh
# A commit shipped to main with its version given at the push, not at the edit: sessions working side by side never
# take the same number (each picked it from its own copy, the second push refused, renumbered by hand). The changes
# staged (git add) are committed, put on origin/main, VERSION in main.js set to main's + 1, the assets' cache key in
# index.html (their ?v=, a browser's copy kept till it changes) set to it too, and the subject ended with it, then
# pushed; a push refused because another session went first starts again from main, any other refusal stops. Never
# edit VERSION or the cache key yourself.
# tools/ship.sh "subject without its version" ["body: the Co-Authored-By line…"]
repo="${0:A:h:h}"; cd "$repo" || exit 1
subject=$1; body=$2
[[ -n $subject ]] || { echo 'tools/ship.sh "subject" ["body"]'; exit 1; }
git diff --cached --quiet && { echo "nothing staged: git add first"; exit 1; }
git diff --cached main.js | grep -q "^[-+]const VERSION" && { echo "VERSION changed by hand: leave it to tools/ship.sh"; exit 1; }
git diff --cached index.html | grep -q '^[-+].*?v=' && { echo "the cache key changed by hand: leave it to tools/ship.sh"; exit 1; }
version() { grep -o "VERSION = '[^']*'" main.js | cut -d"'" -f2; }
cacheKey() { grep -o 'main\.js?v=[^"]*' index.html | cut -d= -f2; }
# the version and the cache key both from one to the other (the key: every asset's ?v= the same)
stamp() { sed -i '' "s/VERSION = '$1'/VERSION = '$2'/" main.js; sed -i '' "s/?v=$3\"/?v=$4\"/g" index.html; }
message() { print -r -- "$subject (v$1)${body:+

$body}"; }
git commit -q -m "$(message pending)" || exit 1
for try in 1 2 3 4 5; do
  git fetch -q origin main || exit 1
  # (a real conflict, two sessions on the same lines: stopped, the commit kept, for a person to look at)
  git rebase -q --autostash origin/main || { git rebase --abort; echo "conflict with origin/main: the commit is kept, rebase by hand"; exit 1; }
  base=$(git rev-parse origin/main) old=$(version) key=$(cacheKey); new="${old%.*}.$(( ${old##*.} + 1 ))"
  stamp "$old" "$new" "$key" "$new"
  git add main.js index.html && git commit -q --amend -m "$(message $new)" || exit 1
  out=$(git push -q origin HEAD:main 2>&1) && { echo "shipped v$new: $(git log --format='%h %s' -1 | cut -c1-90)"; exit 0; }
  # (refused: the number and the key given back, so the next rebase meets no change on their lines)
  stamp "$new" "$old" "$new" "$key"
  git add main.js index.html && git commit -q --amend -m "$(message pending)" || exit 1
  git fetch -q origin main || exit 1
  [[ $(git rev-parse origin/main) != $base ]] || { echo "push refused, main unmoved: the commit is kept\n$out"; exit 1; }
  echo "main moved, try $(( try + 1 ))"
done
echo "not shipped after 5 tries: the commit is kept"; exit 1
