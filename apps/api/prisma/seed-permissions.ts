import { PrismaClient, ModuleType, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Définition de toutes les permissions par module
const permissions = [
  // MODULE CLIENT
  { code: 'CLIENT_VIEW', name: 'Visualisation menu gestion client', module: ModuleType.CLIENT },
  { code: 'CLIENT_SELECT', name: 'Sélection d\'un client', module: ModuleType.CLIENT },
  { code: 'CLIENT_CREATE', name: 'Ajout client', module: ModuleType.CLIENT },
  { code: 'CLIENT_EDIT', name: 'Modification client', module: ModuleType.CLIENT },
  { code: 'CLIENT_RELATIONS', name: 'Gestion des relations', module: ModuleType.CLIENT },
  { code: 'CLIENT_SUBSCRIPTIONS', name: 'Gestion des abonnements', module: ModuleType.CLIENT },
  { code: 'CLIENT_DEFECTION', name: 'Défection client', module: ModuleType.CLIENT },
  { code: 'CLIENT_DECEASED', name: 'Finalisation défection client décédé', module: ModuleType.CLIENT },
  { code: 'CLIENT_INSURANCE', name: 'Faire jouer l\'assurance', module: ModuleType.CLIENT },
  { code: 'CLIENT_SHARES', name: 'Souscription parts sociales', module: ModuleType.CLIENT },
  { code: 'CLIENT_SHARES_TRANSFER', name: 'Transfert parts sociales', module: ModuleType.CLIENT },
  { code: 'CLIENT_SHARES_APPROVE', name: 'Approbation transfert parts sociales', module: ModuleType.CLIENT },
  { code: 'CLIENT_CONSULT', name: 'Consultation client', module: ModuleType.CLIENT },
  { code: 'CLIENT_SHARES_MANAGE', name: 'Gestion des parts sociales', module: ModuleType.CLIENT },
  { code: 'CLIENT_SHARES_RELEASE', name: 'Libération parts sociales', module: ModuleType.CLIENT },
  { code: 'CLIENT_FEES', name: 'Perception frais adhésion', module: ModuleType.CLIENT },
  { code: 'CLIENT_COMMISSION', name: 'Commission agent sur création nouveau client', module: ModuleType.CLIENT },
  { code: 'CLIENT_DOCS', name: 'Visualisation menu documents', module: ModuleType.CLIENT },
  { code: 'CLIENT_CHECKBOOK_ORDER', name: 'Commande chèquier', module: ModuleType.CLIENT },
  { code: 'CLIENT_CHECKBOOK_WITHDRAW', name: 'Retrait chèquier', module: ModuleType.CLIENT },
  { code: 'CLIENT_STATEMENTS', name: 'Extraits de compte', module: ModuleType.CLIENT },
  { code: 'CLIENT_GLOBAL_STATUS', name: 'Situation globale client', module: ModuleType.CLIENT },
  { code: 'CLIENT_CHECK_OPPOSITION', name: 'Mise en opposition chèque / chèquier', module: ModuleType.CLIENT },

  // MODULE ÉPARGNE
  { code: 'EPARGNE_VIEW', name: 'Visualisation menu épargne', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_UNBLOCK', name: 'Débloquer les montants', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_OPEN_ACCOUNT', name: 'Ouverture compte', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_CLOSE_ACCOUNT', name: 'Clôture compte', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_SIMULATE', name: 'Simulation arrêté compte', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_STANDING_ORDER_ADD', name: 'Ajout d\'un ordre permanent', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_STANDING_ORDER_EDIT', name: 'Modification d\'un ordre permanent', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_PARAMS_EDIT', name: 'Modification des paramètres d\'épargne', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_NO_FEES', name: 'Autoriser ouverture comptes sans frais', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_CANCEL_REQUEST', name: 'Demande annulation retrait / dépôt', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_CANCEL_APPROVE', name: 'Approbation demande annulation', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_CANCEL_EXECUTE', name: 'Effectuer annulation retrait / dépôt', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_WITHDRAWAL', name: 'Retrait', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_WITHDRAWAL_AUTH', name: 'Demande autorisation retrait', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_WITHDRAWAL_REFUSE', name: 'Refus retrait', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_WITHDRAWAL_PAY', name: 'Paiement retrait autorisé', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_DEPOSIT', name: 'Dépôt', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_TRANSFER', name: 'Transfert compte', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_DAT_EXTEND', name: 'Prolongation DAT', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_CONSULT', name: 'Consultation des comptes', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_EXPRESS_WITHDRAWAL', name: 'Retrait express', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_EXPRESS_DEPOSIT', name: 'Dépôt express', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_PENDING_FEES', name: 'Frais en attente', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_ACCOUNT_EDIT', name: 'Modification du compte', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_BLOCK_ACCOUNT', name: 'Bloquer / débloquer un compte', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_MANDATE_MANAGE', name: 'Gestion des mandats', module: ModuleType.EPARGNE },
  { code: 'EPARGNE_ACTIVATE_DORMANT', name: 'Activez les comptes dormants', module: ModuleType.EPARGNE },

  // MODULE CRÉDIT
  { code: 'CREDIT_VIEW', name: 'Visualisation menu crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_LINE_MANAGE', name: 'Gestion ligne de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_DEFER_REQUEST', name: 'Demande de différé en échéances', module: ModuleType.CREDIT },
  { code: 'CREDIT_DEFER_APPROVE', name: 'Approbation différé en échéances', module: ModuleType.CREDIT },
  { code: 'CREDIT_CREATE', name: 'Création dossier de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_FLEXIBILITY', name: 'Flexibilité produit de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_APPROVE', name: 'Approbation dossier de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_REJECT', name: 'Rejet dossier de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_CANCEL', name: 'Annulation dossier de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_DISBURSE', name: 'Déboursement des fonds', module: ModuleType.CREDIT },
  { code: 'CREDIT_DISBURSE_CANCEL', name: 'Annulation déboursement progressif', module: ModuleType.CREDIT },
  { code: 'CREDIT_CORRECT', name: 'Correction dossier de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_EDIT', name: 'Modification dossier de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_PENALTY_ADJUST', name: 'Suspension / ajustement des pénalités', module: ModuleType.CREDIT },
  { code: 'CREDIT_INTEREST_REDUCE', name: 'Abattement des intérêts et pénalités', module: ModuleType.CREDIT },
  { code: 'CREDIT_EARLY_REPAYMENT', name: 'Traitement pour remboursement anticipé', module: ModuleType.CREDIT },
  { code: 'CREDIT_SIMULATE', name: 'Simulation échéancier', module: ModuleType.CREDIT },
  { code: 'CREDIT_SCHEDULE_EDIT', name: 'Modification de l\'échéancier de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_RESCHEDULE_REQUEST', name: 'Demande rééchelonnement crédits', module: ModuleType.CREDIT },
  { code: 'CREDIT_RESCHEDULE_APPROVE', name: 'Approbation rééchelonnement crédits', module: ModuleType.CREDIT },
  { code: 'CREDIT_CONSULT', name: 'Consultation dossier de crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_DATE_CHANGE_REQUEST', name: 'Demande modification date remboursement', module: ModuleType.CREDIT },
  { code: 'CREDIT_DATE_CHANGE_APPROVE', name: 'Approbation modification date remboursement', module: ModuleType.CREDIT },
  { code: 'CREDIT_SHORTEN_REQUEST', name: 'Demande raccourcissement durée crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_SHORTEN_APPROVE', name: 'Approbation raccourcissement durée crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_MORATORIUM', name: 'Rééchelonnement/moratoire', module: ModuleType.CREDIT },
  { code: 'CREDIT_REPAYMENT', name: 'Remboursement crédit', module: ModuleType.CREDIT },
  { code: 'CREDIT_GUARANTEE_REALIZE', name: 'Réalisation garanties', module: ModuleType.CREDIT },

  // MODULE GUICHET
  { code: 'GUICHET_VIEW', name: 'Visualisation menu guichet', module: ModuleType.GUICHET },
  { code: 'GUICHET_TRANSFER_AUTH', name: 'Autorisation de transfert', module: ModuleType.GUICHET },
  { code: 'GUICHET_BATCH_FEES', name: 'Perception frais adhésion par lot', module: ModuleType.GUICHET },
  { code: 'GUICHET_BATCH_WITHDRAWAL', name: 'Retrait par lot', module: ModuleType.GUICHET },
  { code: 'GUICHET_SUPPLY', name: 'Approvisionnement', module: ModuleType.GUICHET },
  { code: 'GUICHET_UNLOAD', name: 'Délestage', module: ModuleType.GUICHET },
  { code: 'GUICHET_WITHDRAWAL_AUTH', name: 'Autorisation de retrait', module: ModuleType.GUICHET },
  { code: 'GUICHET_BATCH_DEPOSIT', name: 'Dépôt par lot', module: ModuleType.GUICHET },
  { code: 'GUICHET_CHECK_ADD', name: 'Ajout chèquiers imprimés', module: ModuleType.GUICHET },
  { code: 'GUICHET_CHECK_CERTIFIED', name: 'Gestion des chèques certifiés', module: ModuleType.GUICHET },
  { code: 'GUICHET_CHECK_CLEARING', name: 'Traitement chèques compensation', module: ModuleType.GUICHET },
  { code: 'GUICHET_CHECK_REGISTER', name: 'Enregistrement des chèques', module: ModuleType.GUICHET },
  { code: 'GUICHET_CASH_ADJUST', name: 'Ajustement encaisse', module: ModuleType.GUICHET },
  { code: 'GUICHET_SUPPLY_EXECUTE', name: 'Effectuer approvisionnement/délestage', module: ModuleType.GUICHET },
  { code: 'GUICHET_VIEW_TRANSACTIONS', name: 'Visualisation des transactions', module: ModuleType.GUICHET },
  { code: 'GUICHET_VIEW_ALL_TRANSACTIONS', name: 'Visualisation transactions tous guichets', module: ModuleType.GUICHET },
  { code: 'GUICHET_CASH_EXCHANGE', name: 'Change Cash', module: ModuleType.GUICHET },
  { code: 'GUICHET_PENDING_PROCESS', name: 'Traitement des attentes', module: ModuleType.GUICHET },
  { code: 'GUICHET_MISC_OPS', name: 'Passage opérations diverses', module: ModuleType.GUICHET },
  { code: 'GUICHET_CHECK_PRINT', name: 'Chéquier à Imprimer', module: ModuleType.GUICHET },
  { code: 'GUICHET_CHECK_CONFIRM', name: 'Confirmation des chéquiers Imprimés', module: ModuleType.GUICHET },
  { code: 'GUICHET_MISC_REPORT', name: 'Rapport sur les opérations diverses', module: ModuleType.GUICHET },
  { code: 'GUICHET_REMOTE_WITHDRAWAL', name: 'Autorisation de retrait en déplacé', module: ModuleType.GUICHET },

  // MODULE SYSTÈME
  { code: 'SYSTEME_VIEW', name: 'Visualisation menu système', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_OPEN_AGENCY', name: 'Ouverture agence', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_CLOSE_AGENCY', name: 'Fermeture agence', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_BACKUP', name: 'Sauvegarde des données', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_CONSOLIDATE', name: 'Consolidation de données', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_BATCH', name: 'Batch', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_PASSWORD_OTHER', name: 'Modification autre mot de passe', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_DISCONNECT_OTHER', name: 'Déconnexion autre code utilisateur', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_BALANCE_ADJUST', name: 'Ajustement du solde d\'un compte', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_LICENSE', name: 'Gestion de la licence', module: ModuleType.SYSTEME },
  { code: 'SYSTEME_INFO', name: 'Informations système', module: ModuleType.SYSTEME },

  // MODULE PARAMÉTRAGE
  { code: 'PARAM_VIEW', name: 'Visualisation menu paramétrage', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_MODULES', name: 'Gestion des modules spécifiques', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_PROFILES_VIEW', name: 'Visualisation gestion des profils', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_PROFILE_ADD', name: 'Ajout d\'un profil', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_PROFILE_VIEW', name: 'Consultation d\'un profil', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_PROFILE_EDIT', name: 'Modification d\'un profil', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_PROFILE_DELETE', name: 'Suppression d\'un profil', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_PASSWORD_SELF', name: 'Modification mot de passe', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_USERS_VIEW', name: 'Visualisation menu gestion utilisateurs', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_USER_ADD', name: 'Ajout utilisateur', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_USER_VIEW', name: 'Consultation utilisateur', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_USER_EDIT', name: 'Modification utilisateur', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_USER_DELETE', name: 'Suppression utilisateur', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_CURRENCY_VIEW', name: 'Visualisation des devises', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_CURRENCY_ADD', name: 'Ajout d\'une devise', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_CURRENCY_EDIT', name: 'Modification d\'une devise', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_USERS_LIST', name: 'Afficher les utilisateurs', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_EXTRA_FIELDS', name: 'Visualisation gestion des champs extras', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_LOGINS_VIEW', name: 'Visualisation gestion codes utilisateurs', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_LOGIN_ADD', name: 'Ajout login', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_LOGIN_VIEW', name: 'Consultation login', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_LOGIN_EDIT', name: 'Modification login', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_LOGIN_DELETE', name: 'Suppression login', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_TABLES_VIEW', name: 'Visualisation tables de paramétrage', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_TABLES_EDIT', name: 'Modification tables de paramétrage', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_TABLES_ADD', name: 'Ajout dans tables de paramétrage', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_WORKDAYS', name: 'Visualisation jours ouvrables', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_PROFILE_ASSIGN', name: 'Modification profils associés aux codes', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_TABLES_DELETE', name: 'Suppression dans table de paramétrage', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_FEES_EDIT', name: 'Modification de frais et commissions', module: ModuleType.PARAMETRAGE },
  { code: 'PARAM_JASPER', name: 'Gestion de Jasper report', module: ModuleType.PARAMETRAGE },

  // MODULE RAPPORTS
  { code: 'RAPPORTS_VIEW', name: 'Visualisation du menu rapport', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_CLIENT', name: 'Rapports client', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_MULTI_AGENCY', name: 'Rapports multi-agences', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_EPARGNE', name: 'Rapports épargne', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_CHECKBOOK', name: 'Rapports chéquiers', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_CREDIT', name: 'Rapports crédit', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_AGENCY', name: 'Rapports agence', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_EXTERNAL', name: 'Rapports externe', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_SIMULATE', name: 'Simulation échéancier', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_PRINTED', name: 'Visualisation des rapports imprimé', module: ModuleType.RAPPORTS },
  { code: 'RAPPORTS_LAST', name: 'Visualisation dernier rapport', module: ModuleType.RAPPORTS },

  // MODULE COMPTABILITÉ
  { code: 'COMPTA_VIEW', name: 'Visualisation du menu comptabilité', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_CHART', name: 'Gestion du plan comptable', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_OPERATIONS', name: 'Gestion des opérations comptables', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_REPORTS', name: 'Rapports', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_PROVISIONS', name: 'Dotation aux provisions crédits', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_PROVISIONS_EDIT', name: 'Modification provisions crédits', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_FISCAL_VIEW', name: 'Consultation des exercices', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_FISCAL_CLOSE', name: 'Clôture d\'un exercice', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_FISCAL_EDIT', name: 'Modification d\'un exercice', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_PERIODIC_CLOSE', name: 'Clôture périodique', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_JOURNALS_VIEW', name: 'Consultation des journaux comptables', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_JOURNALS_EDIT', name: 'Modification des journaux comptables', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_JOURNALS_DELETE', name: 'Suppression des journaux comptables', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_JOURNALS_ADD', name: 'Création d\'un journal comptable', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_ENTRY_ADD', name: 'Saisie des Opérations', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_COUNTERPART', name: 'Ajout compte de contrepartie', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_USER_ENTRIES', name: 'Saisie écritures utilisateurs', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_USER_ENTRIES_VALIDATE', name: 'Validation écritures utilisateurs', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_MISC_OPS', name: 'Gestion opérations diverses caisse/compte', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_INTER_AGENCY', name: 'Passage opérations siège/agence', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_RECIPROCAL_CANCEL', name: 'Annulation des opérations réciproques', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_WRITEOFF', name: 'Radiation crédit', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_VAT', name: 'Déclarations de tva', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_ACCOUNT_DELETE', name: 'Suppression de compte comptable', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_FREE_ENTRIES', name: 'Gestion des écritures libres', module: ModuleType.COMPTABILITE },
  { code: 'COMPTA_BACKDATE', name: 'Mouvementer compte à une date antérieure', module: ModuleType.COMPTABILITE },

  // MODULE LIGNE DE CRÉDIT
  { code: 'LOC_CREATE', name: 'Mise en place ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_APPROVE', name: 'Approbation ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_REJECT', name: 'Rejet ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_CANCEL', name: 'Annulation ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_DISBURSE', name: 'Déboursement fonds ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_EDIT', name: 'Modification ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_VIEW', name: 'Consultation ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_REPAYMENT', name: 'Remboursement ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_GUARANTEE', name: 'Réalisation garanties ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_CORRECT', name: 'Correction dossier ligne de crédit', module: ModuleType.LIGNE_CREDIT },
  { code: 'LOC_CLOSE', name: 'Clôturer la ligne de crédit', module: ModuleType.LIGNE_CREDIT },

  // MODULE BUDGET
  { code: 'BUDGET_MANAGE', name: 'Gestion du Budget', module: ModuleType.BUDGET },
  { code: 'BUDGET_TABLES', name: 'Gestion tables de correspondance', module: ModuleType.BUDGET },
  { code: 'BUDGET_ANNUAL', name: 'Mise en Place du Budget Annuel', module: ModuleType.BUDGET },
  { code: 'BUDGET_REFINE', name: 'Raffiner le Budget', module: ModuleType.BUDGET },
  { code: 'BUDGET_REVISE', name: 'Réviser le Budget', module: ModuleType.BUDGET },
  { code: 'BUDGET_VALIDATE', name: 'Valider le Budget', module: ModuleType.BUDGET },
  { code: 'BUDGET_VALIDATE_REFINE', name: 'Valider le Raffinement du Budget', module: ModuleType.BUDGET },
  { code: 'BUDGET_VALIDATE_REVISE', name: 'Valider la Révision du Budget', module: ModuleType.BUDGET },
  { code: 'BUDGET_VIEW', name: 'Visualisation du Budget', module: ModuleType.BUDGET },
  { code: 'BUDGET_BLOCKED_VIEW', name: 'Visualisation Comptes Comptables bloqués', module: ModuleType.BUDGET },
  { code: 'BUDGET_UNBLOCK', name: 'Débloquer les Comptes Comptables', module: ModuleType.BUDGET },
  { code: 'BUDGET_REPORTS', name: 'Rapports Budget', module: ModuleType.BUDGET },
  { code: 'BUDGET_LINE_ADD', name: 'Mise en place Nouvelle Ligne Budgetaire', module: ModuleType.BUDGET },
  { code: 'BUDGET_LINE_VALIDATE', name: 'Validation Nouvelle Ligne Budgetaire', module: ModuleType.BUDGET },
];

// Permissions par rôle (basé sur le document)
const rolePermissions: Record<UserRole, string[]> = {
  // SUPER_ADMIN - Accès complet à tout
  [UserRole.SUPER_ADMIN]: permissions.map(p => p.code),

  // DIRECTOR - Accès complet à tout (comme Super Admin)
  [UserRole.DIRECTOR]: permissions.map(p => p.code),

  // BRANCH_MANAGER - Supervision et approbations
  [UserRole.BRANCH_MANAGER]: [
    // Client - Gestion complète
    'CLIENT_VIEW', 'CLIENT_SELECT', 'CLIENT_CONSULT', 'CLIENT_CREATE', 'CLIENT_EDIT',
    'CLIENT_RELATIONS', 'CLIENT_SUBSCRIPTIONS', 'CLIENT_DEFECTION', 'CLIENT_SHARES',
    'CLIENT_SHARES_TRANSFER', 'CLIENT_SHARES_APPROVE', 'CLIENT_SHARES_MANAGE',
    'CLIENT_STATEMENTS', 'CLIENT_GLOBAL_STATUS', 'CLIENT_FEES',
    // Épargne - Gestion complète + autorisations
    'EPARGNE_VIEW', 'EPARGNE_CONSULT', 'EPARGNE_OPEN_ACCOUNT', 'EPARGNE_CLOSE_ACCOUNT',
    'EPARGNE_DEPOSIT', 'EPARGNE_WITHDRAWAL', 'EPARGNE_TRANSFER', 'EPARGNE_SIMULATE',
    'EPARGNE_WITHDRAWAL_AUTH', 'EPARGNE_WITHDRAWAL_REFUSE', 'EPARGNE_WITHDRAWAL_PAY',
    'EPARGNE_CANCEL_APPROVE', 'EPARGNE_BLOCK_ACCOUNT', 'EPARGNE_UNBLOCK',
    // Crédit - Approbations
    'CREDIT_VIEW', 'CREDIT_CONSULT', 'CREDIT_CREATE', 'CREDIT_APPROVE', 'CREDIT_REJECT',
    'CREDIT_DISBURSE', 'CREDIT_SIMULATE', 'CREDIT_REPAYMENT', 'CREDIT_DEFER_APPROVE',
    'CREDIT_RESCHEDULE_APPROVE', 'CREDIT_DATE_CHANGE_APPROVE', 'CREDIT_SHORTEN_APPROVE',
    'CREDIT_PENALTY_ADJUST', 'CREDIT_INTEREST_REDUCE',
    // Guichet - Autorisations
    'GUICHET_VIEW', 'GUICHET_VIEW_TRANSACTIONS', 'GUICHET_VIEW_ALL_TRANSACTIONS',
    'GUICHET_TRANSFER_AUTH', 'GUICHET_WITHDRAWAL_AUTH', 'GUICHET_SUPPLY_EXECUTE',
    'GUICHET_REMOTE_WITHDRAWAL',
    // Système - Gestion agence
    'SYSTEME_VIEW', 'SYSTEME_OPEN_AGENCY', 'SYSTEME_CLOSE_AGENCY', 'SYSTEME_INFO',
    // Paramétrage - Utilisateurs
    'PARAM_VIEW', 'PARAM_PASSWORD_SELF', 'PARAM_USERS_VIEW', 'PARAM_USER_VIEW',
    'PARAM_USERS_LIST',
    // Rapports - Tous
    'RAPPORTS_VIEW', 'RAPPORTS_CLIENT', 'RAPPORTS_EPARGNE', 'RAPPORTS_CREDIT',
    'RAPPORTS_AGENCY', 'RAPPORTS_SIMULATE', 'RAPPORTS_PRINTED', 'RAPPORTS_LAST',
    // Comptabilité - Consultation
    'COMPTA_VIEW', 'COMPTA_CHART', 'COMPTA_REPORTS',
    // Ligne de crédit
    'LOC_VIEW', 'LOC_APPROVE', 'LOC_REJECT',
  ],

  // CREDIT_OFFICER - Gestion des crédits
  [UserRole.CREDIT_OFFICER]: [
    // Client - Lecture et création
    'CLIENT_VIEW', 'CLIENT_SELECT', 'CLIENT_CONSULT', 'CLIENT_CREATE', 'CLIENT_EDIT',
    'CLIENT_RELATIONS', 'CLIENT_STATEMENTS', 'CLIENT_GLOBAL_STATUS',
    // Épargne - Lecture
    'EPARGNE_VIEW', 'EPARGNE_CONSULT', 'EPARGNE_SIMULATE',
    // Crédit - Gestion complète sauf approbation finale
    'CREDIT_VIEW', 'CREDIT_CREATE', 'CREDIT_CONSULT', 'CREDIT_SIMULATE',
    'CREDIT_CORRECT', 'CREDIT_EDIT', 'CREDIT_REPAYMENT', 'CREDIT_SCHEDULE_EDIT',
    'CREDIT_DEFER_REQUEST', 'CREDIT_RESCHEDULE_REQUEST', 'CREDIT_DATE_CHANGE_REQUEST',
    'CREDIT_SHORTEN_REQUEST', 'CREDIT_EARLY_REPAYMENT',
    // Guichet - Lecture
    'GUICHET_VIEW', 'GUICHET_VIEW_TRANSACTIONS',
    // Système - Minimal
    'SYSTEME_VIEW',
    // Paramétrage - Mot de passe uniquement
    'PARAM_PASSWORD_SELF',
    // Rapports - Crédit
    'RAPPORTS_VIEW', 'RAPPORTS_CLIENT', 'RAPPORTS_CREDIT', 'RAPPORTS_SIMULATE',
    // Ligne de crédit - Consultation
    'LOC_VIEW',
  ],

  // TELLER - Opérations de guichet uniquement
  [UserRole.TELLER]: [
    // Client - Lecture et création
    'CLIENT_VIEW', 'CLIENT_SELECT', 'CLIENT_CONSULT', 'CLIENT_CREATE', 'CLIENT_FEES',
    'CLIENT_STATEMENTS', 'CLIENT_GLOBAL_STATUS', 'CLIENT_SHARES',
    // Épargne - Opérations de base
    'EPARGNE_VIEW', 'EPARGNE_CONSULT', 'EPARGNE_DEPOSIT', 'EPARGNE_WITHDRAWAL',
    'EPARGNE_TRANSFER', 'EPARGNE_EXPRESS_DEPOSIT', 'EPARGNE_EXPRESS_WITHDRAWAL',
    'EPARGNE_WITHDRAWAL_AUTH',
    // Crédit - Remboursements
    'CREDIT_VIEW', 'CREDIT_CONSULT', 'CREDIT_REPAYMENT',
    // Guichet - Opérations de caisse
    'GUICHET_VIEW', 'GUICHET_VIEW_TRANSACTIONS', 'GUICHET_SUPPLY', 'GUICHET_UNLOAD',
    'GUICHET_SUPPLY_EXECUTE', 'GUICHET_CHECK_REGISTER', 'GUICHET_BATCH_DEPOSIT',
    'GUICHET_BATCH_WITHDRAWAL',
    // Système - Minimal
    'SYSTEME_VIEW',
    // Paramétrage - Mot de passe uniquement
    'PARAM_PASSWORD_SELF',
    // Rapports - Limité
    'RAPPORTS_VIEW', 'RAPPORTS_SIMULATE', 'RAPPORTS_LAST',
  ],
};

async function main() {
  console.log('🌱 Seeding permissions...');

  // Créer toutes les permissions
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module },
      create: perm,
    });
  }
  console.log(`✅ Created ${permissions.length} permissions`);

  // Récupérer toutes les permissions avec leurs IDs
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map(p => [p.code, p.id]));

  // Assigner les permissions aux rôles
  for (const [role, permCodes] of Object.entries(rolePermissions)) {
    // Supprimer les anciennes permissions du rôle
    await prisma.rolePermission.deleteMany({
      where: { role: role as UserRole },
    });

    // Créer les nouvelles associations
    const rolePerms = permCodes
      .filter(code => permissionMap.has(code))
      .map(code => ({
        role: role as UserRole,
        permission_id: permissionMap.get(code)!,
      }));

    if (rolePerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolePerms,
        skipDuplicates: true,
      });
    }

    console.log(`✅ Assigned ${rolePerms.length} permissions to ${role}`);
  }

  // Mettre à jour l'utilisateur admin existant avec le rôle SUPER_ADMIN
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@hopefund.com' },
  });

  if (adminUser) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: UserRole.SUPER_ADMIN },
    });
    console.log('✅ Updated admin user to SUPER_ADMIN role');
  }

  console.log('🎉 Permissions seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding permissions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
