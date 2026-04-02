#!/bin/bash
# ============================================================
# Setup Let's Encrypt SSL certificates using Certbot
# 
# Prerequisites:
#   1. Your domain must point to this server's public IP
#   2. Port 80 must be open (for ACME HTTP-01 challenge)
#   3. Set SERVER_DOMAIN and LETSENCRYPT_EMAIL in .env
# ============================================================

set -e

# Load environment
if [ -f .env ]; then
  source .env
fi

DOMAIN="${SERVER_DOMAIN:?'SERVER_DOMAIN must be set in .env'}"
EMAIL="${LETSENCRYPT_EMAIL:?'LETSENCRYPT_EMAIL must be set in .env'}"
SSL_DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/ssl"

echo "🌐 Setting up Let's Encrypt for domain: $DOMAIN"

# Step 1: Generate temporary self-signed cert so nginx can start
echo "📋 Step 1: Creating temporary certificate..."
mkdir -p "$SSL_DIR"
openssl req -x509 -nodes -days 1 \
  -newkey rsa:2048 \
  -keyout "$SSL_DIR/server.key" \
  -out "$SSL_DIR/server.crt" \
  -subj "/CN=$DOMAIN" 2>/dev/null

# Step 2: Start nginx (needs cert to start)
echo "📋 Step 2: Starting nginx..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx

# Wait for nginx to be ready
sleep 3

# Step 3: Run certbot
echo "📋 Step 3: Requesting certificate from Let's Encrypt..."
docker run --rm \
  -v "$(pwd)/nginx/ssl:/etc/letsencrypt/live/$DOMAIN" \
  -v "certbot-webroot:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal

# Step 4: Copy certs to nginx ssl directory
echo "📋 Step 4: Installing certificates..."
cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/server.crt"
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/server.key"

# Step 5: Reload nginx with real cert
echo "📋 Step 5: Reloading nginx..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload

echo ""
echo "✅ Let's Encrypt certificate installed!"
echo "   Domain: $DOMAIN"
echo ""
echo "📌 To auto-renew, add this to crontab:"
echo "   0 3 * * * cd $(pwd) && bash scripts/renew-letsencrypt.sh"
