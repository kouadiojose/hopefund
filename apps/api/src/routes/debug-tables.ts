// Temporary debug route to explore database tables
import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// List all tables in the database
router.get('/tables', async (req, res) => {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    ` as any[];
    res.json(tables.map(t => t.table_name));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get columns for a specific table
router.get('/columns/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, table) as any[];
    res.json(columns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sample data from a table
router.get('/sample/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;
    // Sanitize table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" LIMIT ${limit}`) as any[];
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search for loan-related tables
router.get('/loan-tables', async (req, res) => {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%cre%' 
          OR table_name LIKE '%dcr%' 
          OR table_name LIKE '%ech%'
          OR table_name LIKE '%sre%'
          OR table_name LIKE '%rem%'
          OR table_name LIKE '%pai%'
          OR table_name LIKE '%mvt%'
          OR table_name LIKE '%mou%'
          OR table_name LIKE '%ecr%'
          OR table_name LIKE '%his%')
      ORDER BY table_name
    ` as any[];
    res.json(tables.map(t => t.table_name));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check ad_sre data for a specific credit
router.get('/credit/:id/echeances', async (req, res) => {
  try {
    const creditId = parseInt(req.params.id);

    // First get the columns of ad_sre
    const columns = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'ad_sre'
    ` as any[];

    // Get echeances
    const echeances = await prisma.$queryRawUnsafe(
      `SELECT * FROM ad_sre WHERE id_doss = $1 ORDER BY id_ech`,
      creditId
    ) as any[];

    res.json({
      creditId,
      columns: columns.map((c: any) => c.column_name),
      count: echeances.length,
      echeances
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment history from ad_sre table (contains actual payment records)
router.get('/credit/:id/payments', async (req, res) => {
  try {
    const creditId = parseInt(req.params.id);

    // Get payment history from ad_sre (this table contains the payment records)
    const payments = await prisma.$queryRawUnsafe(`
      SELECT * FROM ad_sre WHERE id_doss = $1 ORDER BY date_remb DESC
    `, creditId) as any[];

    // Get credit details
    const credit = await prisma.$queryRawUnsafe(`
      SELECT id_doss, id_client, cre_mnt_octr, cre_date_debloc, cre_date_approb, cre_etat, duree_mois
      FROM ad_dcr WHERE id_doss = $1
    `, creditId) as any[];

    // Calculate totals
    const totals = payments.reduce((acc: any, p: any) => ({
      capital: acc.capital + Number(p.mnt_remb_cap || 0),
      interet: acc.interet + Number(p.mnt_remb_int || 0),
      penalite: acc.penalite + Number(p.mnt_remb_pen || 0),
      garantie: acc.garantie + Number(p.mnt_remb_gar || 0),
    }), { capital: 0, interet: 0, penalite: 0, garantie: 0 });

    res.json({
      creditId,
      credit: credit[0] || null,
      payments: {
        count: payments.length,
        totals,
        totalRembourse: totals.capital + totals.interet + totals.penalite + totals.garantie,
        data: payments.map((p: any) => ({
          id_ech: p.id_ech,
          num_remb: p.num_remb,
          date_remb: p.date_remb,
          mnt_remb_cap: Number(p.mnt_remb_cap || 0),
          mnt_remb_int: Number(p.mnt_remb_int || 0),
          mnt_remb_pen: Number(p.mnt_remb_pen || 0),
          mnt_remb_gar: Number(p.mnt_remb_gar || 0),
          total: Number(p.mnt_remb_cap || 0) + Number(p.mnt_remb_int || 0) + Number(p.mnt_remb_pen || 0),
          annul_remb: p.annul_remb,
          date_creation: p.date_creation,
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get full credit details with payment history
router.get('/credit/:id/full', async (req, res) => {
  try {
    const creditId = parseInt(req.params.id);

    // Get credit details
    const credit = await prisma.$queryRawUnsafe(`
      SELECT * FROM ad_dcr WHERE id_doss = $1
    `, creditId) as any[];

    if (credit.length === 0) {
      return res.json({ error: 'Credit not found' });
    }

    // Get payment history from ad_sre
    const payments = await prisma.$queryRawUnsafe(`
      SELECT * FROM ad_sre WHERE id_doss = $1 ORDER BY date_remb
    `, creditId) as any[];

    // Get client info
    const client = await prisma.$queryRawUnsafe(`
      SELECT id_client, pp_nom, pp_prenom, pm_raison_sociale FROM ad_cli WHERE id_client = $1
    `, credit[0].id_client) as any[];

    // Calculate summary
    const totalCapital = payments.reduce((s: number, p: any) => s + Number(p.mnt_remb_cap || 0), 0);
    const totalInteret = payments.reduce((s: number, p: any) => s + Number(p.mnt_remb_int || 0), 0);
    const totalPenalite = payments.reduce((s: number, p: any) => s + Number(p.mnt_remb_pen || 0), 0);

    res.json({
      credit: credit[0],
      client: client[0] || null,
      payments: {
        count: payments.length,
        data: payments.map((p: any) => ({
          id_ech: p.id_ech,
          num_remb: p.num_remb,
          date_remb: p.date_remb,
          mnt_remb_cap: Number(p.mnt_remb_cap || 0),
          mnt_remb_int: Number(p.mnt_remb_int || 0),
          mnt_remb_pen: Number(p.mnt_remb_pen || 0),
          mnt_remb_gar: Number(p.mnt_remb_gar || 0),
          annul_remb: p.annul_remb,
        }))
      },
      summary: {
        montantOctroye: Number(credit[0].cre_mnt_octr || 0),
        dateDeblocage: credit[0].cre_date_debloc,
        dateApprobation: credit[0].cre_date_approb,
        etat: credit[0].cre_etat,
        totalPaiements: payments.length,
        totalCapitalRembourse: totalCapital,
        totalInteretRembourse: totalInteret,
        totalPenaliteRembourse: totalPenalite,
        totalRembourse: totalCapital + totalInteret + totalPenalite,
        soldeRestant: Number(credit[0].cre_mnt_octr || 0) - totalCapital,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: Get client credits with payments
router.get('/client/:id/credits-debug', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    // Get all credits for this client
    const credits = await prisma.$queryRawUnsafe(`
      SELECT id_doss, id_ag, id_client, cre_mnt_octr, cre_date_debloc, cre_etat, duree_mois
      FROM ad_dcr WHERE id_client = $1
    `, clientId) as any[];

    // For each credit, get payments from ad_sre
    const creditsWithPayments = await Promise.all(
      credits.map(async (credit: any) => {
        const payments = await prisma.$queryRawUnsafe(`
          SELECT id_ech, num_remb, date_remb, mnt_remb_cap, mnt_remb_int, mnt_remb_pen, annul_remb
          FROM ad_sre WHERE id_doss = $1 AND id_ag = $2
          ORDER BY date_remb
        `, credit.id_doss, credit.id_ag) as any[];

        return {
          id_doss: credit.id_doss,
          id_ag: credit.id_ag,
          montant_octroye: Number(credit.cre_mnt_octr || 0),
          date_deblocage: credit.cre_date_debloc,
          etat: credit.cre_etat,
          payments_count: payments.length,
          payments: payments.map((p: any) => ({
            date_remb: p.date_remb,
            capital: Number(p.mnt_remb_cap || 0),
            interet: Number(p.mnt_remb_int || 0),
            penalite: Number(p.mnt_remb_pen || 0),
            total: Number(p.mnt_remb_cap || 0) + Number(p.mnt_remb_int || 0) + Number(p.mnt_remb_pen || 0),
          }))
        };
      })
    );

    res.json({
      clientId,
      totalCredits: credits.length,
      credits: creditsWithPayments
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
