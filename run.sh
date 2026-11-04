#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ "$#" -eq 0 ]; then set -- --open; fi
valid_node() { "$1" -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)' >/dev/null 2>&1; }
if command -v node >/dev/null 2>&1 && valid_node node; then exec node server.mjs "$@"; fi
VERSION=22.23.1
case "$(uname -s)" in Darwin) OS=darwin;; Linux) OS=linux;; *) echo 'Use run.bat on Windows.' >&2; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) ARCH=arm64;; x86_64|amd64) ARCH=x64;; *) echo 'Install Node.js 22 or newer for your architecture.' >&2; exit 1;; esac
DIR="node-v$VERSION-$OS-$ARCH"
NODE=".tools/$DIR/bin/node"
if ! test -x "$NODE" || ! valid_node "$NODE"; then
  command -v curl >/dev/null 2>&1 || { echo 'Install Node.js 22+ or curl, then retry.' >&2; exit 1; }
  mkdir -p .tools
  ARCHIVE="$DIR.tar.gz"
  BASE="https://nodejs.org/dist/v$VERSION"
  echo "Downloading official Node.js $VERSION ($OS $ARCH)…"
  curl --fail --location --retry 2 --proto '=https' --tlsv1.2 "$BASE/$ARCHIVE" -o ".tools/$ARCHIVE"
  curl --fail --location --retry 2 --proto '=https' --tlsv1.2 "$BASE/SHASUMS256.txt" -o .tools/SHASUMS256.txt
  EXPECTED=$(awk -v file="$ARCHIVE" '$2 == file {print $1}' .tools/SHASUMS256.txt)
  test -n "$EXPECTED" || { echo 'Archive is absent from official checksums.' >&2; exit 1; }
  if command -v shasum >/dev/null 2>&1; then ACTUAL=$(shasum -a 256 ".tools/$ARCHIVE" | awk '{print $1}'); else ACTUAL=$(sha256sum ".tools/$ARCHIVE" | awk '{print $1}'); fi
  test "$ACTUAL" = "$EXPECTED" || { rm -f ".tools/$ARCHIVE"; echo 'Node.js checksum mismatch. Retry.' >&2; exit 1; }
  tar -xzf ".tools/$ARCHIVE" -C .tools
  rm -f ".tools/$ARCHIVE" .tools/SHASUMS256.txt
fi
exec "$NODE" server.mjs "$@"
