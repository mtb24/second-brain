#!/bin/bash
# =============================================================
# Second Brain — VPS Bootstrap Script
# Target: DigitalOcean Ubuntu 24.04 LTS, 4GB RAM / 2 vCPU
# Run as root on a fresh droplet:
#   bash setup-vps.sh YOUR_SSH_PUBLIC_KEY
# =============================================================

set -euo pipefail

SSH_PUBLIC_KEY="${1:-}"
DEPLOY_USER="brain"

if [ -z "$SSH_PUBLIC_KEY" ]; then
  echo "Usage: bash setup-vps.sh \"ssh-ed25519 AAAA...\""
  exit 1
fi

echo "==> Updating system packages"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> Installing essentials"
apt-get install -y -qq \
  curl wget git unzip ufw fail2ban \
  ca-certificates gnupg lsb-release \
  nginx certbot python3-certbot-nginx \
  htop ncdu

# -------------------------------------------------------------
# Docker
# -------------------------------------------------------------
echo "==> Installing Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y -qq \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

# -------------------------------------------------------------
# Deploy user
# -------------------------------------------------------------
echo "==> Creating deploy user: $DEPLOY_USER"
useradd -m -s /bin/bash "$DEPLOY_USER" || true
usermod -aG docker "$DEPLOY_USER"
usermod -aG sudo "$DEPLOY_USER"

mkdir -p /home/$DEPLOY_USER/.ssh
echo "$SSH_PUBLIC_KEY" >> /home/$DEPLOY_USER/.ssh/authorized_keys
chmod 700 /home/$DEPLOY_USER/.ssh
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh

# Lock down sudo (no password for deploy user — tighten later)
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
chmod 440 /etc/sudoers.d/$DEPLOY_USER

# -------------------------------------------------------------
# Firewall
# -------------------------------------------------------------
echo "==> Configuring UFW firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# -------------------------------------------------------------
# Harden SSH
# -------------------------------------------------------------
echo "==> Hardening SSH"
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# -------------------------------------------------------------
# Ollama
# -------------------------------------------------------------
echo "==> Installing Ollama"
curl -fsSL https://ollama.com/install.sh | sh

# Create systemd override: bind to localhost only
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Restart=always
RestartSec=5
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl start ollama

# Pull models (runs in background — takes a few minutes)
echo "==> Pulling Ollama models (background)"
sudo -u ollama ollama pull nomic-embed-text &
sudo -u ollama ollama pull llama3.2 &

# -------------------------------------------------------------
# Project directory structure
# -------------------------------------------------------------
echo "==> Creating project directories"
mkdir -p /home/$DEPLOY_USER/brain/{ingest-api,ob1,nginx,certs}
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/brain

# -------------------------------------------------------------
# Nginx placeholder config
# -------------------------------------------------------------
cat > /etc/nginx/sites-available/brain << 'EOF'
# Placeholder — replaced by certbot after DNS is pointed at this server
server {
    listen 80;
    server_name _;

    location /health {
        return 200 'ok';
        add_header Content-Type text/plain;
    }

    # Proxy to ingest API
    location /ingest {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy to OB1 MCP server
    location /mcp {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -sf /etc/nginx/sites-available/brain /etc/nginx/sites-enabled/brain
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# -------------------------------------------------------------
# fail2ban
# -------------------------------------------------------------
systemctl enable fail2ban
systemctl start fail2ban

# -------------------------------------------------------------
# Done
# -------------------------------------------------------------
echo ""
echo "=============================================="
echo " VPS bootstrap complete!"
echo "=============================================="
echo ""
echo " Next steps:"
echo " 1. Point your domain DNS A record to this server's IP"
echo " 2. SSH in as: ssh $DEPLOY_USER@<your-server-ip>"
echo " 3. Run certbot: sudo certbot --nginx -d yourdomain.com"
echo " 4. Deploy docker-compose.yml in ~/brain/"
echo ""
echo " Ollama models are still pulling in the background."
echo " Check progress: sudo journalctl -u ollama -f"
echo ""
