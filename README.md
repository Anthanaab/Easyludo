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
ou avancés. À la fin, il affiche l'adresse `https://IP`.

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

### HTTPS (obligatoire)

Le site n'est accessible **qu'en HTTPS** : Caddy écoute sur le port 443 (le port 80 redirige) et l'application n'écoute plus que sur `127.0.0.1`.
Utilise `https://IP` (l'ancienne adresse `http://IP:3000` n'existe plus). Par défaut, le certificat est **auto-signé** et créé à l'installation :
le navigateur affiche un avertissement la première fois (« Avancé » → « Continuer »), puis la caméra en direct fonctionne.

**Depuis l'interface** : ⚙️ Paramètres → **🔒 HTTPS**
- **🔐 Certificat auto-signé** : (ré)génère le certificat (valable 800 jours, pour le nom et les adresses IP du conteneur). Sur un conteneur installé
  avant cette fonction, ce bouton installe aussi les services nécessaires.
- **📥 Importer mon certificat** : certificat (PEM, chaîne incluse si besoin) + clé privée sans mot de passe. Le certificat doit couvrir le nom ou
  l'adresse utilisés pour ouvrir le site. L'import n'est possible que depuis la version HTTPS du site. Un certificat importé est conservé aux mises à jour.
- **⬇ Télécharger le certificat** : pour l'installer comme certificat de confiance sur un appareil et supprimer l'avertissement (instructions dans le panneau).

Sécurité : l'application ne bascule en « HTTPS seulement » qu'après avoir vérifié que Caddy répond, avec retour automatique à l'état précédent en cas de problème.
Si besoin de revenir en HTTP : `pct enter <ID>` puis `rm /etc/systemd/system/easyludo.service.d/https-only.conf && systemctl daemon-reload && systemctl restart easyludo`.

Sans caméra en direct (ou en cas de doute), le bouton **📸 Photographier le code-barres** lit le code sur une photo prise avec l'appareil photo du téléphone.

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
