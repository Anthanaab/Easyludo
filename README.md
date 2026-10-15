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
| Mettre à jour | `pct exec <ID> -- /usr/local/bin/update` |
| Sauvegarder maintenant | `pct exec <ID> -- /usr/local/bin/easyludo-backup` |
| Restaurer | `pct exec <ID> -- /usr/local/bin/easyludo-restore /var/lib/easyludo/backups/<archive>.tar.gz` |
| Journal | `pct exec <ID> -- journalctl -u easyludo -n 50` |
| Console | `pct enter <ID>` |

Depuis `pct enter <ID>`, les commandes se lancent sans chemin (`update`, `easyludo-backup`…). Avec `pct exec`, garde le chemin complet `/usr/local/bin/…`.

- **Mise à jour** : sauvegarde automatique avant, puis retour à la version précédente si la compilation échoue.
- **Sauvegardes** : chaque nuit à 03:30, 14 jours conservés dans `/var/lib/easyludo/backups` (base + photos).
  Elles sont **dans le conteneur** : ajoute aussi le conteneur à tes sauvegardes Proxmox (vzdump).
- **Clés API et mot de passe** : `/etc/easyludo.env`, puis `systemctl restart easyludo`.
  Les clés peuvent aussi se saisir dans l'app (⚙️ Paramètres).

### HTTPS (nécessaire pour scanner les codes-barres)

Les navigateurs n'autorisent la caméra qu'en HTTPS. Place l'application derrière ton reverse proxy habituel
(Nginx Proxy Manager, Caddy, Traefik, tunnel Cloudflare…) vers `http://IP:3000`.
Sans HTTPS, tout fonctionne sauf le scan caméra (la saisie du code-barres et la recherche par titre restent possibles).

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
