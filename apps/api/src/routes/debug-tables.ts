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
    const echeances = await prisma.$queryRaw`
      SELECT * FROM ad_sre WHERE id_doss = ${creditId} ORDER BY date_ech
    ` as any[];
    res.json({ creditId, count: echeances.length, echeances });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check all movements/transactions related to a credit account
router.get('/credit/:id/movements', async (req, res) => {
  try {
    const creditId = parseInt(req.params.id);
    
    // First get the credit details
    const credit = await prisma.$queryRaw`
      SELECT * FROM ad_dcr WHERE id_doss = ${creditId}
    ` as any[];
    
    if (credit.length === 0) {
      return res.json({ error: 'Credit not found' });
    }
    
    // Get the account linked to this credit
    const accountId = credit[0].cre_id_cpte;
    
    // Get all movements for this account
    const movements = await prisma.$queryRaw`
      SELECT * FROM ad_mouvement 
      WHERE cpte_interne_cli = ${accountId}
      ORDER BY date_valeur DESC
      LIMIT 50
    ` as any[];
    
    // Also try to find ecritures
    const ecritures = await prisma.$queryRaw`
      SELECT * FROM ad_ecriture
      WHERE id_doss = ${creditId}
      ORDER BY date_ecriture DESC
      LIMIT 50
    ` as any[];
    
    res.json({ 
      credit: credit[0], 
      accountId,
      movements: { count: movements.length, data: movements },
      ecritures: { count: ecritures.length, data: ecritures }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
