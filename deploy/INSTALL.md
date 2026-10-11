# Déploiement sur un serveur Hetzner Cloud

Tout se fait en SSH sur le serveur, sauf la dernière étape qui part de votre
machine. Comptez une vingtaine de minutes la première fois.

Partout ci-dessous, remplacez `atlas.example.com` par votre domaine et
`203.0.113.10` par l'IP de votre serveur.

---

## 1. Préparer le serveur

```bash
ssh root@203.0.113.10

apt update && apt upgrade -y

# Node 20 — nécessaire au script de récupération des stats
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs rsync

# Caddy — serveur web, certificat TLS automatique
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

node --version   # doit afficher v20.x
```

## 2. Créer l'utilisateur et le dossier

Le site ne tourne pas en root : un compte dédié limite les dégâts si quelque
chose tourne mal.

```bash
adduser --system --group --home /var/www/atlas-performance atlas
mkdir -p /var/www/atlas-performance/assets/data
chown -R atlas:atlas /var/www/atlas-performance
```

## 3. Déposer la clé API

C'est le seul endroit où la clé existe. Elle n'est lisible que par root, ne
part jamais vers le navigateur, et n'est pas dans le dépôt Git.

```bash
nano /etc/atlas-performance.env
```

Mettez-y une seule ligne :

```
API_FOOTBALL_KEY=votre_cle
```

Puis verrouillez le fichier :

```bash
chmod 600 /etc/atlas-performance.env
chown root:root /etc/atlas-performance.env
```

Si la clé fuite un jour, régénérez-la dans **Account → My Access** sur
[dashboard.api-football.com](https://dashboard.api-football.com) : l'ancienne
cesse immédiatement de fonctionner.

## 4. Envoyer le site

Depuis **votre machine**, à la racine du dépôt :

```bash
./deploy/deploy.sh root@203.0.113.10
```

Puis de nouveau sur le serveur :

```bash
chown -R atlas:atlas /var/www/atlas-performance
```

## 5. Trouver les identifiants des joueurs

API-Football désigne chaque joueur par un identifiant numérique. Il faut le
récupérer une fois pour toutes. Cette étape consomme environ 32 requêtes, soit
un tiers du quota quotidien du palier gratuit — faites-la un jour où vous ne
lancez pas la récupération des stats.

```bash
cd /var/www/atlas-performance
set -a && . /etc/atlas-performance.env && set +a
node scripts/fetch-stats.mjs --discover
```

**Vérifiez le résultat.** La recherche se fait par nom de famille et peut
confondre des homonymes. Ouvrez `scripts/players-map.json`, contrôlez chaque
ligne, corrigez les `apiId` erronés et passez `verified` à `true`. Récupérez
ensuite ce fichier sur votre machine pour le versionner : il ne contient aucun
secret et vous évitera de refaire l'étape.

## 6. Première récupération

```bash
cd /var/www/atlas-performance
set -a && . /etc/atlas-performance.env && set +a
node scripts/fetch-stats.mjs
```

Le script affiche chaque joueur traité, la liste des ignorés et le nombre de
requêtes consommées. Il écrit `assets/data/players.json`.

```bash
chown atlas:atlas assets/data/players.json
```

## 7. Programmer le rafraîchissement quotidien

```bash
cp /var/www/atlas-performance/deploy/atlas-stats.service /etc/systemd/system/
cp /var/www/atlas-performance/deploy/atlas-stats.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now atlas-stats.timer

systemctl list-timers atlas-stats.timer   # prochaine exécution
journalctl -u atlas-stats.service -n 50   # journal du dernier passage
```

## 8. Mettre le site en ligne

Faites d'abord pointer l'enregistrement DNS `A` de votre domaine vers
`203.0.113.10`, et attendez que la propagation soit faite
(`dig +short atlas.example.com` doit renvoyer l'IP).

```bash
cp /var/www/atlas-performance/deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile      # remplacez atlas.example.com par votre domaine
systemctl reload caddy
systemctl status caddy
```

Caddy obtient le certificat tout seul au premier accès. Si vous n'avez pas
encore de domaine, remplacez la première ligne du Caddyfile par `:80` et le
site répondra en HTTP sur l'IP, le temps des essais.

Ouvrez le pare-feu dans la console Hetzner si vous en avez un : ports 80 et
443 en entrée.

---

## Mises à jour ultérieures

```bash
./deploy/deploy.sh root@203.0.113.10
```

Le script préserve `assets/data/players.json` : l'instantané du serveur n'est
jamais écrasé par celui de votre machine.

## En cas de problème

| Symptôme | À regarder |
|---|---|
| Le bandeau reste orange « Mode démo » | `assets/data/players.json` existe-t-il, et est-il lisible par Caddy ? |
| `QUOTA : limite de requêtes atteinte` | Les 100 requêtes du jour sont consommées. Le quota repart à 00h00 UTC. |
| Un joueur manque | Son `apiId` est nul ou faux dans `scripts/players-map.json`, ou il n'a pas de stats pour la saison configurée. |
| Mauvaise saison | Changez `season` dans `scripts/players-map.json`. |
| Caddy ne démarre pas | `journalctl -u caddy -n 50`. Le plus souvent : le DNS ne pointe pas encore sur le serveur. |
