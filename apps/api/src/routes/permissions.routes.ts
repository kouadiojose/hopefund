import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { ModuleType } from '@prisma/client';
import { refreshPermissionCache } from '../middleware/permission.middleware';

// Rôles disponibles
const VALID_ROLES = ['SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER'] as const;
type UserRole = typeof VALID_ROLES[number];

const router = Router();

// All permission routes require authentication and SUPER_ADMIN or DIRECTOR role
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'DIRECTOR'));

// ==================== PERMISSIONS ====================

// GET /api/permissions - Liste toutes les permissions
router.get('/', async (req, res, next) => {
  try {
    const module = req.query.module as ModuleType | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};

    if (module) {
      where.module = module;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const permissions = await prisma.permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    // Group by module
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {} as Record<string, typeof permissions>);

    res.json({
      data: permissions,
      grouped,
      total: permissions.length,
      modules: Object.keys(ModuleType),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/permissions/modules - Liste des modules
router.get('/modules', async (req, res) => {
  const modules = [
    { code: 'CLIENT', label: 'Gestion Clients', description: 'Gestion des clients et leurs informations', icon: 'Users' },
    { code: 'EPARGNE', label: 'Épargne', description: 'Gestion des comptes d\'épargne', icon: 'PiggyBank' },
    { code: 'CREDIT', label: 'Crédit', description: 'Gestion des dossiers de crédit', icon: 'FileText' },
    { code: 'GUICHET', label: 'Guichet', description: 'Opérations de caisse', icon: 'Receipt' },
    { code: 'SYSTEME', label: 'Système', description: 'Administration système', icon: 'Settings' },
    { code: 'PARAMETRAGE', label: 'Paramétrage', description: 'Configuration du système', icon: 'Sliders' },
    { code: 'RAPPORTS', label: 'Rapports', description: 'Génération de rapports', icon: 'BarChart3' },
    { code: 'DIRECTOR', label: 'Comptabilité', description: 'Opérations comptables', icon: 'Calculator' },
    { code: 'LIGNE_CREDIT', label: 'Ligne de Crédit', description: 'Gestion des lignes de crédit', icon: 'CreditCard' },
    { code: 'BUDGET', label: 'Budget', description: 'Gestion budgétaire', icon: 'Wallet' },
  ];

  // Get permission counts per module
  const counts = await prisma.permission.groupBy({
    by: ['module'],
    _count: { id: true },
  });

  const countMap = new Map(counts.map(c => [c.module, c._count.id]));

  res.json(modules.map(m => ({
    ...m,
    permissionCount: countMap.get(m.code as ModuleType) || 0,
  })));
});

// GET /api/permissions/:id - Détail d'une permission
router.get('/:id', async (req, res, next) => {
  try {
    const permissionId = parseInt(req.params.id);

    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        role_permissions: true,
      },
    });

    if (!permission) {
      throw new AppError('Permission not found', 404);
    }

    // Get which roles have this permission
    const rolesWithPermission = permission.role_permissions.map(rp => rp.role);

    res.json({
      ...permission,
      roles: rolesWithPermission,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/permissions - Créer une permission
router.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      code: z.string().min(1).max(100),
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      module: z.nativeEnum(ModuleType),
    });

    const data = schema.parse(req.body);

    // Check if code already exists
    const existing = await prisma.permission.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new AppError('Permission code already exists', 400);
    }

    const permission = await prisma.permission.create({
      data,
    });

    logger.info(`Permission created: ${permission.code} by ${req.user!.email}`);
    refreshPermissionCache();

    res.status(201).json(permission);
  } catch (error) {
    next(error);
  }
});

