#!/usr/bin/env bash
# Captures the demo pages, on dist/, in the pinned chrome-headless-shell: the tools page, keys help
# open, and the theme menu open, wide and narrow, each in every profile and scheme. Builds dist/
# first when it is missing or older than src/. Prints each capture's caption and path, and shows it
# inline with kitty's icat when stdout is a terminal that displays images, through tmux's
# passthrough too. The captures go into a mktemp -d directory, removed on exit; with --keep, the
# directory stays and its path is printed last. The check never runs it.
set -euo pipefail
cd "$(dirname "$0")/.."

keep=false
for arg in "$@"; do
  case $arg in
    --keep) keep=true ;;
    *)
      echo "usage: mise run screenshots [--keep]" >&2
      exit 2
      ;;
  esac
done

if [[ ! -f dist/page-full.css || -n $(find src -newer dist/page-full.css -print -quit) ]]; then
  scripts/build.sh
fi

dir=$(mktemp -d "${TMPDIR:-/tmp}/screenshots.XXXXXX")
if $keep; then
  trap 'echo "kept: $dir"' EXIT
else
  trap 'rm -rf "$dir"' EXIT
fi

# kitty's icat, as kitten or through kitty, in stream mode: the image travels in escape codes, the
# one mode that crosses tmux. Shown only when stdout is a terminal and icat detects its support.
icat=()
if [[ -t 1 ]] && { exec 3<>/dev/tty; } 2>/dev/null; then
  if command -v kitten >/dev/null; then
    icat=(kitten icat)
  elif command -v kitty >/dev/null; then
    icat=(kitty +kitten icat)
  fi
  if ((${#icat[@]})) &&
    ! "${icat[@]}" --detect-support --detection-timeout=2 --transfer-mode=stream \
      <&3 >/dev/null 2>&1; then
    icat=()
  fi
fi

BROWSER_EXECUTABLE=$(mise which chrome-headless-shell) node scripts/screenshots.js "$dir" |
  while IFS=$'\t' read -r path caption; do
    printf '%s\n  %s\n' "$caption" "$path"
    if ((${#icat[@]})); then
      "${icat[@]}" --transfer-mode=stream --align=left "$path" <&3
    fi
  done
