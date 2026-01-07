# 🚀 QUICK START - Choisissez votre méthode

## Méthode 1 : DigitalOcean (Recommandé pour la suite du projet)

**Temps estimé : 15-20 minutes**

Cette méthode configure directement l'infrastructure de production.

```
1. Créer compte DigitalOcean → https://cloud.digitalocean.com
2. Créer Database MySQL → $15/mois
3. Importer le SQL
4. Exécuter extract-schema.sh
5. Partager le résultat
```

📖 Guide détaillé : `01-digitalocean-setup.md`

---

## Méthode 2 : Extraction locale (Plus rapide)

**Temps estimé : 5 minutes**

Si vous avez le fichier SQL sur votre machine :

### Linux/Mac :
```bash
chmod +x extract-schema-local.sh
./extract-schema-local.sh
# Entrez le chemin vers votre fichier .sql
```

### Windows (PowerShell) :
```powershell
# Exécutez extract-schema.ps1
.\extract-schema.ps1
```

---

## Méthode 3 : MySQL local existant

Si vous avez déjà MySQL installé et la base importée :

```bash
chmod +x extract-schema.sh
./extract-schema.sh
# Host: localhost
# Port: 3306
# User: root
# Password: votre_mot_de_passe
# Database: nom_de_votre_base
```

---

## Après l'extraction

Une fois le script exécuté, vous aurez :
- `schema_output/schema.sql` - Structure des tables
- `schema_output/tables_stats.txt` - Statistiques
- `hopefund_schema_analysis.tar.gz` - Archive complète

**Partagez l'archive** en la poussant sur GitHub :

```bash
git add hopefund_schema_analysis.tar.gz schema_output/
git commit -m "Add database schema analysis"
git push origin main
```

Ou copiez-collez simplement le contenu de `schema.sql` dans le chat !
