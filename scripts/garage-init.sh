#!/usr/bin/env bash
set -euo pipefail

echo "→ Waiting for Garage to start..."
until docker compose exec -T garage /garage status > /dev/null 2>&1; do sleep 1; done

echo "→ Getting node ID..."
NODE_ID=$(docker compose exec -T garage /garage node id 2>/dev/null | awk 'NR==1{print $1}')

echo "→ Assigning layout (zone=dc1, capacity=1G)..."
docker compose exec -T garage /garage layout assign --zone dc1 --capacity 1G "$NODE_ID"
docker compose exec -T garage /garage layout apply --version 1

echo "→ Creating access key 'gp200editor-key'..."
docker compose exec -T garage /garage key create gp200editor-key

echo "→ Creating bucket 'avatars'..."
docker compose exec -T garage /garage bucket create avatars

echo "→ Granting bucket access..."
docker compose exec -T garage /garage bucket allow avatars --read --write --key gp200editor-key

echo "→ Creating bucket 'presets'..."
docker compose exec -T garage /garage bucket create presets

echo "→ Granting presets bucket access..."
docker compose exec -T garage /garage bucket allow presets --read --write --key gp200editor-key

echo ""
echo "✅ Garage initialized! Add these values to .env.local:"
echo ""
docker compose exec -T garage /garage key info gp200editor-key
