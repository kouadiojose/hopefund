-- Hopefund Banking System - Database Initialization Script
-- Execute this on a fresh PostgreSQL database

-- Create enum type
CREATE TYPE "ModuleType" AS ENUM ('CLIENT', 'EPARGNE', 'CREDIT', 'GUICHET', 'SYSTEME', 'PARAMETRAGE', 'RAPPORTS', 'COMPTABILITE', 'LIGNE_CREDIT', 'BUDGET');

-- ============================================
-- TABLES PRINCIPALES
-- ============================================

-- Table des agences
CREATE TABLE "ad_agc" (
    "id_ag" INTEGER NOT NULL,
    "libel_ag" TEXT,
    "adresse_ag" TEXT,
    "tel_ag" TEXT,
    "email_ag" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etat_ag" INTEGER DEFAULT 1,
    CONSTRAINT "ad_agc_pkey" PRIMARY KEY ("id_ag")
);

-- Table des clients
CREATE TABLE "ad_cli" (
    "id_client" SERIAL NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "anc_id_client" TEXT,
    "statut_juridique" INTEGER,
    "qualite" INTEGER,
    "adresse" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "pays" INTEGER,
    "num_tel" TEXT,
    "num_port" TEXT,
    "email" TEXT,
    "date_adh" TIMESTAMP(3),
    "etat" INTEGER,
    "pp_nom" TEXT,
    "pp_prenom" TEXT,
    "pp_date_naissance" TIMESTAMP(3),
    "pp_lieu_naissance" TEXT,
    "pp_sexe" INTEGER,
    "pp_nationalite" INTEGER,
    "pp_type_piece_id" INTEGER,
    "pp_nm_piece_id" TEXT,
    "pp_etat_civil" INTEGER,
    "pp_nbre_enfant" INTEGER,
    "pp_employeur" TEXT,
    "pp_fonction" TEXT,
    "pp_revenu" DECIMAL(30,6),
    "pm_raison_sociale" TEXT,
    "pm_abreviation" TEXT,
    "pm_nature_juridique" TEXT,
    "pm_numero_reg_nat" TEXT,
    "pm_date_constitution" TIMESTAMP(3),
    "gi_nom" TEXT,
    "gi_nbre_membr" INTEGER,
    "province" INTEGER,
    "district" INTEGER,
    "secteur" INTEGER,
    "cellule" INTEGER,
    "village" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modif" TIMESTAMP(3),
    "utilis_crea" INTEGER,
    "utilis_modif" INTEGER,
    "nbre_credits" INTEGER DEFAULT 0,
    CONSTRAINT "ad_cli_pkey" PRIMARY KEY ("id_client")
);

-- Table des comptes
CREATE TABLE "ad_cpt" (
    "id_cpte" SERIAL NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "id_titulaire" INTEGER NOT NULL,
    "id_prod" INTEGER,
    "num_cpte" INTEGER,
    "num_complet_cpte" TEXT,
    "num_cpte_comptable" VARCHAR(50),
    "intitule_compte" TEXT,
    "devise" CHAR(3),
    "solde" DECIMAL(30,6) DEFAULT 0,
    "mnt_bloq" DECIMAL(30,6) DEFAULT 0,
    "mnt_min_cpte" DECIMAL(30,6) DEFAULT 0,
    "decouvert_max" DECIMAL(30,6) DEFAULT 0,
    "tx_interet_cpte" DOUBLE PRECISION,
    "interet_annuel" DECIMAL(30,6) DEFAULT 0,
    "solde_calcul_interets" DECIMAL(30,6) DEFAULT 0,
    "date_solde_calcul_interets" TIMESTAMP(3),
    "mode_calcul_int_cpte" INTEGER,
    "etat_cpte" INTEGER,
    "date_ouvert" TIMESTAMP(3),
    "date_clot" TIMESTAMP(3),
    "raison_clot" INTEGER,
    "etat_chequier" INTEGER DEFAULT 0,
    "chequier_num_cheques" INTEGER DEFAULT 25,
    "num_last_cheque" INTEGER DEFAULT 0,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modif" TIMESTAMP(3),
    "utilis_crea" INTEGER,
    CONSTRAINT "ad_cpt_pkey" PRIMARY KEY ("id_cpte")
);

