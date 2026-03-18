# Phase 1 — Step by Step Guide
## VPS + OB1 + Ollama on DigitalOcean

---

## Step 1 — Create your Droplet

1. Go to cloud.digitalocean.com → Create → Droplets
2. **Region:** Choose closest to you (New York, San Francisco, London, etc.)
3. **Image:** Ubuntu 24.04 LTS x64
4. **Size:** Basic → Regular → **4GB RAM / 2 vCPU / 80GB SSD** (~$24/mo)
5. **Authentication:** SSH Key — paste your public key
   - On your Mac/Linux: `cat ~/.ssh/id_ed25519.pub`
   - If you don't have one: `ssh-keygen -t ed25519`
6. **Hostname:** `brain-vps`
7. Click **Create Droplet** — note the IP address

---

## Step 2 — Run the bootstrap script

From your local machine:

```bash
# Copy the setup script to the droplet
scp setup-vps.sh root@YOUR_SERVER_IP:~/

# SSH in as root (first and last time)
ssh root@YOUR_SERVER_IP

# Run the bootstrap (paste your SSH public key as the argument)
bash setup-vps.sh "ssh-ed25519 AAAA...your-key-here"

# Exit root session
exit
```

From now on, always SSH as the deploy user:
```bash
ssh brain@YOUR_SERVER_IP
```

---

## Step 3 — Point a domain at your server

You need a domain for SSL. Options:
- Use a subdomain of something you own: `brain.yourdomain.com`
- Get a free domain: freenom.com or use a DigitalOcean subdomain

In your DNS settings, add an **A record**:
```
brain.yourdomain.com  →  YOUR_SERVER_IP  (TTL: 300)
```

Wait 5 minutes, then verify:
```bash
ping brain.yourdomain.com
# Should resolve to your server IP
```

---

## Step 4 — Get SSL certificate

```bash
ssh brain@YOUR_SERVER_IP
sudo certbot --nginx -d brain.yourdomain.com
# Follow prompts, enter your email, agree to terms
# Choose option 2 (redirect HTTP to HTTPS)
```

Test it: `curl https://brain.yourdomain.com/health`
Should return: `ok`

---

## Step 5 — Deploy the stack

```bash
ssh brain@YOUR_SERVER_IP
cd ~/brain

# Copy files (from your local machine, in a separate terminal):
# scp docker-compose.yml brain@YOUR_SERVER_IP:~/brain/
# scp .env.example brain@YOUR_SERVER_IP:~/brain/
# scp litestream.yml brain@YOUR_SERVER_IP:~/brain/
# scp -r ob1/ brain@YOUR_SERVER_IP:~/brain/

# Back on the server — set up your env file
cp .env.example .env
nano .env
# Fill in:
#   POSTGRES_PASSWORD — run: openssl rand -hex 16
#   API_SECRET        — run: openssl rand -hex 32
#   MCP_SECRET        — run: openssl rand -hex 32
#   B2_KEY_ID + B2_APP_KEY — from backblaze.com
#   DOMAIN            — brain.yourdomain.com

# Start the database first
docker compose up -d db
sleep 10

# Verify DB is healthy
docker compose ps

# Start everything
docker compose up -d
```

---

## Step 6 — Verify Ollama models loaded

```bash
# Check model pull progress (started in background during setup)
sudo journalctl -u ollama -f
# Wait until you see both models confirmed

# Test Ollama directly
curl http://localhost:11434/api/tags
# Should list: nomic-embed-text, llama3.2
```

---

## Step 7 — Smoke test the whole stack

```bash
# Test DB
docker compose exec db psql -U brain -d brain -c "\dt"
# Should show: thoughts, thought_links, strategies, strategy_runs

# Test Ollama embedding (from server)
curl http://localhost:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"hello world"}'
# Should return a 768-dimension vector

# Test Nginx proxy
curl https://brain.yourdomain.com/health
# Should return: ok
```

If all three pass — **Phase 1 is done.** 🎉

---

## What you now have

```
DigitalOcean Droplet (Ubuntu 24.04)
├── Nginx (HTTPS proxy)
├── Docker
│   ├── Postgres 16 + pgvector  ← OB1 database with full schema
│   ├── Litestream               ← streaming backup to Backblaze B2
│   ├── ingest-api               ← placeholder (built in Phase 2)
│   └── mcp-server               ← placeholder (built in Phase 4)
└── Ollama (host)
    ├── nomic-embed-text         ← for embeddings
    └── llama3.2                 ← for classification + chat
```

---

## Next: Phase 2 — Ingest API

Open the `phase2-cursor-prompt.md` file and paste its contents
directly into **Cursor Composer** in a new empty project folder.
Cursor will scaffold the entire ingest API for you.
