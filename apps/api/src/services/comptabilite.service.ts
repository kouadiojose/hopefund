/**
 * Service de comptabilité automatique
 * Génère automatiquement les écritures comptables pour les opérations bancaires
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

// ==================== COMPTES COMPTABLES ====================
// Plan comptable Hopefund basé sur le plan des établissements financiers au Burundi

export const COMPTES = {
  // Classe 1 - Trésorerie
  COFFRE_FORT_SIEGE: '1.0.1.1',
  COFFRE_FORT_MAKAMBA: '1.0.1.2',
  COFFRE_FORT_JABE: '1.0.1.3',
  COFFRE_FORT_KAMENGE: '1.0.1.4',
  COFFRE_FORT_NYANZA: '1.0.1.5',
  CAISSE_GUICHETIER: '1.0.2',
  BRB_COMPTE: '1.1.1.1',
  BANCOBU: '1.1.1.2',
  BGF: '1.1.1.3',

  // Classe 2 - Opérations clientèle
  CREDITS_CT_AGRICULTURE: '2.1.1.1',
  CREDITS_CT_COMMERCE: '2.1.1.2',
  CREDITS_CT_CONSOMMATION: '2.1.1.3',
  CREDITS_CT_HABITAT: '2.1.1.4',
  CREDITS_CT_ELEVAGE: '2.1.1.5',
  CREDITS_CT_AUTRES: '2.1.1.6',
  CREDITS_MT: '2.1.2',
  CREDITS_LT: '2.1.3',
  INTERETS_COURUS: '2.1.8',
  CREANCES_SOUFFRANCE: '2.1.9',
  DEPOTS_VUE_INDIVIDUS: '2.2.1.1',
  DEPOTS_VUE_GROUPEMENTS: '2.2.1.2',
  DEPOTS_TERME: '2.2.2',
  EPARGNE_BLOQUEE: '2.2.3',

  // Classe 3 - Opérations diverses
  MANQUANT_CAISSE: '3.4.5',
  EXCEDENT_CAISSE: '3.4.6',

  // Classe 5 - Fonds propres
  CAPITAL: '5.5.1',
  RESERVES: '5.4.1',
  RESULTAT_EXERCICE: '5.6.1',

  // Classe 6 - Charges
  INTERETS_DEPOTS: '6.0.1',
  FRAIS_PERSONNEL: '6.5.1',
  CHARGES_DIVERSES: '6.6.1',

  // Classe 7 - Produits
  INTERETS_CREDITS: '7.0.1',
  FRAIS_DOSSIER: '7.1.1',
  COMMISSIONS: '7.1.2',
  FRAIS_TENUE_COMPTE: '7.1.3',
  PRODUITS_DIVERS: '7.2.1',
};

// Mapping des objets de crédit vers les comptes comptables
const CREDIT_COMPTE_MAP: Record<number, string> = {
  1: COMPTES.CREDITS_CT_AGRICULTURE,
  2: COMPTES.CREDITS_CT_COMMERCE,
  3: COMPTES.CREDITS_CT_CONSOMMATION,
  4: COMPTES.CREDITS_CT_HABITAT,
  5: COMPTES.CREDITS_CT_ELEVAGE,
  6: COMPTES.CREDITS_CT_AUTRES,
};

// Mapping des agences vers les comptes coffre-fort
const COFFRE_FORT_MAP: Record<number, string> = {
  1: COMPTES.COFFRE_FORT_SIEGE,
  2: COMPTES.COFFRE_FORT_MAKAMBA,
  3: COMPTES.COFFRE_FORT_JABE,
  4: COMPTES.COFFRE_FORT_KAMENGE,
  5: COMPTES.COFFRE_FORT_NYANZA,
};

// ==================== INTERFACE ====================

interface LigneEcriture {
  compte: string;
  sens: 'd' | 'c'; // débit ou crédit
  montant: number;
}

interface EcritureComptable {
  agenceId: number;
  dateValeur: Date;
  libelle: string;
  lignes: LigneEcriture[];
  cpteInterneCli?: number; // ID du compte client si applicable
}

// ==================== FONCTIONS PRINCIPALES ====================

/**
 * Génère un nouvel ID d'écriture
 */
