#!/usr/bin/env bash
# Chạy trên server, từ thư mục gốc repo: ./deploy/redeploy-worker.sh
# Kéo code mới, build lại, thay container worker — giữ image cũ để rollback nếu cần.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull
docker compose -p roadmap -f deploy/docker-compose.worker.yml up -d --build

echo "--- Container đang chạy ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAMES|roadmap"
