#!/bin/bash
# Force rebuild and redeploy

: "${DOCKERHUB_TOKEN:?Set DOCKERHUB_TOKEN before deploying}"
: "${VPS_HOST:?Set VPS_HOST before deploying}"
: "${VPS_PASSWORD:?Set VPS_PASSWORD before deploying}"

echo "=== Force rebuild Docker image ==="
docker build --no-cache -t thichcuu/rutgonlink:force-$(date +%s) .

echo ""
echo "=== Push to Docker Hub ==="
echo "$DOCKERHUB_TOKEN" | docker login -u "thichcuu" --password-stdin
docker tag thichcuu/rutgonlink:force-$(date +%s) thichcuu/rutgonlink:latest
docker push thichcuu/rutgonlink:latest

echo ""
echo "=== Deploy to VPS ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "root@$VPS_HOST" "
  cd /root/boc-link
  docker compose down app
  docker rmi thichcuu/rutgonlink:latest -f
  docker compose pull app
  docker compose up -d app
  sleep 30
  docker exec boc-link-app npx prisma migrate deploy
  docker ps --filter 'name=boc-link'
"

echo ""
echo "=== Done ==="
