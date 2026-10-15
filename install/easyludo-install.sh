#!/usr/bin/env bash
# Exécuté DANS le conteneur par ct/easyludo.sh (peut aussi être lancé seul sur un Debian 12/13 neuf, en root).
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 LC_ALL=C.UTF-8

[ -f /root/easyludo-install.env ] && . /root/easyludo-install.env
REPO="${EASYLUDO_REPO:?EASYLUDO_REPO manquant (utilisateur/depot)}"
BRANCH="${EASYLUDO_BRANCH:-main}"
PORT="${EASYLUDO_PORT:-3000}"
APP_PW="${EASYLUDO_APP_PASSWORD:-}"
GIT_URL="${EASYLUDO_GIT_URL:-https://github.com/${REPO}.git}"
APP_DIR=/opt/easyludo; HOME_DIR=/var/lib/easyludo; DATA_DIR=$HOME_DIR/data

step() { echo -e "\n\e[32m▶ $*\e[0m"; }

step "Paquets système"
apt-get update -qq
apt-get install -y -qq curl ca-certificates git gnupg make g++ python3 sqlite3 openssl >/dev/null

step "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

step "Utilisateur et dossiers"
id easyludo >/dev/null 2>&1 || useradd --system --home-dir "$HOME_DIR" --create-home --shell /usr/sbin/nologin easyludo
install -d -o easyludo -g easyludo -m 750 "$DATA_DIR"
install -d -m 700 "$HOME_DIR/backups"

step "Téléchargement du code ($REPO@$BRANCH)"
rm -rf "$APP_DIR"
git clone --quiet --depth 1 --branch "$BRANCH" "$GIT_URL" "$APP_DIR"
chown -R easyludo:easyludo "$APP_DIR"

step "Installation des dépendances et compilation"
runuser -u easyludo -- env HOME="$HOME_DIR" NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 bash -c "cd $APP_DIR && npm ci --no-audit --no-fund && npm run build"

step "Configuration"
cat > /etc/easyludo.conf <<CONF
EASYLUDO_REPO=$REPO
EASYLUDO_BRANCH=$BRANCH
EASYLUDO_GIT_URL=$GIT_URL
CONF
if [ ! -f /etc/easyludo.env ]; then
  {
    echo "NODE_ENV=production"
    echo "NEXT_TELEMETRY_DISABLED=1"
    echo "PORT=$PORT"
    echo "EASYLUDO_DATA_DIR=$DATA_DIR"
    if [ -n "$APP_PW" ]; then esc=${APP_PW//\\/\\\\}; esc=${esc//\"/\\\"}; echo "EASYLUDO_PASSWORD=\"$esc\""; else echo "# EASYLUDO_PASSWORD=   (sinon : mot de passe créé au premier accès web)"; fi
    echo "# RAWG_API_KEY="
    echo "# IGDB_CLIENT_ID="
    echo "# IGDB_CLIENT_SECRET="
    echo "# PRICECHARTING_TOKEN="
  } > /etc/easyludo.env
fi
chmod 600 /etc/easyludo.env

step "Service systemd"
cat > /etc/systemd/system/easyludo.service <<UNIT
[Unit]
Description=EasyLudo (ludothèque)
After=network-online.target
Wants=network-online.target

[Service]
User=easyludo
Group=easyludo
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/easyludo.env
ExecStart=/usr/bin/node $APP_DIR/node_modules/next/dist/bin/next start -p \${PORT} -H 0.0.0.0
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
UNIT

step "Scripts utilitaires (update, sauvegarde, restauration)"
install -m 755 "$APP_DIR"/install/bin/* /usr/local/bin/
# Raccourcis dans /usr/bin : trouvés aussi par « pct exec » (PATH minimal)
for f in "$APP_DIR"/install/bin/*; do ln -sf "/usr/local/bin/$(basename "$f")" "/usr/bin/$(basename "$f")"; done
cat > /etc/systemd/system/easyludo-backup.service <<'UNIT'
[Unit]
Description=Sauvegarde EasyLudo
[Service]
Type=oneshot
ExecStart=/usr/local/bin/easyludo-backup
UNIT
cat > /etc/systemd/system/easyludo-backup.timer <<'UNIT'
[Unit]
Description=Sauvegarde quotidienne EasyLudo
[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
[Install]
WantedBy=timers.target
UNIT

cat > /etc/motd <<MOTD

  🎮 EasyLudo — ludothèque
  Application   : http://$(hostname -I | awk '{print $1}'):$PORT
  Mise à jour   : update
  Sauvegarde    : easyludo-backup   (archives : /var/lib/easyludo/backups)
  Restauration  : easyludo-restore <archive>
  Réglages/clés : /etc/easyludo.env  (puis : systemctl restart easyludo)
  Journal       : journalctl -u easyludo -f

MOTD

systemctl daemon-reload
systemctl enable --now easyludo easyludo-backup.timer >/dev/null 2>&1
/usr/local/bin/update --setup   # active aussi la mise à jour depuis l'interface

step "Vérification"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login" || true)
  [ "$code" = 200 ] && { echo "L'application répond (HTTP 200)."; exit 0; }
  sleep 1
done
journalctl -u easyludo -n 30 --no-pager || true
echo "L'application ne répond pas." >&2; exit 1