-- Table des dossiers de crédit
CREATE TABLE "ad_dcr" (
    "id_doss" SERIAL NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "id_client" INTEGER NOT NULL,
    "id_prod" INTEGER,
    "date_dem" TIMESTAMP(3),
    "mnt_dem" DECIMAL(30,6) DEFAULT 0,
    "obj_dem" INTEGER,
    "detail_obj_dem" TEXT,
    "duree_mois" INTEGER,
    "cre_mnt_octr" DECIMAL(30,6) DEFAULT 0,
    "cre_date_approb" TIMESTAMP(3),
    "cre_date_debloc" TIMESTAMP(3),
    "cre_etat" INTEGER,
    "cre_id_cpte" INTEGER,
    "terme" INTEGER,
    "delai_grac" INTEGER DEFAULT 0,
    "differe_jours" INTEGER DEFAULT 0,
    "tx_interet_lcr" DOUBLE PRECISION DEFAULT 0,
    "gar_num" DECIMAL(30,6) DEFAULT 0,
    "gar_tot" DECIMAL(30,6) DEFAULT 0,
    "gar_mat" DECIMAL(30,6) DEFAULT 0,
    "id_agent_gest" INTEGER,
    "etat" INTEGER,
    "date_etat" TIMESTAMP(3),
    "motif" INTEGER,
    "mnt_assurance" DECIMAL(30,6) DEFAULT 0,
    "mnt_commission" DECIMAL(30,6) DEFAULT 0,
    "mnt_frais_doss" DECIMAL(30,6) DEFAULT 0,
    "prov_mnt" DECIMAL(30,6) DEFAULT 0,
    "prov_date" TIMESTAMP(3),
    "perte_capital" DECIMAL(30,6) DEFAULT 0,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modif" TIMESTAMP(3),
    CONSTRAINT "ad_dcr_pkey" PRIMARY KEY ("id_doss")
);

-- Table des mouvements
CREATE TABLE "ad_mouvement" (
    "id_mouvement" SERIAL NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "id_ecriture" INTEGER,
    "compte" VARCHAR(50),
    "cpte_interne_cli" INTEGER,
    "sens" CHAR(1),
    "montant" DECIMAL(30,6),
    "devise" CHAR(3),
    "date_valeur" DATE,
    "consolide" BOOLEAN,
    CONSTRAINT "ad_mouvement_pkey" PRIMARY KEY ("id_mouvement")
);

-- Table des échéances
CREATE TABLE "ad_sre" (
    "id_ech" SERIAL NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "id_doss" INTEGER NOT NULL,
    "num_ech" INTEGER,
    "date_ech" TIMESTAMP(3),
    "mnt_capital" DECIMAL(30,6) DEFAULT 0,
    "mnt_int" DECIMAL(30,6) DEFAULT 0,
    "solde_capital" DECIMAL(30,6) DEFAULT 0,
    "solde_int" DECIMAL(30,6) DEFAULT 0,
    "date_paiement" TIMESTAMP(3),
    "mnt_paye" DECIMAL(30,6) DEFAULT 0,
    "etat" INTEGER,
    CONSTRAINT "ad_sre_pkey" PRIMARY KEY ("id_ech")
);

-- Table des garanties
CREATE TABLE "ad_gar" (
    "id_gar" SERIAL NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "id_doss" INTEGER NOT NULL,
    "type_gar" INTEGER,
    "description" TEXT,
    "valeur_estimee" DECIMAL(30,6),
    "date_evaluation" TIMESTAMP(3),
    CONSTRAINT "ad_gar_pkey" PRIMARY KEY ("id_gar")
);

-- ============================================
-- TABLES APPLICATION
-- ============================================

-- Table des utilisateurs
CREATE TABLE "app_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'TELLER',
    "id_ag" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- Table des rôles
CREATE TABLE "app_roles" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_roles_pkey" PRIMARY KEY ("id")
);

-- Table des permissions
CREATE TABLE "app_permissions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" "ModuleType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_permissions_pkey" PRIMARY KEY ("id")
);

-- Table des role-permissions
CREATE TABLE "app_role_permissions" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_role_permissions_pkey" PRIMARY KEY ("id")
);

-- Table des sessions
CREATE TABLE "app_sessions" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

