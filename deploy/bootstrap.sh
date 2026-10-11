#!/usr/bin/env bash
# =============================================================================
# Atlas Performance — installation complète sur un serveur Ubuntu/Debian neuf.
#
# À lancer EN ROOT sur le serveur Hetzner (SSH ou console web Hetzner) :
#
#   curl -fsSL https://raw.githubusercontent.com/khalidmankour-ctrl/try3/main/deploy/bootstrap.sh | bash
#
# Le script s'arrête une seule fois pour vous demander la clé API-Football.
# Elle est saisie en aveugle, écrite dans /etc/atlas-performance.env en 600,
# et n'apparaît ni à l'écran, ni dans l'historique, ni dans les journaux.
#
# Relançable sans risque : il ne détruit rien d'existant.
# =============================================================================
set -euo pipefail

REPO="https://github.com/khalidmankour-ctrl/try3.git"
DIR="/var/www/atlas-performance"
ENVF="/etc/atlas-performance.env"

c()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '    \033[32m✓\033[0m %s\n' "$*"; }
no() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || no "À lancer en root (sudo -i)."

# --------------------------------------------------------------- 1. paquets
c "1/7 Installation des paquets"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg debian-keyring \
                       debian-archive-keyring apt-transport-https >/dev/null

if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 18 ] 2>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v)"

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
ok "Caddy $(caddy version | head -1)"

# ------------------------------------------------------------- 2. le site
c "2/7 Récupération du site"
id -u atlas >/dev/null 2>&1 || adduser --system --group --home "$DIR" --no-create-home atlas
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --quiet origin main && git -C "$DIR" reset --quiet --hard origin/main
  ok "Mis à jour depuis GitHub"
else
  mkdir -p "$DIR" && git clone --quiet --depth 1 "$REPO" "$DIR"
  ok "Cloné depuis GitHub"
fi
mkdir -p "$DIR/assets/data"
chown -R atlas:atlas "$DIR"

# --------------------------------------------------------------- 3. la clé
c "3/7 Clé API-Football"
if [ -s "$ENVF" ] && grep -q '^API_FOOTBALL_KEY=.\+' "$ENVF" \
   && ! grep -q 'collez_votre_cle_ici' "$ENVF"; then
  ok "Clé déjà en place dans $ENVF — on garde celle-ci."
else
  echo "    Récupérez-la sur https://dashboard.api-football.com → Account → My Access"
  echo "    La saisie est invisible, c'est normal. Collez puis Entrée."
  printf '    Clé : '
  read -rs APIKEY < /dev/tty
  echo
  [ -n "$APIKEY" ] || no "Clé vide, rien n'a été écrit."
  umask 077
  printf 'API_FOOTBALL_KEY=%s\n' "$APIKEY" > "$ENVF"
  chmod 600 "$ENVF"; chown root:root "$ENVF"
  unset APIKEY
  ok "Écrite dans $ENVF (lisible par root uniquement)"
fi

# ------------------------------------------------- 4. identifiants joueurs
c "4/7 Identifiants des joueurs"
set -a; . "$ENVF"; set +a
if grep -q '"apiId": *[0-9]' "$DIR/scripts/players-map.json"; then
  ok "Déjà renseignés — étape sautée (économise le quota)."
else
  echo "    Recherche par nom, ~32 requêtes, environ 4 minutes…"
  ( cd "$DIR" && node scripts/fetch-stats.mjs --discover ) || \
    echo "    (échec partiel : vous pourrez relancer plus tard)"
  chown atlas:atlas "$DIR/scripts/players-map.json" 2>/dev/null || true
fi

# ------------------------------------------------------ 5. premières stats
c "5/7 Première récupération des statistiques"
( cd "$DIR" && node scripts/fetch-stats.mjs ) || \
  echo "    (échec : le site restera en mode démo jusqu'au prochain passage)"
chown atlas:atlas "$DIR/assets/data/players.json" 2>/dev/null || true

# ----------------------------------------------------- 6. tâche quotidienne
c "6/7 Rafraîchissement quotidien"
install -m 644 "$DIR/deploy/atlas-stats.service" /etc/systemd/system/
install -m 644 "$DIR/deploy/atlas-stats.timer"   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now atlas-stats.timer >/dev/null
ok "Minuteur actif — $(systemctl show -p NextElapseUSecRealtime --value atlas-stats.timer)"

# ------------------------------------------------------------- 7. serveur web
c "7/7 Mise en ligne"
echo "    Domaine pointant déjà sur ce serveur ? Laissez vide pour servir en HTTP sur l'IP."
printf '    Domaine (ex. atlas.mondomaine.fr) : '
read -r DOMAIN < /dev/tty || DOMAIN=""

if [ -n "$DOMAIN" ]; then
  sed "s|atlas.example.com|$DOMAIN|" "$DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
  URL="https://$DOMAIN"
else
  sed "s|atlas.example.com {|:80 {|" "$DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
  URL="http://$(curl -fsS --max-time 5 https://ifconfig.me || echo "IP-DU-SERVEUR")"
fi
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy
ok "Caddy rechargé"

printf '\n\033[1;32m================================================\033[0m\n'
printf '  Site en ligne : \033[1m%s\033[0m\n' "$URL"
printf '\033[1;32m================================================\033[0m\n\n'
echo "  Journal de la tâche : journalctl -u atlas-stats.service -n 30"
echo "  Prochaine exécution : systemctl list-timers atlas-stats.timer"
echo "  Mise à jour du site : bash $DIR/deploy/bootstrap.sh"
[ -n "$DOMAIN" ] || echo "  Pensez au pare-feu Hetzner : ports 80 et 443 ouverts en entrée."
