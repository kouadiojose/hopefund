import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/clients - Liste des clients
router.get('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(
      parseInt(req.query.limit as string) || config.defaultPageSize,
      config.maxPageSize
    );
    const search = req.query.search as string;
    const agencyId = req.user?.agenceId;

    const where: any = {};

    // Filter by agency for non-admin users
    if (agencyId && !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role)) {
      where.id_ag = agencyId;
    }

    // Search by name, phone, or ID
    if (search) {
      where.OR = [
        { pp_nom: { contains: search, mode: 'insensitive' } },
        { pp_prenom: { contains: search, mode: 'insensitive' } },
        { pm_raison_sociale: { contains: search, mode: 'insensitive' } },
        { num_tel: { contains: search } },
        { num_port: { contains: search } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        select: {
          id_client: true,
          id_ag: true,
          statut_juridique: true,
          pp_nom: true,
          pp_prenom: true,
          pp_sexe: true,
          pm_raison_sociale: true,
          num_tel: true,
          num_port: true,
          email: true,
          etat: true,
          date_adh: true,
          nbre_credits: true,
          _count: {
            select: { comptes: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date_creation: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      data: clients.map(c => ({
        ...c,
        nom_complet: c.statut_juridique === 1
          ? `${c.pp_prenom || ''} ${c.pp_nom || ''}`.trim()
          : c.pm_raison_sociale,
        nombre_comptes: c._count.comptes,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id - Détail client
router.get('/:id', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    const client = await prisma.client.findUnique({
      where: { id_client: clientId },
      include: {
        comptes: {
          select: {
            id_cpte: true,
            num_complet_cpte: true,
            intitule_compte: true,
            solde: true,
            devise: true,
            etat_cpte: true,
            date_ouvert: true,
          },
        },
        dossiers_credit: {
          select: {
            id_doss: true,
            mnt_dem: true,
            cre_mnt_octr: true,
            cre_etat: true,
            cre_date_debloc: true,
            duree_mois: true,
          },
          orderBy: { date_creation: 'desc' },
          take: 10,
        },
      },
    });

    if (!client) {
      throw new AppError('Client not found', 404);
    }

    // Check agency access
    if (req.user!.agenceId &&
        !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role) &&
        client.id_ag !== req.user!.agenceId) {
      throw new AppError('Access denied', 403);
    }

    res.json(client);
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id/accounts - Comptes du client
router.get('/:id/accounts', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    const accounts = await prisma.compte.findMany({
      where: { id_titulaire: clientId },
      orderBy: { date_creation: 'desc' },
    });

    res.json(accounts);
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id/loans - Prêts du client
router.get('/:id/loans', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    const loans = await prisma.dossierCredit.findMany({
      where: { id_client: clientId },
      include: {
        echeances: {
          orderBy: { date_ech: 'asc' },
        },
      },
      orderBy: { date_creation: 'desc' },
    });

    res.json(loans);
  } catch (error) {
    next(error);
  }
});

// POST /api/clients - Créer un client (simplifié)
router.post('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const schema = z.object({
      statut_juridique: z.number().min(1).max(3),
      // Personne physique
      pp_nom: z.string().optional(),
      pp_prenom: z.string().optional(),
      pp_date_naissance: z.string().optional(),
      pp_sexe: z.number().optional(),
      pp_nationalite: z.number().optional(),
      // Personne morale
      pm_raison_sociale: z.string().optional(),
      // Contact
      adresse: z.string().optional(),
      ville: z.string().optional(),
      num_tel: z.string().optional(),
      num_port: z.string().optional(),
      email: z.string().email().optional(),
    });

    const data = schema.parse(req.body);

    const client = await prisma.client.create({
      data: {
        ...data,
        id_ag: req.user!.agenceId || 1,
        pp_date_naissance: data.pp_date_naissance ? new Date(data.pp_date_naissance) : null,
        etat: 1, // Actif
        utilis_crea: req.user!.userId,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'CREATE',
        entity: 'Client',
        entity_id: client.id_client.toString(),
        new_values: data,
        ip_address: req.ip || null,
      },
    });

    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
});

export default router;
