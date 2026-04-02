#!/bin/bash
# ============================================================
# Renew Let's Encrypt SSL certificates
# Add to crontab: 0 3 * * * cd /path/to/video_server && bash scripts/renew-letsencrypt.sh
# ============================================================

set -e

if [ -f .env ]; then
  source .env
fi

DOMAIN="${SERVER_DOMAIN:?'SERVER_DOMAIN must be set in .env'}"
SSL_DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/ssl"

echo "🔄 Attempting Let's Encrypt renewal for $DOMAIN..."

docker run --rm \
  -v "certbot-data:/etc/letsencrypt" \
  -v "certbot-webroot:/var/www/certbot" \
  certbot/certbot renew --quiet

# Copy renewed certs
cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/server.crt"
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/server.key"

# Reload nginx
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload

echo "✅ Renewal check complete."
