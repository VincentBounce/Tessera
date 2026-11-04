#!/bin/zsh
# A commit shipped to main with its version given at the push, not at the edit: sessions working side by side never
# take the same number (each picked it from its own copy, the second push refused, renumbered by hand). The changes
# staged (git add) are committed, put on origin/main, VERSION in main.js set to main's + 1 and the subject ended with
# it, then pushed; a push refused (another session went first) starts again from main. Never edit VERSION yourself.
# tools/ship.sh "subject without its version" ["body: the Co-Authored-By line…"]
repo="${0:A:h:h}"; cd "$repo" || exit 1
subject=$1; body=$2
[[ -n $subject ]] || { echo 'tools/ship.sh "subject" ["body"]'; exit 1; }
git diff --cached --quiet && { echo "nothing staged: git add first"; exit 1; }
git diff --cached main.js | grep -q "^[-+]const VERSION" && { echo "VERSION changed by hand: leave it to tools/ship.sh"; exit 1; }
version() { grep -o "VERSION = '[^']*'" main.js | cut -d"'" -f2; }
message() { print -r -- "$subject (v$1)${body:+

$body}"; }
git commit -q -m "$(message pending)" || exit 1
for try in 1 2 3 4 5; do
  git fetch -q origin main || exit 1
  # (a real conflict, two sessions on the same lines: stopped, the commit kept, for a person to look at)
  git rebase -q --autostash origin/main || { git rebase --abort; echo "conflict with origin/main: the commit is kept, rebase by hand"; exit 1; }
  old=$(version); new="${old%.*}.$(( ${old##*.} + 1 ))"
  sed -i '' "s/VERSION = '$old'/VERSION = '$new'/" main.js
  git add main.js && git commit -q --amend -m "$(message $new)" || exit 1
  git push -q origin HEAD:main 2>/dev/null && { echo "shipped v$new: $(git log --format='%h %s' -1 | cut -c1-90)"; exit 0; }
  # (refused: main moved; the number given back, so the next rebase meets no change on that line)
  sed -i '' "s/VERSION = '$new'/VERSION = '$old'/" main.js
  git add main.js && git commit -q --amend -m "$(message pending)" || exit 1
  echo "main moved, try $(( try + 1 ))"
done
echo "not shipped after 5 tries: the commit is kept"; exit 1
