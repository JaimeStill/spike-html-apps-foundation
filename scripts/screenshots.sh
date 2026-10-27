#!/usr/bin/env bash
# mise run screenshots: captures the demo pages on dist/ in every profile and scheme, through
# screenshots.js, into a mktemp -d directory removed on exit unless --keep. Prints each capture's
# caption and path, and shows it inline with kitty's icat when the terminal displays images.
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
