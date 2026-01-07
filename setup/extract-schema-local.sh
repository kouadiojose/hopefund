#!/bin/bash

# ==============================================
# Script d'extraction LOCALE du schéma Hopefund
# ==============================================
# Utilisez ce script si vous avez le fichier SQL
# sur votre machine locale (sans base de données)
# ==============================================

echo "=========================================="
echo "   HOPEFUND - Extraction Locale"
echo "=========================================="
echo ""

read -p "Chemin vers le fichier SQL: " SQL_FILE

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Fichier non trouvé: $SQL_FILE"
    exit 1
fi

OUTPUT_DIR="./schema_output"
mkdir -p $OUTPUT_DIR

echo ""
echo "📊 Analyse du fichier SQL..."
echo "   Taille: $(du -h "$SQL_FILE" | cut -f1)"
echo ""

# 1. Extraire les CREATE TABLE
echo "📋 Extraction des CREATE TABLE..."
grep -E "^CREATE TABLE|^\`|^  \`|^PRIMARY|^KEY|^UNIQUE|^CONSTRAINT|^\)|^ENGINE" "$SQL_FILE" > "$OUTPUT_DIR/schema.sql" 2>/dev/null

# Alternative plus complète avec sed
sed -n '/CREATE TABLE/,/ENGINE=/p' "$SQL_FILE" > "$OUTPUT_DIR/schema_full.sql" 2>/dev/null

echo "✅ Schéma extrait"

# 2. Lister les tables
echo ""
echo "📈 Liste des tables..."
grep -oP "CREATE TABLE (\`[^\`]+\`|[a-zA-Z_]+)" "$SQL_FILE" | \
    sed 's/CREATE TABLE //' | \
    tr -d '`' > "$OUTPUT_DIR/tables_list.txt"

TABLE_COUNT=$(wc -l < "$OUTPUT_DIR/tables_list.txt")
echo "   $TABLE_COUNT tables trouvées"

# 3. Afficher les premières tables
echo ""
echo "📝 Premières tables trouvées:"
head -20 "$OUTPUT_DIR/tables_list.txt" | while read table; do
    echo "   - $table"
done

# 4. Extraire quelques INSERT pour comprendre les données
echo ""
echo "🔍 Extraction d'échantillons INSERT..."
for table in clients client users comptes compte prets pret transactions agences; do
    grep -m 3 "INSERT INTO \`$table\`" "$SQL_FILE" > "$OUTPUT_DIR/sample_$table.txt" 2>/dev/null
    if [ -s "$OUTPUT_DIR/sample_$table.txt" ]; then
        echo "   - Table '$table' trouvée"
    else
        rm -f "$OUTPUT_DIR/sample_$table.txt"
    fi
done

# 5. Créer le résumé
echo ""
echo "📦 Création du résumé..."

cat > "$OUTPUT_DIR/summary.json" <<EOF
{
    "source_file": "$SQL_FILE",
    "extraction_date": "$(date -Iseconds)",
    "total_tables": $TABLE_COUNT,
    "method": "local_file_parsing"
}
EOF

# 6. Créer l'archive
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
echo "Fichiers générés:"
ls -la "$OUTPUT_DIR/"
echo ""
echo "Archive: hopefund_schema_analysis.tar.gz"
echo ""
echo "👉 Uploadez cette archive sur GitHub ou"
echo "   partagez le contenu de schema.sql"
echo ""
