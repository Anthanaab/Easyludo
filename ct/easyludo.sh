#!/usr/bin/env bash
# EasyLudo — crée un conteneur LXC Proxmox VE tout-en-un (Debian 12 + Node 22 + service systemd).
# À lancer depuis le shell de l'hôte Proxmox :
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anthanaab/Easyludo/main/ct/easyludo.sh)"
#
# Variables optionnelles (mode non interactif) : var_ctid var_hostname var_cpu var_ram var_disk
#   var_brg var_ip var_gw var_storage var_port var_app_password EASYLUDO_REPO EASYLUDO_BRANCH
set -Eeuo pipefail

REPO="${EASYLUDO_REPO:-Anthanaab/Easyludo}"
BRANCH="${EASYLUDO_BRANCH:-main}"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
APP="EasyLudo"

C_G=$'\e[32m'; C_Y=$'\e[33m'; C_R=$'\e[31m'; C_B=$'\e[1m'; C_0=$'\e[0m'
info() { echo "${C_G}●${C_0} $*"; }
warn() { echo "${C_Y}!${C_0} $*"; }
die()  { echo "${C_R}✗ $*${C_0}" >&2; exit 1; }

CTID_CREATED=""; TMP=""
on_exit() {
  local rc=$?
  [ -n "$TMP" ] && rm -rf "$TMP"
  if [ $rc -ne 0 ] && [ -n "$CTID_CREATED" ]; then
    echo; echo "${C_R}✗ Échec de l'installation.${C_0} Le conteneur $CTID_CREATED a été conservé pour diagnostic :"
    echo "    pct enter $CTID_CREATED      # puis : journalctl -u easyludo -n 50"
    echo "    pct stop $CTID_CREATED && pct destroy $CTID_CREATED      # pour le supprimer"
  fi
}
trap on_exit EXIT

# ---------- Vérifications ----------
[ "$(id -u)" -eq 0 ] || die "Lance ce script en root sur l'hôte Proxmox."
command -v pct >/dev/null && command -v pveam >/dev/null || die "Ce script doit être exécuté sur un hôte Proxmox VE."
[ "$(dpkg --print-architecture)" = "amd64" ] || die "Seule l'architecture amd64 est prise en charge."
curl -fsSI "$RAW/install/easyludo-install.sh" >/dev/null || die "Script d'installation introuvable : $RAW/install/easyludo-install.sh (dépôt public ? branche $BRANCH ?)"

# ---------- Réglages ----------
CTID="${var_ctid:-$(pvesh get /cluster/nextid)}"
HN="${var_hostname:-easyludo}"; CORES="${var_cpu:-2}"; RAM="${var_ram:-2048}"; DISK="${var_disk:-8}"
BRG="${var_brg:-vmbr0}"; IPCFG="${var_ip:-dhcp}"; GW="${var_gw:-}"; PORT="${var_port:-3000}"
APP_PW="${var_app_password:-}"; CSTORE="${var_storage:-}"

first_storage() { pvesm status -content "$1" 2>/dev/null | awk 'NR>1 {print $1; exit}'; }
pick_storage() { # $1=contenu $2=libellé
  local list; mapfile -t list < <(pvesm status -content "$1" | awk 'NR>1 {print $1}')
  [ "${#list[@]}" -gt 0 ] || die "Aucun stockage Proxmox avec le contenu « $1 »."
  if [ "${#list[@]}" -eq 1 ] || ! command -v whiptail >/dev/null; then echo "${list[0]}"; return; fi
  local menu=() s; for s in "${list[@]}"; do menu+=("$s" ""); done
  whiptail --title "$APP" --menu "$2" 16 60 6 "${menu[@]}" 3>&1 1>&2 2>&3
}
ask() { whiptail --title "$APP" --inputbox "$1" 10 64 "$2" 3>&1 1>&2 2>&3; }

if [ -t 0 ] && command -v whiptail >/dev/null && [ -z "${var_ctid:-}${var_hostname:-}" ]; then
  MODE=$(whiptail --title "$APP — conteneur LXC" --menu "Mode d'installation" 14 64 2 \
    default "Réglages par défaut (recommandé)" advanced "Réglages avancés" 3>&1 1>&2 2>&3) || exit 0
  if [ "$MODE" = advanced ]; then
    CTID=$(ask "ID du conteneur" "$CTID"); HN=$(ask "Nom d'hôte" "$HN")
    CORES=$(ask "Cœurs CPU" "$CORES"); RAM=$(ask "RAM en Mo (2048 conseillé : la compilation en a besoin)" "$RAM")
    DISK=$(ask "Disque en Go" "$DISK"); BRG=$(ask "Pont réseau" "$BRG")
    IPCFG=$(ask "Adresse IP : « dhcp » ou CIDR (ex. 192.168.1.50/24)" "$IPCFG")
    [ "$IPCFG" = dhcp ] || GW=$(ask "Passerelle (ex. 192.168.1.1)" "$GW")
    PORT=$(ask "Port de l'application" "$PORT")
    CSTORE=$(pick_storage rootdir "Stockage du conteneur")
    APP_PW=$(ask "Mot de passe de l'app (laisser vide = à créer au premier accès web)" "$APP_PW")
  fi
