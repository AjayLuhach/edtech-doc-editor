#!/usr/bin/env bash
# One-shot deploy for a fresh EC2 (Amazon Linux 2023 or Ubuntu). Run from the repo root:
#   git clone https://github.com/AjayLuhach/edtech-doc-editor.git && cd edtech-doc-editor
#   bash scripts/deploy-ec2.sh
# Serves on port 3000 — open inbound TCP 3000 in the EC2 security group.
set -euo pipefail

if command -v dnf >/dev/null 2>&1; then PM=dnf; else PM=apt; fi
echo "==> Package manager: $PM"

echo "==> Installing Node 20, git, docker"
if [ "$PM" = "dnf" ]; then
  sudo dnf install -y git docker
  command -v node >/dev/null 2>&1 || sudo dnf install -y nodejs20
else
  sudo apt-get update -y && sudo apt-get install -y curl ca-certificates git
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
  fi
  command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sudo sh
fi
sudo systemctl enable --now docker

echo "==> Add 2G swap if RAM is small"
if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2500 ]; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
fi

echo "==> Starting Postgres container"
sudo docker rm -f edtech-doc-db >/dev/null 2>&1 || true
sudo docker run -d --name edtech-doc-db --restart unless-stopped \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=edtech_doc_editor \
  -p 5432:5432 postgres:16-alpine
echo "   waiting for Postgres..."
for _ in $(seq 1 30); do sudo docker exec edtech-doc-db pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done

echo "==> Writing .env.local (if missing)"
if [ ! -f .env.local ]; then
  cat > .env.local <<EOF
DATABASE_URL=postgres://app_user:app_password@localhost:5432/edtech_doc_editor
MIGRATION_DATABASE_URL=postgres://postgres:postgres@localhost:5432/edtech_doc_editor
AUTH_SECRET=$(openssl rand -base64 32)
COOKIE_SECURE=false
EOF
fi

echo "==> Install deps, migrate, build"
npm install --no-audit --no-fund
npm run db:migrate
npm run build

echo "==> Starting under pm2"
sudo npm install -g pm2
pm2 delete edtech-doc >/dev/null 2>&1 || true
pm2 start npm --name edtech-doc -- run start
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

IP=$(curl -s --max-time 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "<EC2_PUBLIC_IP>")
echo ""
echo "==> Done → http://${IP}:3000  (open inbound TCP 3000 in the security group)"
