import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { AppError } from './error-handler';

const prisma = new PrismaClient();

// Cache des permissions par rôle (rechargé toutes les 5 minutes)
let permissionCache: Map<UserRole, Set<string>> = new Map();
let cacheLastUpdated = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadPermissions() {
  const now = Date.now();
  if (now - cacheLastUpdated < CACHE_TTL && permissionCache.size > 0) {
    return;
  }

  try {
    const rolePermissions = await prisma.rolePermission.findMany({
      include: { permission: true },
    });

    const newCache = new Map<UserRole, Set<string>>();

    for (const rp of rolePermissions) {
      if (!newCache.has(rp.role)) {
        newCache.set(rp.role, new Set());
      }
      newCache.get(rp.role)!.add(rp.permission.code);
    }

    permissionCache = newCache;
    cacheLastUpdated = now;
  } catch (error) {
    // Si la table n'existe pas encore, utiliser les permissions par défaut
    console.warn('Could not load permissions from database, using defaults');
    permissionCache = getDefaultPermissions();
    cacheLastUpdated = now;
  }
}

// Permissions par défaut si la base de données n'est pas encore migrée
function getDefaultPermissions(): Map<UserRole, Set<string>> {
  const defaults = new Map<UserRole, Set<string>>();

  // Super Admin et Director ont accès à tout
  const allPermissions = new Set([
    'CLIENT_VIEW', 'CLIENT_CREATE', 'CLIENT_EDIT', 'CLIENT_CONSULT',
    'EPARGNE_VIEW', 'EPARGNE_DEPOSIT', 'EPARGNE_WITHDRAWAL', 'EPARGNE_TRANSFER',
    'CREDIT_VIEW', 'CREDIT_CREATE', 'CREDIT_APPROVE', 'CREDIT_CONSULT',
    'GUICHET_VIEW', 'GUICHET_VIEW_TRANSACTIONS',
    'SYSTEME_VIEW', 'SYSTEME_OPEN_AGENCY', 'SYSTEME_CLOSE_AGENCY',
    'PARAM_VIEW', 'PARAM_USERS_VIEW', 'PARAM_USER_ADD', 'PARAM_USER_EDIT',
    'RAPPORTS_VIEW', 'RAPPORTS_CLIENT', 'RAPPORTS_CREDIT',
    'COMPTA_VIEW', 'COMPTA_OPERATIONS',
    'BUDGET_VIEW',
  ]);

  defaults.set(UserRole.SUPER_ADMIN, allPermissions);
  defaults.set(UserRole.DIRECTOR, allPermissions);

  // Branch Manager
  defaults.set(UserRole.BRANCH_MANAGER, new Set([
    'CLIENT_VIEW', 'CLIENT_CONSULT', 'CLIENT_CREATE', 'CLIENT_EDIT',
    'EPARGNE_VIEW', 'EPARGNE_CONSULT', 'EPARGNE_DEPOSIT', 'EPARGNE_WITHDRAWAL',
    'EPARGNE_WITHDRAWAL_AUTH', 'EPARGNE_BLOCK_ACCOUNT',
    'CREDIT_VIEW', 'CREDIT_CONSULT', 'CREDIT_APPROVE', 'CREDIT_REJECT',
    'GUICHET_VIEW', 'GUICHET_VIEW_TRANSACTIONS', 'GUICHET_VIEW_ALL_TRANSACTIONS',
    'SYSTEME_VIEW', 'SYSTEME_OPEN_AGENCY', 'SYSTEME_CLOSE_AGENCY',
    'PARAM_VIEW', 'PARAM_USERS_VIEW',
    'RAPPORTS_VIEW', 'RAPPORTS_CLIENT', 'RAPPORTS_CREDIT', 'RAPPORTS_AGENCY',
  ]));

  // Credit Officer
  defaults.set(UserRole.CREDIT_OFFICER, new Set([
    'CLIENT_VIEW', 'CLIENT_CONSULT', 'CLIENT_CREATE', 'CLIENT_EDIT',
    'EPARGNE_VIEW', 'EPARGNE_CONSULT',
    'CREDIT_VIEW', 'CREDIT_CONSULT', 'CREDIT_CREATE', 'CREDIT_EDIT', 'CREDIT_SIMULATE',
    'GUICHET_VIEW',
    'RAPPORTS_VIEW', 'RAPPORTS_CREDIT',
  ]));

  // Teller (Caissier)
  defaults.set(UserRole.TELLER, new Set([
    'CLIENT_VIEW', 'CLIENT_CONSULT', 'CLIENT_CREATE',
    'EPARGNE_VIEW', 'EPARGNE_DEPOSIT', 'EPARGNE_WITHDRAWAL', 'EPARGNE_CONSULT',
    'CREDIT_VIEW', 'CREDIT_CONSULT', 'CREDIT_REPAYMENT',
    'GUICHET_VIEW', 'GUICHET_VIEW_TRANSACTIONS',
    'RAPPORTS_VIEW',
  ]));

  return defaults;
}

// Vérifier si un utilisateur a une permission spécifique
export async function hasPermission(role: UserRole, permissionCode: string): Promise<boolean> {
  await loadPermissions();

  const rolePerms = permissionCache.get(role);
  if (!rolePerms) return false;

  return rolePerms.has(permissionCode);
}

// Vérifier si un utilisateur a au moins une des permissions
export async function hasAnyPermission(role: UserRole, permissionCodes: string[]): Promise<boolean> {
  await loadPermissions();

  const rolePerms = permissionCache.get(role);
  if (!rolePerms) return false;

  return permissionCodes.some(code => rolePerms.has(code));
}

// Vérifier si un utilisateur a toutes les permissions
export async function hasAllPermissions(role: UserRole, permissionCodes: string[]): Promise<boolean> {
  await loadPermissions();

  const rolePerms = permissionCache.get(role);
  if (!rolePerms) return false;

  return permissionCodes.every(code => rolePerms.has(code));
}

// Middleware pour vérifier une permission
export function requirePermission(...permissionCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Non authentifié', 401);
      }

      const userRole = req.user.role as UserRole;

      // Super Admin et Director ont accès à tout
      if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.DIRECTOR) {
        return next();
      }

      const hasAccess = await hasAnyPermission(userRole, permissionCodes);

      if (!hasAccess) {
        throw new AppError('Permission refusée', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Middleware pour vérifier l'accès à un module
export function requireModule(moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Non authentifié', 401);
      }

      const userRole = req.user.role as UserRole;

      // Super Admin et Director ont accès à tout
      if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.DIRECTOR) {
        return next();
      }

      // Vérifier si l'utilisateur a au moins une permission dans ce module
      const viewPermission = `${moduleCode}_VIEW`;
      const hasAccess = await hasPermission(userRole, viewPermission);

      if (!hasAccess) {
        throw new AppError(`Accès au module ${moduleCode} refusé`, 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Obtenir toutes les permissions d'un rôle
export async function getRolePermissions(role: UserRole): Promise<string[]> {
  await loadPermissions();

  const rolePerms = permissionCache.get(role);
  if (!rolePerms) return [];

  return Array.from(rolePerms);
}

// Rafraîchir le cache des permissions
export function refreshPermissionCache() {
  cacheLastUpdated = 0;
}
