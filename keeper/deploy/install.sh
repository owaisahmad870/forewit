#!/usr/bin/env bash
# PRESCIENT keeper host install (Ubuntu 24.04 LTS, run as root). Idempotent. Does not touch keys: see keeper/deploy/README.md.
# Usage: bash install.sh <git clone URL using the read only deploy key>
set -euo pipefail
REPO="${1:?usage: install.sh <git clone URL>}"
NODE_VERSION=26.13.1

apt-get update -qq
apt-get install -y -qq git curl xz-utils ca-certificates

# Node from the official tarball, checksum verified
if [ ! -x /opt/prescient/node/bin/node ] || [ "$(/opt/prescient/node/bin/node --version)" != "v$NODE_VERSION" ]; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/node.tar.xz" "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz"
  curl -fsSL -o "$tmp/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  NODE_SHA256=$(grep " node-v$NODE_VERSION-linux-x64.tar.xz\$" "$tmp/SHASUMS256.txt" | cut -d' ' -f1)
  echo "$NODE_SHA256  $tmp/node.tar.xz" | sha256sum -c -
  mkdir -p /opt/prescient/node
  tar -xJf "$tmp/node.tar.xz" -C /opt/prescient/node --strip-components=1
  rm -rf "$tmp"
fi

# Service user and code
id prescient >/dev/null 2>&1 || useradd --system --home /opt/prescient --shell /usr/sbin/nologin prescient
if [ ! -d /opt/prescient/app/.git ]; then git clone --depth 1 "$REPO" /opt/prescient/app; else git -C /opt/prescient/app pull --ff-only; fi
cd /opt/prescient/app
PATH=/opt/prescient/node/bin:$PATH npm ci --no-audit --no-fund
mkdir -p keeper/state keeper/archive indexer/out web/public/data
chown -R prescient:prescient /opt/prescient/app/keeper/state /opt/prescient/app/keeper/archive /opt/prescient/app/indexer/out /opt/prescient/app/web/public/data
chmod 700 keeper/state

# Units
install -m 0644 keeper/deploy/prescient@.service /etc/systemd/system/
for t in daily baseline seal tick watchdog; do install -m 0644 "keeper/deploy/prescient_$t.timer" /etc/systemd/system/; done
mkdir -p /etc/prescient && chmod 700 /etc/prescient
systemctl daemon-reload

if [ ! -f /etc/prescient/keeper.env.cred ]; then
  echo "Next: create the encrypted keeper credential (keeper/deploy/README.md step 4), then rerun this script to enable the timers."
  exit 0
fi
for t in daily baseline seal tick watchdog; do systemctl enable --now "prescient_$t.timer"; done
systemctl list-timers 'prescient*'