// PUT /api/permissions/:id - Modifier une permission
router.put('/:id', async (req, res, next) => {
  try {
    const permissionId = parseInt(req.params.id);

    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional().nullable(),
      module: z.nativeEnum(ModuleType).optional(),
    });

    const data = schema.parse(req.body);

    const permission = await prisma.permission.update({
      where: { id: permissionId },
      data,
    });

    logger.info(`Permission updated: ${permission.code} by ${req.user!.email}`);
    refreshPermissionCache();

    res.json(permission);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/permissions/:id - Supprimer une permission
router.delete('/:id', async (req, res, next) => {
  try {
    const permissionId = parseInt(req.params.id);

    const permission = await prisma.permission.delete({
      where: { id: permissionId },
    });

    logger.info(`Permission deleted: ${permission.code} by ${req.user!.email}`);
    refreshPermissionCache();

    res.json({ message: 'Permission deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ==================== ROLE PERMISSIONS ====================

// GET /api/permissions/roles/:role - Permissions d'un rôle
router.get('/roles/:role', async (req, res, next) => {
  try {
    const role = req.params.role;

    if (!VALID_ROLES.includes(role as UserRole)) {
      throw new AppError('Invalid role', 400);
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });

    const permissionsByModule = rolePermissions.reduce((acc, rp) => {
      const module = rp.permission.module;
      if (!acc[module]) {
        acc[module] = [];
      }
      acc[module].push(rp.permission);
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      role,
      permissions: rolePermissions.map(rp => rp.permission),
      permissionsByModule,
      total: rolePermissions.length,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/permissions/roles/:role - Définir les permissions d'un rôle
router.put('/roles/:role', async (req, res, next) => {
  try {
    const role = req.params.role;

    if (!VALID_ROLES.includes(role as UserRole)) {
      throw new AppError('Invalid role', 400);
    }

    // Don't allow modifying SUPER_ADMIN or DIRECTOR permissions (they have all)
    if (role === 'SUPER_ADMIN' || role === 'DIRECTOR') {
      throw new AppError('Cannot modify SUPER_ADMIN or DIRECTOR permissions - they have full access', 400);
    }

    const schema = z.object({
      permissionIds: z.array(z.number()),
    });

    const { permissionIds } = schema.parse(req.body);

    // Delete existing permissions for this role
    await prisma.rolePermission.deleteMany({
      where: { role },
    });

    // Create new permissions
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(permission_id => ({
          role,
          permission_id,
        })),
        skipDuplicates: true,
      });
    }

    logger.info(`Role permissions updated: ${role} by ${req.user!.email}`);
    refreshPermissionCache();

    // Return updated permissions
    const updatedPermissions = await prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });

    res.json({
      role,
      permissions: updatedPermissions.map(rp => rp.permission),
      total: updatedPermissions.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/permissions/roles/:role/add - Ajouter une permission à un rôle
router.post('/roles/:role/add', async (req, res, next) => {
  try {
    const role = req.params.role;

    if (!VALID_ROLES.includes(role as UserRole)) {
      throw new AppError('Invalid role', 400);
    }

    const schema = z.object({
      permissionId: z.number(),
    });

    const { permissionId } = schema.parse(req.body);

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new AppError('Permission not found', 404);
    }

    // Check if already assigned
    const existing = await prisma.rolePermission.findFirst({
      where: {
        role,
        permission_id: permissionId,
      },
    });

    if (existing) {
      throw new AppError('Permission already assigned to this role', 400);
    }

    await prisma.rolePermission.create({
      data: {
        role,
        permission_id: permissionId,
      },
    });

    logger.info(`Permission ${permission.code} added to ${role} by ${req.user!.email}`);
    refreshPermissionCache();

    res.json({ message: 'Permission added successfully' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/permissions/roles/:role/remove/:permissionId - Retirer une permission d'un rôle
router.delete('/roles/:role/remove/:permissionId', async (req, res, next) => {
  try {
    const role = req.params.role;
    const permissionId = parseInt(req.params.permissionId);

    if (!VALID_ROLES.includes(role as UserRole)) {
      throw new AppError('Invalid role', 400);
    }

    await prisma.rolePermission.deleteMany({
      where: {
        role,
        permission_id: permissionId,
      },
    });

    logger.info(`Permission ${permissionId} removed from ${role} by ${req.user!.email}`);
    refreshPermissionCache();

    res.json({ message: 'Permission removed successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/permissions/matrix - Matrice complète rôles/permissions
router.get('/matrix', async (req, res, next) => {
  try {
    // Get all permissions
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    // Get all role permissions
    const rolePermissions = await prisma.rolePermission.findMany();

    // Build the matrix
    const roles = VALID_ROLES;
    const matrix: Record<string, Record<string, boolean>> = {};

    for (const role of roles) {
      matrix[role] = {};
      const rolePerms = rolePermissions.filter(rp => rp.role === role);
      const permIds = new Set(rolePerms.map(rp => rp.permission_id));

      for (const perm of permissions) {
        // SUPER_ADMIN and DIRECTOR have all permissions
        if (role === 'SUPER_ADMIN' || role === 'DIRECTOR') {
          matrix[role][perm.code] = true;
        } else {
          matrix[role][perm.code] = permIds.has(perm.id);
        }
      }
    }

    res.json({
      permissions: permissions.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        module: p.module,
      })),
      roles,
      matrix,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
