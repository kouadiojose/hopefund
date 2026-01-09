-- Script de migration des rôles utilisateurs
-- À exécuter sur la base de données PostgreSQL de Hopefund
-- Ce script met à jour les anciens noms de rôles vers les nouveaux

-- ============================================================
-- ÉTAPE 1: VÉRIFIER L'ÉTAT ACTUEL
-- ============================================================

-- Afficher les utilisateurs et leurs rôles actuels
SELECT id, email, nom, prenom, role, is_active FROM app_users ORDER BY id;

-- ============================================================
-- ÉTAPE 2: CRÉER UNE COLONNE TEMPORAIRE ET SAUVEGARDER LES DONNÉES
-- ============================================================

-- Ajouter une colonne temporaire pour sauvegarder les rôles
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role_temp VARCHAR(50);

-- Copier les valeurs actuelles vers la colonne temporaire
UPDATE app_users SET role_temp = role::text;

-- ============================================================
-- ÉTAPE 3: CONVERTIR LA COLONNE ROLE EN TEXT
-- ============================================================

-- Supprimer la contrainte de type sur la colonne role
ALTER TABLE app_users ALTER COLUMN role TYPE VARCHAR(50) USING role::text;

-- ============================================================
-- ÉTAPE 4: MIGRATION DES VALEURS DE RÔLES
-- ============================================================

-- SUPER_ADMIN -> DIRECTION
UPDATE app_users SET role = 'DIRECTION' WHERE role = 'SUPER_ADMIN';

-- DIRECTOR -> DIRECTION
UPDATE app_users SET role = 'DIRECTION' WHERE role = 'DIRECTOR';

-- BRANCH_MANAGER -> SUPERVISEUR
UPDATE app_users SET role = 'SUPERVISEUR' WHERE role = 'BRANCH_MANAGER';

-- CREDIT_OFFICER -> AGENT_CREDIT
UPDATE app_users SET role = 'AGENT_CREDIT' WHERE role = 'CREDIT_OFFICER';

-- TELLER -> CAISSIER
UPDATE app_users SET role = 'CAISSIER' WHERE role = 'TELLER';

-- ============================================================
-- ÉTAPE 5: SUPPRIMER L'ANCIEN ENUM ET CRÉER LE NOUVEAU
-- ============================================================

-- Supprimer l'ancien type enum s'il existe
DROP TYPE IF EXISTS "UserRole";

-- Créer le nouveau type enum avec les bonnes valeurs
CREATE TYPE "UserRole" AS ENUM (
  'DIRECTION',
  'ADMIN_IT',
  'COMPTABILITE',
  'CAISSIER',
  'AGENT_CREDIT',
  'SUPERVISEUR'
);

-- ============================================================
-- ÉTAPE 6: RECONVERTIR LA COLONNE EN ENUM
-- ============================================================

-- Reconvertir la colonne role en type enum
ALTER TABLE app_users
  ALTER COLUMN role TYPE "UserRole"
  USING role::"UserRole";

-- Définir la valeur par défaut
ALTER TABLE app_users ALTER COLUMN role SET DEFAULT 'CAISSIER'::"UserRole";

-- Supprimer la colonne temporaire
ALTER TABLE app_users DROP COLUMN IF EXISTS role_temp;

-- ============================================================
-- ÉTAPE 7: S'ASSURER QUE L'ADMIN EXISTE
-- ============================================================

-- S'assurer que admin@hopefund.com a le rôle DIRECTION
UPDATE app_users SET role = 'DIRECTION' WHERE email = 'admin@hopefund.com';

-- Créer un admin si aucun n'existe
-- Mot de passe: Admin123! (hashé avec bcrypt 12 rounds)
INSERT INTO app_users (email, password_hash, nom, prenom, role, is_active, created_at, updated_at)
SELECT
  'admin@hopefund.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X.nOaJh5VHqBvqOBq',
  'Administrateur',
  'Hopefund',
  'DIRECTION',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'admin@hopefund.com');

-- ============================================================
-- ÉTAPE 8: VÉRIFICATION FINALE
-- ============================================================

-- Afficher les utilisateurs après migration
SELECT id, email, nom, prenom, role, is_active, last_login FROM app_users ORDER BY id;

-- Vérifier que l'enum a les bonnes valeurs
SELECT unnest(enum_range(NULL::"UserRole")) AS role;

-- ============================================================
-- INFORMATIONS DE CONNEXION ADMIN
-- ============================================================
-- Email: admin@hopefund.com
-- Mot de passe: Admin123!
-- Rôle: DIRECTION (accès complet à toutes les fonctionnalités)
-- ============================================================
