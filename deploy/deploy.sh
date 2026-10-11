#!/usr/bin/env bash
# Envoie le site sur le serveur Hetzner.
#
#   ./deploy/deploy.sh atlas@203.0.113.10
#
# N'écrase jamais assets/data/players.json : cet instantané est produit
# sur le serveur par la tâche planifiée, il ne doit pas revenir d'ici.
set -euo pipefail

TARGET="${1:?Usage: ./deploy/deploy.sh utilisateur@serveur}"
REMOTE_DIR="${2:-/var/www/atlas-performance}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Déploiement de $SRC vers $TARGET:$REMOTE_DIR"

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'docs' \
  --exclude 'deploy' \
  --exclude 'assets/data/players.json' \
  "$SRC/" "$TARGET:$REMOTE_DIR/"

echo "Terminé. Vérifiez : curl -I https://votre-domaine/"
