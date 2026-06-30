#!/usr/bin/env bash
# One-shot deploy for a fresh Ubuntu EC2. Run from the repo root after cloning:
#   git clone https://github.com/AjayLuhach/edtech-doc-editor.git && cd edtech-doc-editor
#   bash scripts/deploy-ec2.sh
# Serves the app on port 3000 (open inbound TCP 3000 in the EC2 security group).
set -euo pipefail

echo "==> Installing Node 20, Docker, git"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates git
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sudo sh

echo "==> Adding 2G swap if RAM is small (Next build needs memory)"
if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2500 ]; then
  sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
fi

echo "==> Writing .env.local (if missing)"
if [ ! -f .env.local ]; then
  cat > .env.local <<EOF
DATABASE_URL=postgres://app_user:app_password@localhost:5432/edtech_doc_editor
MIGRATION_DATABASE_URL=postgres://postgres:postgres@localhost:5432/edtech_doc_editor
AUTH_SECRET=$(openssl rand -base64 32)
COOKIE_SECURE=false
EOF
fi

echo "==> Starting Postgres (Docker) and applying migrations"
sudo docker compose up -d
for _ in $(seq 1 30); do
  [ "$(sudo docker inspect -f '{{.State.Health.Status}}' edtech-doc-db 2>/dev/null)" = "healthy" ] && break
  sleep 2
done
npm ci
npm run db:migrate

echo "==> Building and starting under pm2"
npm run build
sudo npm install -g pm2
pm2 delete edtech-doc >/dev/null 2>&1 || true
pm2 start npm --name edtech-doc -- run start
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

IP=$(curl -s --max-time 3 http://169.254.169.254/latest/meta-data/public-ipv4 || echo "<EC2_PUBLIC_IP>")
echo ""
echo "==> Done. Open inbound TCP 3000 in the security group, then visit:"
echo "    http://${IP}:3000"
