#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 22 DO Droplet for CareerPilot HH worker.
# Run as root: bash setup.sh
set -euo pipefail

echo "→ Updating system…"
apt-get update -y
apt-get upgrade -y

echo "→ Installing Docker + compose plugin…"
apt-get install -y ca-certificates curl gnupg ufw fail2ban
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "→ Configuring firewall (allow ssh + 80 + 443 only)…"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "→ Hardening sshd (disable password auth)…"
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd

echo "→ Creating /opt/cp-worker…"
mkdir -p /opt/cp-worker
echo "Now scp the docker-compose.yml, Caddyfile, .env to /opt/cp-worker/ and run:"
echo "  cd /opt/cp-worker && docker compose up -d"
