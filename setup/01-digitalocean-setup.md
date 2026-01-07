# Guide de Configuration DigitalOcean pour Hopefund

## Étape 1 : Créer une Base de Données Managée (5 min)

### 1.1 Connectez-vous à DigitalOcean
Allez sur https://cloud.digitalocean.com

### 1.2 Créer la base de données
1. Cliquez sur **"Create"** → **"Databases"**
2. Choisissez :
   - **Engine** : MySQL 8
   - **Datacenter** : Frankfurt (ou le plus proche de vos utilisateurs)
   - **Plan** : Basic - $15/mois (1 GB RAM, 10 GB Storage)
     - Vous pourrez upgrader plus tard à $30/mois (2 GB RAM, 25 GB) si nécessaire
   - **Nom** : `hopefund-db`
3. Cliquez **"Create Database Cluster"**

⏳ Attendez ~5 minutes que la base soit prête.

### 1.3 Récupérer les informations de connexion
Une fois créée, allez dans l'onglet **"Connection Details"** et notez :
- **Host** : `hopefund-db-xxxxx.db.ondigitalocean.com`
- **Port** : `25060`
- **Username** : `doadmin`
- **Password** : `xxxxxxxxxxxxx`
- **Database** : `defaultdb`

### 1.4 Configurer l'accès
1. Allez dans l'onglet **"Settings"**
2. Dans **"Trusted Sources"**, ajoutez votre IP actuelle
3. Ou choisissez "Allow all" temporairement pour l'import

---

## Étape 2 : Créer une base de données pour Hopefund

Dans l'onglet **"Users & Databases"** :
1. Cliquez **"Add new database"**
2. Nom : `hopefund`
3. Cliquez **"Save"**

---

## Étape 3 : Importer vos données

### Option A : Via ligne de commande (Recommandé)

```bash
# Sur votre machine locale où vous avez le fichier SQL
mysql -h hopefund-db-xxxxx.db.ondigitalocean.com \
      -P 25060 \
      -u doadmin \
      -p \
      --ssl-mode=REQUIRED \
      hopefund < sv_hfb_22_06_2022.sql
```

### Option B : Via un outil graphique
1. Téléchargez **MySQL Workbench** ou **DBeaver**
2. Créez une connexion avec les infos ci-dessus
3. Importez le fichier SQL via l'interface

---

## Étape 4 : Exécuter le script d'extraction

Une fois les données importées, exécutez le script fourni :

```bash
cd hopefund/setup
chmod +x extract-schema.sh
./extract-schema.sh
```

Ce script va générer un fichier `schema_analysis.json` que vous pourrez partager.

---

## Coûts estimés

| Service | Coût mensuel |
|---------|--------------|
| Database MySQL (Basic) | $15 |
| Droplet App (à venir) | $12 |
| **Total** | **~$27/mois** |

---

## Besoin d'aide ?

Si vous êtes bloqué à une étape, dites-moi simplement où vous en êtes et je vous guide.
