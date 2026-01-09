-- Script pour créer/mettre à jour un utilisateur ADMIN_IT
-- À exécuter sur la base de données PostgreSQL de Hopefund

-- ============================================================
-- COMPTE ADMIN EXISTANT (de seed.ts):
-- Email: admin@hopefund.com
-- Mot de passe: Admin123!
-- Rôle: DIRECTION ou SUPER_ADMIN (a tous les accès)
-- ============================================================

-- Option 1: Créer un nouvel utilisateur ADMIN_IT
-- Le mot de passe 'Admin123!' hashé avec bcrypt (12 rounds)
INSERT INTO app_users (email, password_hash, nom, prenom, role, is_active, created_at, updated_at)
VALUES (
  'adminit@hopefund.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X.nOaJh5VHqBvqOBq',
  'Admin',
  'IT',
  'ADMIN_IT',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET role = 'ADMIN_IT';

-- Option 2: Mettre à jour l'utilisateur admin existant vers ADMIN_IT
-- UPDATE app_users SET role = 'ADMIN_IT' WHERE email = 'admin@hopefund.com';

-- Vérifier les utilisateurs
SELECT id, email, nom, prenom, role, is_active FROM app_users ORDER BY id;