fi
[ -n "$CSTORE" ] || CSTORE=$(first_storage rootdir)
[ -n "$CSTORE" ] || die "Aucun stockage disponible pour les conteneurs."
TSTORE=$(first_storage vztmpl); [ -n "$TSTORE" ] || die "Aucun stockage de modèles (vztmpl)."
[[ "$CTID" =~ ^[0-9]+$ ]] || die "ID invalide : $CTID"
[[ "$PORT" =~ ^[0-9]+$ ]] || die "Port invalide : $PORT"
[ -z "$APP_PW" ] || [ "${#APP_PW}" -ge 8 ] || die "Le mot de passe de l'app doit faire au moins 8 caractères."
pct status "$CTID" >/dev/null 2>&1 && die "Le conteneur $CTID existe déjà."
NETCFG="name=eth0,bridge=$BRG,ip=$IPCFG${GW:+,gw=$GW}"
ROOTPW=$(openssl rand -hex 8)

# ---------- Modèle Debian 12 ----------
info "Recherche du modèle Debian 12…"
pveam update >/dev/null 2>&1 || warn "pveam update a échoué, utilisation de la liste en cache."
TEMPLATE=$(pveam available --section system | awk '$2 ~ /^debian-12-standard/ {print $2}' | sort -V | tail -1)
[ -n "$TEMPLATE" ] || die "Modèle Debian 12 introuvable."
TLIST=$(pveam list "$TSTORE" || true)
grep -q "$TEMPLATE" <<<"$TLIST" || { info "Téléchargement de $TEMPLATE…"; pveam download "$TSTORE" "$TEMPLATE" >/dev/null; }

# ---------- Création ----------
info "Création du conteneur $CTID ($HN) : ${CORES} CPU, ${RAM} Mo, ${DISK} Go sur $CSTORE"
pct create "$CTID" "${TSTORE}:vztmpl/${TEMPLATE}" \
  --hostname "$HN" --cores "$CORES" --memory "$RAM" --swap 512 \
  --rootfs "${CSTORE}:${DISK}" --net0 "$NETCFG" \
  --unprivileged 1 --features nesting=1 --onboot 1 --tags easyludo \
  --password "$ROOTPW" --description "EasyLudo — ludothèque de jeux vidéo (https://github.com/${REPO})" >/dev/null
CTID_CREATED="$CTID"
pct start "$CTID"

info "Attente du réseau…"
for _ in $(seq 1 40); do pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break; sleep 2; done
pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 || die "Le conteneur n'a pas d'accès réseau/DNS (pont $BRG, DHCP ?)."

# ---------- Installation dans le conteneur ----------
TMP=$(mktemp -d)
curl -fsSL "$RAW/install/easyludo-install.sh" -o "$TMP/install.sh"
umask 077
{ printf 'EASYLUDO_REPO=%q\nEASYLUDO_BRANCH=%q\nEASYLUDO_PORT=%q\nEASYLUDO_APP_PASSWORD=%q\n' "$REPO" "$BRANCH" "$PORT" "$APP_PW"; } > "$TMP/install.env"
pct push "$CTID" "$TMP/install.sh" /root/easyludo-install.sh --perms 0700
pct push "$CTID" "$TMP/install.env" /root/easyludo-install.env --perms 0600
info "Installation d'$APP dans le conteneur (compilation : quelques minutes)…"
pct exec "$CTID" -- bash /root/easyludo-install.sh
pct exec "$CTID" -- rm -f /root/easyludo-install.sh /root/easyludo-install.env

IP=$(pct exec "$CTID" -- hostname -I | awk '{print $1}')
CTID_CREATED=""
echo
echo "${C_G}${C_B}✔ $APP est installé !${C_0}"
echo "  Adresse            : ${C_B}https://${IP}${C_0}   (HTTPS uniquement : le port ${PORT} n'est plus accessible)"
echo "  ${C_Y}Au premier acces, le navigateur affiche un avertissement : c'est normal (certificat auto-signe).${C_0}"
echo "  ${C_Y}Clique sur « Avance » puis « Continuer ». Un certificat personnel peut etre importe ensuite (Parametres).${C_0}"
echo "  Conteneur          : $CTID ($HN)"
echo "  Mot de passe root  : $ROOTPW   (note-le ; accès par « pct enter $CTID » sans mot de passe)"
if [ -z "$APP_PW" ]; then echo "  Premier accès      : crée le mot de passe de l'application dans le navigateur, ${C_B}tout de suite${C_0}."
else echo "  Connexion          : mot de passe défini à l'installation."; fi
echo
echo "  Mettre à jour      : pct exec $CTID -- update"
echo "  Sauvegardes        : automatiques chaque nuit dans le conteneur (/var/lib/easyludo/backups, 14 jours)"
