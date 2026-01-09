-- Script pour créer un utilisateur Super Admin dans Hopefund
-- À exécuter sur la base de données PostgreSQL

-- Créer un utilisateur SUPER_ADMIN si il n'existe pas
-- Mot de passe: Admin123! (hashé avec bcrypt 12 rounds)
INSERT INTO app_users (email, password_hash, nom, prenom, role, is_active, created_at, updated_at)
SELECT
  'admin@hopefund.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X.nOaJh5VHqBvqOBq',
  'Administrateur',
  'Hopefund',
  'SUPER_ADMIN',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'admin@hopefund.com');

-- Si l'utilisateur existe déjà, mettre à jour son rôle
UPDATE app_users
SET role = 'SUPER_ADMIN', is_active = true
WHERE email = 'admin@hopefund.com';

-- Vérifier
SELECT id, email, nom, prenom, role, is_active FROM app_users WHERE email = 'admin@hopefund.com';

-- ============================================================
-- INFORMATIONS DE CONNEXION
-- ============================================================
-- Email: admin@hopefund.com
-- Mot de passe: Admin123!
-- Rôle: SUPER_ADMIN (accès complet)
--
-- Rôles disponibles:
--   SUPER_ADMIN    - Accès complet à tout le système
--   DIRECTOR       - Lecture globale + validation
--   BRANCH_MANAGER - Gestion d'agence
--   CREDIT_OFFICER - Gestion des crédits
--   TELLER         - Opérations de caisse
-- ============================================================
