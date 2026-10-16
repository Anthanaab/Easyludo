# 🎮 EasyLudo

Ludothèque web pour une collection de jeux vidéo : fiches avec photo, prix d'achat et prix du marché,
scan de code-barres, recherche automatique des infos (Wikidata, RAWG, IGDB, Libretro, UPCitemdb),
estimation des prix (PriceCharting, eBay), classement par marque / console / éditeur, accès protégé par mot de passe.

## Installation sur Proxmox VE (LXC tout-en-un)

Dans le **shell de l'hôte Proxmox** (en root) :

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anthanaab/Easyludo/main/ct/easyludo.sh)"
```

Le script crée un conteneur Debian 12 sans privilèges, y installe Node 22, compile l'application et la lance
comme service systemd. Il propose des réglages par défaut (2 CPU, 2 Go de RAM, 8 Go de disque, DHCP, port 3000)
ou avancés. À la fin, il affiche l'adresse `http://IP:3000`.

**Au premier accès, crée tout de suite le mot de passe de l'application** (ou fournis-le à l'installation, voir plus bas).

> Le dépôt doit être **public** : le script télécharge les fichiers via `curl` et `git clone` sans identifiants.

### Installation sans interaction

```bash
var_ctid=120 var_hostname=ludotheque var_cpu=2 var_ram=2048 var_disk=8 \
var_brg=vmbr0 var_ip=192.168.1.50/24 var_gw=192.168.1.1 var_storage=local-lvm \
var_port=3000 var_app_password='un-mot-de-passe-solide' \
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anthanaab/Easyludo/main/ct/easyludo.sh)"
```

### Commandes utiles (depuis l'hôte)

| Action | Commande |
|---|---|
| Mettre à jour | `pct exec <ID> -- update` |
| Sauvegarder maintenant | `pct exec <ID> -- easyludo-backup` |
| Restaurer | `pct exec <ID> -- easyludo-restore /var/lib/easyludo/backups/<archive>.tar.gz` |
| Journal | `pct exec <ID> -- journalctl -u easyludo -n 50` |
| Console | `pct enter <ID>` |

- **Mise à jour depuis l'interface** : ⚙️ Paramètres → **Mise à jour**. L'app compare la version installée à la dernière sur GitHub ;
  le bouton lance la mise à jour (sauvegarde, compilation, redémarrage) et suit l'avancement. Sur un conteneur installé avant cette
  fonction, lance `update` **deux fois** dans le conteneur : la première récupère le code, la seconde active le bouton.
- **Mise à jour en ligne de commande** : sauvegarde automatique avant, puis retour à la version précédente si la compilation échoue.
- **Sauvegardes** : chaque nuit à 03:30, 14 jours conservés dans `/var/lib/easyludo/backups` (base + photos).
  Elles sont **dans le conteneur** : ajoute aussi le conteneur à tes sauvegardes Proxmox (vzdump).
- **Clés API et mot de passe** : `/etc/easyludo.env`, puis `systemctl restart easyludo`.
  Les clés peuvent aussi se saisir dans l'app (⚙️ Paramètres).

### HTTPS (nécessaire pour le scan caméra en direct)

L'installation active automatiquement le **HTTPS avec un certificat auto-signé** (Caddy, port 443) : utilise `https://IP` au lieu de `http://IP:3000`.
Le port 80 redirige vers le HTTPS, et l'ancienne adresse `http://IP:3000` reste disponible.

Comme le certificat n'est pas émis par une autorité reconnue, **le navigateur affiche un avertissement la première fois** :
« Avancé » → « Continuer vers le site ». Ensuite la caméra peut être autorisée. Le certificat couvre le nom du conteneur et ses adresses IP ;
si l'adresse change (DHCP), `update` (ou `easyludo-https`) le régénère.

Sans HTTPS, le bouton **📸 Photographier le code-barres** fonctionne quand même : il ouvre l'appareil photo du téléphone et lit le code sur la photo.

Conteneur installé avant cette fonction : après une mise à jour, lance une fois `pct exec <ID> -- update --setup`.

> Pour un vrai certificat de confiance (sans avertissement), place l'app derrière un reverse proxy avec un nom de domaine
> (Nginx Proxy Manager, Caddy, Traefik, tunnel Cloudflare…) vers `http://IP:3000`.

## Développement local

```bash
npm install
cp .env.example .env.local   # clés optionnelles
npm run dev                  # http://localhost:3000
```

Node 22 minimum. Les données (base SQLite + photos) sont dans `./data` (ou `EASYLUDO_DATA_DIR`).

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `EASYLUDO_PASSWORD` | Mot de passe de l'application (sinon créé au premier accès) |
| `EASYLUDO_DATA_DIR` | Dossier de la base et des photos |
| `RAWG_API_KEY` | Clé RAWG (fiches + jaquettes) |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | IGDB via Twitch |
| `PRICECHARTING_TOKEN` | Cotes PriceCharting |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | Annonces eBay |

## Désinstallation

```bash
pct stop <ID> && pct destroy <ID>
```