-- Table des logs d'audit
CREATE TABLE "app_audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Table d'authentification clients mobiles
CREATE TABLE "app_client_auth" (
    "id" SERIAL NOT NULL,
    "id_client" INTEGER NOT NULL,
    "phone_number" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "device_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_client_auth_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- TABLES CAISSE
-- ============================================

-- Sessions de caisse
CREATE TABLE "app_caisse_sessions" (
    "id" SERIAL NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date_session" DATE NOT NULL,
    "heure_ouverture" TIMESTAMP(3),
    "montant_ouverture" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "decompte_ouverture_id" INTEGER,
    "heure_fermeture" TIMESTAMP(3),
    "montant_fermeture" DECIMAL(30,6),
    "decompte_fermeture_id" INTEGER,
    "ecart" DECIMAL(30,6),
    "commentaire_ecart" TEXT,
    "total_entrees" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "total_sorties" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "nombre_operations" INTEGER NOT NULL DEFAULT 0,
    "etat" INTEGER NOT NULL DEFAULT 1,
    "seuil_max" DECIMAL(30,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_caisse_sessions_pkey" PRIMARY KEY ("id")
);

-- Décompte billets
CREATE TABLE "app_caisse_decomptes" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "type_decompte" INTEGER NOT NULL,
    "devise" VARCHAR(3) NOT NULL DEFAULT 'CDF',
    "billets_20000" INTEGER NOT NULL DEFAULT 0,
    "billets_10000" INTEGER NOT NULL DEFAULT 0,
    "billets_5000" INTEGER NOT NULL DEFAULT 0,
    "billets_1000" INTEGER NOT NULL DEFAULT 0,
    "billets_500" INTEGER NOT NULL DEFAULT 0,
    "billets_200" INTEGER NOT NULL DEFAULT 0,
    "billets_100" INTEGER NOT NULL DEFAULT 0,
    "billets_50" INTEGER NOT NULL DEFAULT 0,
    "pieces_50" INTEGER NOT NULL DEFAULT 0,
    "pieces_25" INTEGER NOT NULL DEFAULT 0,
    "pieces_10" INTEGER NOT NULL DEFAULT 0,
    "pieces_5" INTEGER NOT NULL DEFAULT 0,
    "pieces_1" INTEGER NOT NULL DEFAULT 0,
    "billets_100_usd" INTEGER NOT NULL DEFAULT 0,
    "billets_50_usd" INTEGER NOT NULL DEFAULT 0,
    "billets_20_usd" INTEGER NOT NULL DEFAULT 0,
    "billets_10_usd" INTEGER NOT NULL DEFAULT 0,
    "billets_5_usd" INTEGER NOT NULL DEFAULT 0,
    "billets_1_usd" INTEGER NOT NULL DEFAULT 0,
    "total_billets" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "total_pieces" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "total_general" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "valide_par" INTEGER,
    "date_validation" TIMESTAMP(3),
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_caisse_decomptes_pkey" PRIMARY KEY ("id")
);

-- Mouvements caisse
CREATE TABLE "app_caisse_mouvements" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "type_mouvement" INTEGER NOT NULL,
    "montant" DECIMAL(30,6) NOT NULL,
    "devise" VARCHAR(3) NOT NULL DEFAULT 'CDF',
    "caisse_source_id" INTEGER,
    "caisse_dest_id" INTEGER,
    "de_caisse_principale" BOOLEAN NOT NULL DEFAULT false,
    "vers_caisse_principale" BOOLEAN NOT NULL DEFAULT false,
    "demande_par" INTEGER NOT NULL,
    "valide_par" INTEGER,
    "date_validation" TIMESTAMP(3),
    "etat" INTEGER NOT NULL DEFAULT 1,
    "motif_rejet" TEXT,
    "commentaire" TEXT,
    "numero_bordereau" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_caisse_mouvements_pkey" PRIMARY KEY ("id")
);

