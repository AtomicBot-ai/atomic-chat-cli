#!/usr/bin/env sh
# Install a released `atc` (a single binary) from GitHub Releases. Adapted from atomic-agent.
#
# Usage:
#   curl -fsSL https://github.com/AtomicBot-ai/atomic-chat-cli/releases/latest/download/install.sh | sh
#
# Environment:
#   ATC_REPO=owner/repo      (default: AtomicBot-ai/atomic-chat-cli)
#   ATC_VERSION=v0.1.0       (optional: pin a tag; default: latest)
#   ATC_INSTALL_DIR=path     (default: $HOME/.local/bin)
#   ATC_NO_PATH=1            (optional: skip the rc-file PATH update)

set -eu

REPO="${ATC_REPO:-AtomicBot-ai/atomic-chat-cli}"
VERSION="${ATC_VERSION:-}"
INSTALL_DIR="${ATC_INSTALL_DIR:-$HOME/.local/bin}"

OS_NAME="$(uname -s)"
MACHINE="$(uname -m)"
case "$OS_NAME" in
  Darwin) OS_SLUG="apple-darwin" ;;
  Linux) OS_SLUG="unknown-linux-gnu" ;;
  *) echo "unsupported OS: $OS_NAME (on Windows use install.ps1)" >&2; exit 1 ;;
esac
case "$MACHINE" in
  arm64|aarch64) ARCH="aarch64" ;;
  x86_64|amd64) ARCH="x86_64" ;;
  *) echo "unsupported arch: $MACHINE" >&2; exit 1 ;;
esac
TRIPLE="${ARCH}-${OS_SLUG}"

download() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL --retry 3 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"
  else echo "install curl or wget" >&2; exit 1; fi
}

BASE="https://github.com/${REPO}"
if [ -n "$VERSION" ]; then RELEASE="${BASE}/releases/download/${VERSION}"; else RELEASE="${BASE}/releases/latest/download"; fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/atc-install.XXXXXX")"
# shellcheck disable=SC2064
trap 'rm -rf "$WORK"' EXIT

echo "resolving the ${VERSION:-latest} release of ${REPO} …"
download "${RELEASE}/SHA256SUMS" "$WORK/SHA256SUMS"
ASSET="$(awk -v t="$TRIPLE" '$2 ~ ("^atc-.*-" t "$") { print $2 }' "$WORK/SHA256SUMS" | head -n 1)"
if [ -z "$ASSET" ]; then
  echo "no binary for ${TRIPLE} in this release; assets:" >&2
  awk '{ print "  " $2 }' "$WORK/SHA256SUMS" >&2
  exit 1
fi

echo "downloading ${ASSET} …"
download "${RELEASE}/${ASSET}" "$WORK/${ASSET}"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$WORK" && grep " ${ASSET}\$" SHA256SUMS | sha256sum -c -)
elif command -v shasum >/dev/null 2>&1; then
  (cd "$WORK" && grep " ${ASSET}\$" SHA256SUMS | shasum -a 256 -c -)
else
  echo "warning: no sha256sum/shasum; skipping the checksum" >&2
fi

mkdir -p "$INSTALL_DIR"
# Never overwrite the inode a running `atc` executes from: copy beside it, then rename over it.
TMP_BIN="$INSTALL_DIR/.atc.tmp.$$"
cp -f "$WORK/${ASSET}" "$TMP_BIN"
chmod 755 "$TMP_BIN"
mv -f "$TMP_BIN" "$INSTALL_DIR/atc"

add_to_path() {
  case ":${PATH:-}:" in *":$1:"*) PATH_STATUS="present"; return 0 ;; esac
  if [ "${ATC_NO_PATH:-0}" = "1" ]; then PATH_STATUS="manual"; return 0; fi
  if [ "$1" = "$HOME/.local/bin" ]; then EXPR='$HOME/.local/bin'; else EXPR="$1"; fi
  case "$(basename "${SHELL:-sh}")" in
    zsh) RC="$HOME/.zshrc"; LINE="export PATH=\"${EXPR}:\$PATH\"" ;;
    bash) if [ "$OS_NAME" = "Darwin" ]; then RC="$HOME/.bash_profile"; else RC="$HOME/.bashrc"; fi; LINE="export PATH=\"${EXPR}:\$PATH\"" ;;
    fish) RC="$HOME/.config/fish/config.fish"; LINE="set -gx PATH ${EXPR} \$PATH" ;;
    *) RC="$HOME/.profile"; LINE="export PATH=\"${EXPR}:\$PATH\"" ;;
  esac
  MARKER="# added by atc installer"
  mkdir -p "$(dirname "$RC")"; [ -f "$RC" ] || : > "$RC"
  if grep -qsF "$MARKER" "$RC"; then PATH_STATUS="present"; return 0; fi
  printf '\n%s\n%s\n' "$MARKER" "$LINE" >> "$RC"
  PATH_STATUS="added:$RC"
}
PATH_STATUS="present"
add_to_path "$INSTALL_DIR"

echo
echo "installed atc to ${INSTALL_DIR}/atc ($("$INSTALL_DIR/atc" --version 2>/dev/null || echo "$ASSET"))"
case "$PATH_STATUS" in
  present) ;;
  manual) echo "add ${INSTALL_DIR} to your PATH: export PATH=\"${INSTALL_DIR}:\$PATH\"" ;;
  added:*) echo "PATH updated in ${PATH_STATUS#added:}; open a new terminal (or source it)" ;;
esac
echo
echo "next:"
echo "  atc doctor                     # check the machine"
echo "  atc serve Qwen/Qwen3-8B-GGUF   # pull a model and serve http://127.0.0.1:1337/v1"
echo "  atc admin                      # the web admin"
