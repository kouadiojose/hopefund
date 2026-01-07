#!/bin/bash

# ==============================================
# Script d'extraction du schéma Hopefund
# ==============================================
# Ce script extrait le schéma et les statistiques
# de la base de données pour analyse
# ==============================================

echo "=========================================="
echo "   HOPEFUND - Extraction du Schéma"
echo "=========================================="
echo ""

# Demander les informations de connexion
read -p "Host MySQL (ex: hopefund-db-xxx.db.ondigitalocean.com): " DB_HOST
read -p "Port (défaut 25060): " DB_PORT
DB_PORT=${DB_PORT:-25060}
read -p "Utilisateur (défaut doadmin): " DB_USER
DB_USER=${DB_USER:-doadmin}
read -s -p "Mot de passe: " DB_PASS
echo ""
read -p "Nom de la base (défaut hopefund): " DB_NAME
DB_NAME=${DB_NAME:-hopefund}

OUTPUT_DIR="./schema_output"
mkdir -p $OUTPUT_DIR

echo ""
echo "📊 Connexion à la base de données..."

# Test de connexion
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Erreur de connexion. Vérifiez vos identifiants."
    exit 1
fi

echo "✅ Connexion réussie!"
echo ""

# 1. Extraire le schéma complet
echo "📋 Extraction du schéma (structure des tables)..."
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
    --ssl-mode=REQUIRED \
    --no-data \
    --routines \
    --triggers \
    "$DB_NAME" > "$OUTPUT_DIR/schema.sql" 2>/dev/null

echo "✅ Schéma extrait: $OUTPUT_DIR/schema.sql"

# 2. Liste des tables avec nombre de lignes
echo ""
echo "📈 Analyse des tables..."

mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" --ssl-mode=REQUIRED "$DB_NAME" <<EOF > "$OUTPUT_DIR/tables_stats.txt" 2>/dev/null
SELECT
    TABLE_NAME as 'Table',
    TABLE_ROWS as 'Lignes (estimé)',
    ROUND(DATA_LENGTH / 1024 / 1024, 2) as 'Taille Data (MB)',
    ROUND(INDEX_LENGTH / 1024 / 1024, 2) as 'Taille Index (MB)',
    TABLE_COMMENT as 'Commentaire'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = '$DB_NAME'
ORDER BY TABLE_ROWS DESC;
EOF

echo "✅ Statistiques extraites: $OUTPUT_DIR/tables_stats.txt"

# 3. Relations (Foreign Keys)
echo ""
echo "🔗 Extraction des relations..."

mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" --ssl-mode=REQUIRED "$DB_NAME" <<EOF > "$OUTPUT_DIR/relations.txt" 2>/dev/null
SELECT
    TABLE_NAME as 'Table',
    COLUMN_NAME as 'Colonne',
    REFERENCED_TABLE_NAME as 'Table Référencée',
    REFERENCED_COLUMN_NAME as 'Colonne Référencée'
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = '$DB_NAME'
AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME;
EOF

echo "✅ Relations extraites: $OUTPUT_DIR/relations.txt"

# 4. Échantillon de données pour tables importantes
echo ""
echo "📝 Extraction d'échantillons de données..."

# Tables probablement importantes dans une app bancaire
IMPORTANT_TABLES=("clients" "client" "users" "user" "comptes" "compte" "account" "accounts"
                  "prets" "pret" "loans" "loan" "credits" "credit"
                  "transactions" "transaction" "operations" "operation" "mouvements"
                  "agences" "agence" "branches" "branch")

for table in "${IMPORTANT_TABLES[@]}"; do
    # Vérifier si la table existe
    EXISTS=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" --ssl-mode=REQUIRED -N -e \
        "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='$table'" 2>/dev/null)

    if [ "$EXISTS" == "1" ]; then
        echo "   - Table '$table' trouvée, extraction de 5 lignes..."
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" --ssl-mode=REQUIRED "$DB_NAME" \
            -e "SELECT * FROM $table LIMIT 5" > "$OUTPUT_DIR/sample_$table.txt" 2>/dev/null
    fi
done

echo "✅ Échantillons extraits"

# 5. Créer un résumé JSON
echo ""
echo "📦 Création du résumé..."

# Compter les tables
TABLE_COUNT=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" --ssl-mode=REQUIRED -N -e \
    "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME'" 2>/dev/null)

# Taille totale
TOTAL_SIZE=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" --ssl-mode=REQUIRED -N -e \
    "SELECT ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME'" 2>/dev/null)

cat > "$OUTPUT_DIR/summary.json" <<EOF
{
    "database": "$DB_NAME",
    "extraction_date": "$(date -Iseconds)",
    "total_tables": $TABLE_COUNT,
    "total_size_mb": $TOTAL_SIZE,
    "files_generated": [
        "schema.sql",
        "tables_stats.txt",
        "relations.txt",
        "sample_*.txt"
    ]
}
EOF

echo "✅ Résumé créé: $OUTPUT_DIR/summary.json"

# 6. Créer une archive
echo ""
echo "📦 Création de l'archive..."
cd "$OUTPUT_DIR"
tar -czf ../hopefund_schema_analysis.tar.gz *
cd ..

echo ""
echo "=========================================="
echo "   ✅ EXTRACTION TERMINÉE"
echo "=========================================="
echo ""
echo "Fichiers générés dans: $OUTPUT_DIR/"
echo "Archive: hopefund_schema_analysis.tar.gz"
echo ""
echo "👉 Prochaine étape:"
echo "   Uploadez 'hopefund_schema_analysis.tar.gz' sur GitHub"
echo "   ou partagez le contenu de '$OUTPUT_DIR/schema.sql'"
echo ""