-- Caisse principale
CREATE TABLE "app_caisse_principale" (
    "id" SERIAL NOT NULL,
    "id_ag" INTEGER NOT NULL,
    "caissier_principal_id" INTEGER,
    "solde_cdf" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "solde_usd" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "seuil_min_cdf" DECIMAL(30,6),
    "seuil_max_cdf" DECIMAL(30,6),
    "seuil_max_caissier_cdf" DECIMAL(30,6),
    "seuil_min_usd" DECIMAL(30,6),
    "seuil_max_usd" DECIMAL(30,6),
    "seuil_max_caissier_usd" DECIMAL(30,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_caisse_principale_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- INDEX
-- ============================================

CREATE INDEX "ad_cli_id_ag_idx" ON "ad_cli"("id_ag");
CREATE INDEX "ad_cli_pp_nom_pp_prenom_idx" ON "ad_cli"("pp_nom", "pp_prenom");
CREATE INDEX "ad_cli_num_tel_idx" ON "ad_cli"("num_tel");
CREATE UNIQUE INDEX "ad_cli_id_client_id_ag_key" ON "ad_cli"("id_client", "id_ag");

CREATE INDEX "ad_cpt_id_ag_idx" ON "ad_cpt"("id_ag");
CREATE INDEX "ad_cpt_id_titulaire_idx" ON "ad_cpt"("id_titulaire");
CREATE UNIQUE INDEX "ad_cpt_num_complet_cpte_key" ON "ad_cpt"("num_complet_cpte");
CREATE UNIQUE INDEX "ad_cpt_id_cpte_id_ag_key" ON "ad_cpt"("id_cpte", "id_ag");

CREATE INDEX "ad_dcr_id_ag_idx" ON "ad_dcr"("id_ag");
CREATE INDEX "ad_dcr_id_client_idx" ON "ad_dcr"("id_client");
CREATE INDEX "ad_dcr_etat_idx" ON "ad_dcr"("etat");
CREATE INDEX "ad_dcr_cre_etat_idx" ON "ad_dcr"("cre_etat");
CREATE UNIQUE INDEX "ad_dcr_id_doss_id_ag_key" ON "ad_dcr"("id_doss", "id_ag");

CREATE INDEX "ad_mouvement_id_ag_idx" ON "ad_mouvement"("id_ag");
CREATE INDEX "ad_mouvement_cpte_interne_cli_idx" ON "ad_mouvement"("cpte_interne_cli");
CREATE INDEX "ad_mouvement_date_valeur_idx" ON "ad_mouvement"("date_valeur");

CREATE INDEX "ad_sre_id_ag_idx" ON "ad_sre"("id_ag");
CREATE INDEX "ad_sre_id_doss_idx" ON "ad_sre"("id_doss");
CREATE INDEX "ad_sre_date_ech_idx" ON "ad_sre"("date_ech");

CREATE INDEX "ad_gar_id_ag_idx" ON "ad_gar"("id_ag");
CREATE INDEX "ad_gar_id_doss_idx" ON "ad_gar"("id_doss");

CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");
CREATE UNIQUE INDEX "app_roles_code_key" ON "app_roles"("code");
CREATE UNIQUE INDEX "app_permissions_code_key" ON "app_permissions"("code");
CREATE UNIQUE INDEX "app_role_permissions_role_permission_id_key" ON "app_role_permissions"("role", "permission_id");
CREATE INDEX "app_role_permissions_role_idx" ON "app_role_permissions"("role");

CREATE UNIQUE INDEX "app_sessions_refresh_token_key" ON "app_sessions"("refresh_token");
CREATE INDEX "app_sessions_user_id_idx" ON "app_sessions"("user_id");

CREATE INDEX "app_audit_logs_user_id_idx" ON "app_audit_logs"("user_id");
CREATE INDEX "app_audit_logs_entity_entity_id_idx" ON "app_audit_logs"("entity", "entity_id");
CREATE INDEX "app_audit_logs_created_at_idx" ON "app_audit_logs"("created_at");

CREATE UNIQUE INDEX "app_client_auth_id_client_key" ON "app_client_auth"("id_client");
CREATE UNIQUE INDEX "app_client_auth_phone_number_key" ON "app_client_auth"("phone_number");

CREATE UNIQUE INDEX "app_caisse_sessions_id_ag_user_id_date_session_key" ON "app_caisse_sessions"("id_ag", "user_id", "date_session");
CREATE INDEX "app_caisse_sessions_id_ag_idx" ON "app_caisse_sessions"("id_ag");
CREATE INDEX "app_caisse_sessions_user_id_idx" ON "app_caisse_sessions"("user_id");
CREATE INDEX "app_caisse_sessions_date_session_idx" ON "app_caisse_sessions"("date_session");

CREATE INDEX "app_caisse_decomptes_session_id_idx" ON "app_caisse_decomptes"("session_id");
CREATE INDEX "app_caisse_decomptes_type_decompte_idx" ON "app_caisse_decomptes"("type_decompte");

CREATE INDEX "app_caisse_mouvements_session_id_idx" ON "app_caisse_mouvements"("session_id");
CREATE INDEX "app_caisse_mouvements_id_ag_idx" ON "app_caisse_mouvements"("id_ag");
CREATE INDEX "app_caisse_mouvements_type_mouvement_idx" ON "app_caisse_mouvements"("type_mouvement");
CREATE INDEX "app_caisse_mouvements_etat_idx" ON "app_caisse_mouvements"("etat");

CREATE UNIQUE INDEX "app_caisse_principale_id_ag_key" ON "app_caisse_principale"("id_ag");

-- ============================================
-- FOREIGN KEYS
-- ============================================

ALTER TABLE "ad_cpt" ADD CONSTRAINT "ad_cpt_id_titulaire_id_ag_fkey"
    FOREIGN KEY ("id_titulaire", "id_ag") REFERENCES "ad_cli"("id_client", "id_ag") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ad_dcr" ADD CONSTRAINT "ad_dcr_id_client_id_ag_fkey"
    FOREIGN KEY ("id_client", "id_ag") REFERENCES "ad_cli"("id_client", "id_ag") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ad_mouvement" ADD CONSTRAINT "ad_mouvement_cpte_interne_cli_id_ag_fkey"
    FOREIGN KEY ("cpte_interne_cli", "id_ag") REFERENCES "ad_cpt"("id_cpte", "id_ag") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ad_sre" ADD CONSTRAINT "ad_sre_id_doss_id_ag_fkey"
    FOREIGN KEY ("id_doss", "id_ag") REFERENCES "ad_dcr"("id_doss", "id_ag") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ad_gar" ADD CONSTRAINT "ad_gar_id_doss_id_ag_fkey"
    FOREIGN KEY ("id_doss", "id_ag") REFERENCES "ad_dcr"("id_doss", "id_ag") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_audit_logs" ADD CONSTRAINT "app_audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_role_permissions" ADD CONSTRAINT "app_role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "app_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_role_permissions" ADD CONSTRAINT "app_role_permissions_role_fkey"
    FOREIGN KEY ("role") REFERENCES "app_roles"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_caisse_decomptes" ADD CONSTRAINT "app_caisse_decomptes_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "app_caisse_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_caisse_mouvements" ADD CONSTRAINT "app_caisse_mouvements_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "app_caisse_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- DONNÉES INITIALES
-- ============================================

-- Agence principale
INSERT INTO "ad_agc" ("id_ag", "libel_ag", "adresse_ag", "etat_ag")
VALUES (1, 'Siège Principal', 'Bujumbura, Burundi', 1);

-- Rôles système
INSERT INTO "app_roles" ("code", "label", "description", "color", "is_system", "updated_at") VALUES
('SUPER_ADMIN', 'Super Administrateur', 'Accès complet au système', 'red', true, NOW()),
('DIRECTOR', 'Directeur', 'Direction générale', 'purple', true, NOW()),
('BRANCH_MANAGER', 'Chef d''Agence', 'Gestion d''une agence', 'blue', true, NOW()),
('CREDIT_OFFICER', 'Agent de Crédit', 'Gestion des crédits', 'green', true, NOW()),
('TELLER', 'Caissier', 'Opérations de caisse', 'orange', true, NOW());

-- Utilisateur admin par défaut (mot de passe: Admin@123)
INSERT INTO "app_users" ("email", "password_hash", "nom", "prenom", "role", "id_ag", "is_active", "updated_at")
VALUES ('admin@hopefund.bi', '$2b$10$rQZ8K6YL5P1VJQ7.kF3ZXOsWJK8QZ5H7R9X5Z7Y8W2L4M6N8P0Q2S', 'Administrateur', 'Hopefund', 'SUPER_ADMIN', 1, true, NOW());

-- Caisse principale pour l'agence 1
INSERT INTO "app_caisse_principale" ("id_ag", "solde_cdf", "solde_usd", "updated_at")
VALUES (1, 0, 0, NOW());

SELECT 'Database initialized successfully!' as message;
