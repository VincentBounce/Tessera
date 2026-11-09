#!/bin/zsh
# Two versions of a file side by side in VS Code, their comments gone (tools/uncomment.py, as the line balance reads code):
# tools/codediff.sh v0.4.664 v0.4.668 [main.js]   (versions by their tags; the second left out: the file as it is now)
repo="${0:A:h:h}"; cd "$repo" || exit 1
a=$1; b=$2; file=${3:-main.js}
[[ -n $a ]] || { echo 'tools/codediff.sh vA [vB] [file]'; exit 1; }
dir=$(mktemp -d); name=${file:t}
git show "$a:$file" | python3 tools/uncomment.py "$name" > "$dir/$a $name" || exit 1
if [[ -n $b ]]; then git show "$b:$file" | python3 tools/uncomment.py "$name" > "$dir/$b $name" || exit 1; else b=now; python3 tools/uncomment.py "$name" < "$file" > "$dir/$b $name"; fi
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" --diff "$dir/$a $name" "$dir/$b $name"
