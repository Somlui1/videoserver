#!/bin/bash
# ============================================================
# Generate self-signed SSL certificates for development/testing
# For production, use Let's Encrypt (see scripts/setup-letsencrypt.sh)
# ============================================================

set -e

SSL_DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/ssl"
DAYS=365
SUBJECT="/C=TH/ST=Bangkok/O=AAPICO/CN=video-server"

echo "🔐 Generating self-signed SSL certificate..."
echo "   Output directory: $SSL_DIR"

mkdir -p "$SSL_DIR"

openssl req -x509 -nodes \
  -days "$DAYS" \
  -newkey rsa:2048 \
  -keyout "$SSL_DIR/server.key" \
  -out "$SSL_DIR/server.crt" \
  -subj "$SUBJECT" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:0.0.0.0"

chmod 600 "$SSL_DIR/server.key"
chmod 644 "$SSL_DIR/server.crt"

echo ""
echo "✅ SSL certificate generated successfully!"
echo "   Certificate: $SSL_DIR/server.crt"
echo "   Private Key: $SSL_DIR/server.key"
echo "   Valid for:   $DAYS days"
echo ""
echo "⚠️  This is a self-signed certificate."
echo "   Browsers will show a security warning."
echo "   For production, use Let's Encrypt instead."
