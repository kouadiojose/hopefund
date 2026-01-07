# ==============================================
# Script d'extraction LOCALE du schéma Hopefund
# Version Windows PowerShell
# ==============================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   HOPEFUND - Extraction du Schema" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$SqlFile = Read-Host "Chemin vers le fichier SQL (ex: C:\Users\...\sv_hfb_22_06_2022.sql)"

if (-not (Test-Path $SqlFile)) {
    Write-Host "❌ Fichier non trouvé: $SqlFile" -ForegroundColor Red
    exit 1
}

$OutputDir = ".\schema_output"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host ""
Write-Host "📊 Analyse du fichier SQL..." -ForegroundColor Yellow
$FileSize = (Get-Item $SqlFile).Length / 1MB
Write-Host "   Taille: $([math]::Round($FileSize, 2)) MB"
Write-Host ""

# 1. Extraire les CREATE TABLE
Write-Host "📋 Extraction des CREATE TABLE..." -ForegroundColor Yellow

$CreateTablePattern = "CREATE TABLE[\s\S]*?ENGINE="
$SchemaContent = @()
$TableNames = @()

# Lire le fichier par blocs pour gérer les gros fichiers
$Reader = [System.IO.StreamReader]::new($SqlFile)
$Buffer = ""
$InCreateTable = $false
$LineCount = 0

while ($null -ne ($Line = $Reader.ReadLine())) {
    $LineCount++

    # Détecter le début d'un CREATE TABLE
    if ($Line -match "CREATE TABLE") {
        $InCreateTable = $true
        $Buffer = $Line + "`n"

        # Extraire le nom de la table
        if ($Line -match "CREATE TABLE [`]?(\w+)[`]?") {
            $TableNames += $Matches[1]
        }
    }
    elseif ($InCreateTable) {
        $Buffer += $Line + "`n"

        # Détecter la fin du CREATE TABLE
        if ($Line -match "ENGINE=") {
            $SchemaContent += $Buffer
            $SchemaContent += "`n"
            $Buffer = ""
            $InCreateTable = $false
        }
    }

    # Limiter pour éviter les problèmes de mémoire
    if ($LineCount % 100000 -eq 0) {
        Write-Host "   Lignes traitées: $LineCount" -ForegroundColor Gray
    }
}

$Reader.Close()

# Sauvegarder le schéma
$SchemaContent | Out-File -FilePath "$OutputDir\schema.sql" -Encoding UTF8
Write-Host "✅ Schéma extrait: $OutputDir\schema.sql" -ForegroundColor Green

# 2. Sauvegarder la liste des tables
Write-Host ""
Write-Host "📈 Liste des tables..." -ForegroundColor Yellow
$TableNames | Out-File -FilePath "$OutputDir\tables_list.txt" -Encoding UTF8
Write-Host "   $($TableNames.Count) tables trouvées" -ForegroundColor Green

# 3. Afficher les tables
Write-Host ""
Write-Host "📝 Tables trouvées:" -ForegroundColor Yellow
$TableNames | Select-Object -First 30 | ForEach-Object {
    Write-Host "   - $_" -ForegroundColor White
}

if ($TableNames.Count -gt 30) {
    Write-Host "   ... et $($TableNames.Count - 30) autres" -ForegroundColor Gray
}

# 4. Créer le résumé JSON
Write-Host ""
Write-Host "📦 Création du résumé..." -ForegroundColor Yellow

$Summary = @{
    source_file = $SqlFile
    extraction_date = (Get-Date -Format "o")
    total_tables = $TableNames.Count
    tables = $TableNames
    method = "local_file_parsing_powershell"
} | ConvertTo-Json -Depth 3

$Summary | Out-File -FilePath "$OutputDir\summary.json" -Encoding UTF8
Write-Host "✅ Résumé créé: $OutputDir\summary.json" -ForegroundColor Green

# 5. Créer une archive ZIP
Write-Host ""
Write-Host "📦 Création de l'archive..." -ForegroundColor Yellow
Compress-Archive -Path "$OutputDir\*" -DestinationPath ".\hopefund_schema_analysis.zip" -Force
Write-Host "✅ Archive créée: hopefund_schema_analysis.zip" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   ✅ EXTRACTION TERMINÉE" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fichiers générés dans: $OutputDir\" -ForegroundColor White
Get-ChildItem $OutputDir | ForEach-Object {
    Write-Host "   - $($_.Name) ($([math]::Round($_.Length / 1KB, 2)) KB)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Archive: hopefund_schema_analysis.zip" -ForegroundColor White
Write-Host ""
Write-Host "👉 Prochaine étape:" -ForegroundColor Yellow
Write-Host "   Uploadez 'hopefund_schema_analysis.zip' sur GitHub" -ForegroundColor White
Write-Host "   ou copiez le contenu de 'schema_output\schema.sql'" -ForegroundColor White
Write-Host ""
