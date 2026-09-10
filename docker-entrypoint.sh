#!/bin/sh
# Runs as root: the Fly volume mounted at /data is root-owned on first boot,
# so fix ownership, then drop to the unprivileged app user.
set -e
mkdir -p /data/workspaces
chown -R rhea:rhea /data
exec gosu rhea "$@"