async function getNextEcritureId(agenceId: number): Promise<number> {
  const result = await prisma.$queryRaw<any[]>`
    SELECT COALESCE(MAX(id_ecriture), 0) + 1 as next_id
    FROM ad_mouvement
    WHERE id_ag = ${agenceId}
  `;
  return result[0]?.next_id || 1;
}

/**
 * Enregistre une écriture comptable complète
 */
async function enregistrerEcriture(ecriture: EcritureComptable): Promise<number> {
  const ecritureId = await getNextEcritureId(ecriture.agenceId);

  // Vérifier l'équilibre débit/crédit
  const totalDebit = ecriture.lignes.filter(l => l.sens === 'd').reduce((sum, l) => sum + l.montant, 0);
  const totalCredit = ecriture.lignes.filter(l => l.sens === 'c').reduce((sum, l) => sum + l.montant, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Écriture non équilibrée: Débit=${totalDebit}, Crédit=${totalCredit}`);
  }

  // Enregistrer chaque ligne
  for (const ligne of ecriture.lignes) {
    await prisma.$executeRaw`
      INSERT INTO ad_mouvement (id_ag, id_ecriture, compte, cpte_interne_cli, sens, montant, devise, date_valeur)
      VALUES (
        ${ecriture.agenceId},
        ${ecritureId},
        ${ligne.compte},
        ${ecriture.cpteInterneCli || null},
        ${ligne.sens},
        ${ligne.montant},
        'BIF',
        ${ecriture.dateValeur}
      )
    `;
  }

  logger.info(`Écriture comptable #${ecritureId} créée: ${ecriture.libelle}`);
  return ecritureId;
}

// ==================== ÉCRITURES AUTOMATIQUES ====================

/**
 * Écriture pour un dépôt client
 * Débit: Caisse (ou coffre-fort)
 * Crédit: Dépôt à vue client
 */
export async function ecritureDepot(
  agenceId: number,
  compteClientId: number,
  montant: number,
  libelle?: string
): Promise<number> {
  const coffreFort = COFFRE_FORT_MAP[agenceId] || COMPTES.COFFRE_FORT_SIEGE;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: libelle || 'Dépôt client',
    cpteInterneCli: compteClientId,
    lignes: [
      { compte: coffreFort, sens: 'd', montant },
      { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour un retrait client
 * Débit: Dépôt à vue client
 * Crédit: Caisse (ou coffre-fort)
 */
export async function ecritureRetrait(
  agenceId: number,
  compteClientId: number,
  montant: number,
  libelle?: string
): Promise<number> {
  const coffreFort = COFFRE_FORT_MAP[agenceId] || COMPTES.COFFRE_FORT_SIEGE;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: libelle || 'Retrait client',
    cpteInterneCli: compteClientId,
    lignes: [
      { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'd', montant },
      { compte: coffreFort, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour un virement interne (entre comptes clients)
 * Débit: Compte source
 * Crédit: Compte destination
 */
export async function ecritureVirementInterne(
  agenceId: number,
  compteSourceId: number,
  compteDestId: number,
  montant: number,
  libelle?: string
): Promise<number> {
  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: libelle || 'Virement interne',
    lignes: [
      { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'd', montant },
      { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour un déblocage de crédit
 * Débit: Compte crédit (selon objet)
 * Crédit: Compte client (dépôt à vue)
 */
export async function ecritureDeblocageCredit(
  agenceId: number,
  dossierId: number,
  compteClientId: number,
  montant: number,
  objetCredit: number,
  fraisDossier?: number,
  assurance?: number
): Promise<number[]> {
  const ecritures: number[] = [];
  const compteCredit = CREDIT_COMPTE_MAP[objetCredit] || COMPTES.CREDITS_CT_AUTRES;

  // Écriture principale: Déblocage du crédit
  const ecritureCredit = await enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Déblocage crédit - Dossier ${dossierId}`,
    cpteInterneCli: compteClientId,
    lignes: [
      { compte: compteCredit, sens: 'd', montant },
      { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'c', montant },
    ],
  });
  ecritures.push(ecritureCredit);

  // Frais de dossier (si applicable)
  if (fraisDossier && fraisDossier > 0) {
    const ecritureFrais = await enregistrerEcriture({
      agenceId,
      dateValeur: new Date(),
      libelle: `Frais de dossier - Dossier ${dossierId}`,
      cpteInterneCli: compteClientId,
      lignes: [
        { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'd', montant: fraisDossier },
        { compte: COMPTES.FRAIS_DOSSIER, sens: 'c', montant: fraisDossier },
      ],
    });
    ecritures.push(ecritureFrais);
  }

  // Assurance (si applicable)
  if (assurance && assurance > 0) {
    const ecritureAssurance = await enregistrerEcriture({
      agenceId,
      dateValeur: new Date(),
      libelle: `Assurance crédit - Dossier ${dossierId}`,
      cpteInterneCli: compteClientId,
      lignes: [
        { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'd', montant: assurance },
        { compte: COMPTES.COMMISSIONS, sens: 'c', montant: assurance },
      ],
    });
    ecritures.push(ecritureAssurance);
  }

  logger.info(`Écritures déblocage crédit: Dossier ${dossierId}, Montant: ${montant} BIF`);
  return ecritures;
}

/**
 * Écriture pour un remboursement de crédit (capital)
 * Débit: Compte client (dépôt à vue)
 * Crédit: Compte crédit
 */
export async function ecritureRemboursementCapital(
  agenceId: number,
  dossierId: number,
  compteClientId: number,
  montant: number,
  objetCredit: number
): Promise<number> {
  const compteCredit = CREDIT_COMPTE_MAP[objetCredit] || COMPTES.CREDITS_CT_AUTRES;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Remboursement capital - Dossier ${dossierId}`,
    cpteInterneCli: compteClientId,
    lignes: [
      { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'd', montant },
      { compte: compteCredit, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour paiement d'intérêts sur crédit
 * Débit: Compte client (dépôt à vue)
 * Crédit: Intérêts sur crédits (produit)
 */
export async function ecritureRemboursementInterets(
  agenceId: number,
  dossierId: number,
  compteClientId: number,
  montant: number
): Promise<number> {
  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Intérêts crédit - Dossier ${dossierId}`,
    cpteInterneCli: compteClientId,
    lignes: [
      { compte: COMPTES.DEPOTS_VUE_INDIVIDUS, sens: 'd', montant },
      { compte: COMPTES.INTERETS_CREDITS, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour approvisionnement caisse (coffre vers guichetier)
 * Débit: Caisse guichetier
 * Crédit: Coffre-fort
 */
export async function ecritureApprovisionnementCaisse(
  agenceId: number,
  montant: number,
  guichetierId: number
): Promise<number> {
  const coffreFort = COFFRE_FORT_MAP[agenceId] || COMPTES.COFFRE_FORT_SIEGE;
  const caisseGuichetier = `${COMPTES.CAISSE_GUICHETIER}.${guichetierId}`;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Approvisionnement caisse guichetier ${guichetierId}`,
    lignes: [
      { compte: caisseGuichetier, sens: 'd', montant },
      { compte: coffreFort, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour reversement caisse (guichetier vers coffre)
 * Débit: Coffre-fort
 * Crédit: Caisse guichetier
 */
export async function ecritureReversementCaisse(
  agenceId: number,
  montant: number,
  guichetierId: number
): Promise<number> {
  const coffreFort = COFFRE_FORT_MAP[agenceId] || COMPTES.COFFRE_FORT_SIEGE;
  const caisseGuichetier = `${COMPTES.CAISSE_GUICHETIER}.${guichetierId}`;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Reversement caisse guichetier ${guichetierId}`,
    lignes: [
      { compte: coffreFort, sens: 'd', montant },
      { compte: caisseGuichetier, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour écart de caisse (manquant)
 * Débit: Manquant de caisse à justifier
 * Crédit: Caisse
 */
export async function ecritureManquantCaisse(
  agenceId: number,
  montant: number,
  guichetierId: number
): Promise<number> {
  const caisseGuichetier = `${COMPTES.CAISSE_GUICHETIER}.${guichetierId}`;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Manquant de caisse - Guichetier ${guichetierId}`,
    lignes: [
      { compte: COMPTES.MANQUANT_CAISSE, sens: 'd', montant },
      { compte: caisseGuichetier, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour écart de caisse (excédent)
 * Débit: Caisse
 * Crédit: Excédent de caisse à justifier
 */
export async function ecritureExcedentCaisse(
  agenceId: number,
  montant: number,
  guichetierId: number
): Promise<number> {
  const caisseGuichetier = `${COMPTES.CAISSE_GUICHETIER}.${guichetierId}`;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Excédent de caisse - Guichetier ${guichetierId}`,
    lignes: [
      { compte: caisseGuichetier, sens: 'd', montant },
      { compte: COMPTES.EXCEDENT_CAISSE, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour virement coffre vers banque
 * Débit: Compte banque
 * Crédit: Coffre-fort
 */
export async function ecritureVirementBanque(
  agenceId: number,
  montant: number,
  compteBanque: string = COMPTES.BRB_COMPTE
): Promise<number> {
  const coffreFort = COFFRE_FORT_MAP[agenceId] || COMPTES.COFFRE_FORT_SIEGE;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Virement vers banque`,
    lignes: [
      { compte: compteBanque, sens: 'd', montant },
      { compte: coffreFort, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour retrait banque vers coffre
 * Débit: Coffre-fort
 * Crédit: Compte banque
 */
export async function ecritureRetraitBanque(
  agenceId: number,
  montant: number,
  compteBanque: string = COMPTES.BRB_COMPTE
): Promise<number> {
  const coffreFort = COFFRE_FORT_MAP[agenceId] || COMPTES.COFFRE_FORT_SIEGE;

  return enregistrerEcriture({
    agenceId,
    dateValeur: new Date(),
    libelle: `Retrait de banque`,
    lignes: [
      { compte: coffreFort, sens: 'd', montant },
      { compte: compteBanque, sens: 'c', montant },
    ],
  });
}

/**
 * Écriture pour transfert entre coffres-forts (inter-agences)
 * Débit: Coffre destination
 * Crédit: Coffre source
 */
export async function ecritureTransfertCoffres(
  agenceSourceId: number,
  agenceDestId: number,
  montant: number
): Promise<number> {
  const coffreSource = COFFRE_FORT_MAP[agenceSourceId] || COMPTES.COFFRE_FORT_SIEGE;
  const coffreDest = COFFRE_FORT_MAP[agenceDestId] || COMPTES.COFFRE_FORT_SIEGE;

  // L'écriture est enregistrée dans l'agence source
  return enregistrerEcriture({
    agenceId: agenceSourceId,
    dateValeur: new Date(),
    libelle: `Transfert vers agence ${agenceDestId}`,
    lignes: [
      { compte: coffreDest, sens: 'd', montant },
      { compte: coffreSource, sens: 'c', montant },
    ],
  });
}

// Export du service
export const comptabiliteService = {
  COMPTES,
  ecritureDepot,
  ecritureRetrait,
  ecritureVirementInterne,
  ecritureDeblocageCredit,
  ecritureRemboursementCapital,
  ecritureRemboursementInterets,
  ecritureApprovisionnementCaisse,
  ecritureReversementCaisse,
  ecritureManquantCaisse,
  ecritureExcedentCaisse,
  ecritureVirementBanque,
  ecritureRetraitBanque,
  ecritureTransfertCoffres,
};

export default comptabiliteService;
