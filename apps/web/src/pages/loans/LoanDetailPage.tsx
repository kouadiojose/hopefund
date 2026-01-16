import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  User,
  Percent,
  Banknote,
  FileText,
  CheckCircle,
  Clock,
  Download,
  Printer,
  AlertTriangle,
  XCircle,
  Calculator,
  Settings,
  RefreshCw,
  PlusCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { loansApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface Echeance {
  id_ech: number;
  num_ech: number;
  date_ech: string;
  mnt_capital: number;
  mnt_int: number;
  solde_capital: number;
  solde_int: number;
  mnt_paye: number;
  date_paiement: string | null;
  etat: number | null;
}

// Interface pour échéance simulée
interface SimulatedEcheance {
  num_ech: number;
  date_ech: string;
  mnt_capital: number;
  mnt_int: number;
  total: number;
  solde_restant: number;
}

// Fonction pour générer un échéancier simulé
function generateSimulatedSchedule(
  montant: number,
  tauxAnnuel: number,
  dureeMois: number,
  dateDebut: Date = new Date()
): SimulatedEcheance[] {
  if (montant <= 0 || dureeMois <= 0) return [];

  const tauxMensuel = tauxAnnuel / 100 / 12;
  const echeances: SimulatedEcheance[] = [];

  // Calcul de la mensualité constante (amortissement constant + intérêts dégressifs)
  const capitalParEcheance = montant / dureeMois;
  let soldeRestant = montant;

  for (let i = 1; i <= dureeMois; i++) {
    const interets = soldeRestant * tauxMensuel;
    const capital = capitalParEcheance;
    soldeRestant -= capital;

    const dateEch = new Date(dateDebut);
    dateEch.setMonth(dateEch.getMonth() + i);

    echeances.push({
      num_ech: i,
      date_ech: dateEch.toISOString(),
      mnt_capital: Math.round(capital),
      mnt_int: Math.round(interets),
      total: Math.round(capital + interets),
      solde_restant: Math.max(0, Math.round(soldeRestant)),
    });
  }

  return echeances;
}

export default function LoanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Extraire uniquement la partie numérique de l'ID (au cas où il y aurait un suffixe comme :1)
  const loanId = id ? parseInt(id.split(':')[0], 10) : null;

  // États pour la simulation
  const [simTaux, setSimTaux] = useState<number | null>(null);
  const [simDuree, setSimDuree] = useState<number | null>(null);
  const [simMontant, setSimMontant] = useState<number | null>(null);
  const [showSimulation, setShowSimulation] = useState(false);

  const queryClient = useQueryClient();

  const { data: loanData, isLoading } = useQuery({
    queryKey: ['loan', loanId],
    queryFn: async () => {
      if (!loanId || isNaN(loanId)) {
        throw new Error('Invalid loan ID');
      }
      const response = await loansApi.getById(loanId);
      return response.data;
    },
    enabled: !!loanId && !isNaN(loanId),
  });

  // Mutation pour générer l'échéancier
  const generateScheduleMutation = useMutation({
    mutationFn: () => loansApi.generateSchedule(loanId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
    },
  });

  // Mutation pour marquer comme soldé
  const markClosedMutation = useMutation({
    mutationFn: () => loansApi.markClosed(loanId!, 'Marqué comme soldé manuellement'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
      alert('Prêt marqué comme soldé avec succès');
    },
    onError: (error: any) => {
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    },
  });

  // Mutation pour réouvrir un prêt soldé
  const reopenMutation = useMutation({
    mutationFn: () => loansApi.reopen(loanId!, 'Réouvert manuellement'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
      alert('Prêt réouvert avec succès');
    },
    onError: (error: any) => {
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    },
  });

  const loan = loanData;
  const echeances: Echeance[] = loan?.echeances || [];
  const resume = loan?.resume || {};

  // Initialiser les valeurs de simulation depuis le prêt
  const effectiveTaux = simTaux ?? Number(loan?.tx_interet_lcr || 18);
  const effectiveDuree = simDuree ?? Number(loan?.duree_mois || 12);
  const effectiveMontant = simMontant ?? Number(loan?.cre_mnt_octr || loan?.mnt_dem || 0);

  // Générer l'échéancier simulé (utiliser la date de décaissement si disponible)
  const simulatedSchedule = useMemo(() => {
    if (!loan) return [];
    const startDate = loan.cre_date_debloc
      ? new Date(loan.cre_date_debloc)
      : loan.cre_date_approb
        ? new Date(loan.cre_date_approb)
        : new Date();
    return generateSimulatedSchedule(effectiveMontant, effectiveTaux, effectiveDuree, startDate);
  }, [loan, effectiveMontant, effectiveTaux, effectiveDuree]);

  // Calculs de la simulation
  const simTotalCapital = simulatedSchedule.reduce((sum, e) => sum + e.mnt_capital, 0);
  const simTotalInteret = simulatedSchedule.reduce((sum, e) => sum + e.mnt_int, 0);
  const simTotalDu = simTotalCapital + simTotalInteret;
  const simMensualiteMoyenne = simulatedSchedule.length > 0
    ? simulatedSchedule.reduce((sum, e) => sum + e.total, 0) / simulatedSchedule.length
    : 0;

  // Le prêt est-il en phase de simulation (non décaissé)
  const isSimulationPhase = !loan?.cre_date_debloc && (loan?.cre_etat || loan?.etat) < 5;

  // Le prêt n'a pas d'échéancier en base de données (même s'il est décaissé)
  const hasNoScheduleInDB = echeances.length === 0;

  // Calculer le statut de chaque échéance
  const getEcheanceStatus = (echeance: Echeance) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateEch = new Date(echeance.date_ech);
    dateEch.setHours(0, 0, 0, 0);

    const soldeRestant = Number(echeance.solde_capital || 0) + Number(echeance.solde_int || 0);

    // Si payé (etat = 2 ou solde = 0)
    if (echeance.etat === 2 || soldeRestant === 0) {
      return 'paid';
    }

    // Si date passée et non payé
    if (dateEch < today && soldeRestant > 0) {
      return 'overdue';
    }

    // Si date = aujourd'hui
    if (dateEch.getTime() === today.getTime()) {
      return 'pending';
    }

    // À venir
    return 'future';
  };

  // Statistiques des échéances
  const echeanceStats = {
    total: echeances.length,
    paid: echeances.filter(e => getEcheanceStatus(e) === 'paid').length,
    overdue: echeances.filter(e => getEcheanceStatus(e) === 'overdue').length,
    pending: echeances.filter(e => getEcheanceStatus(e) === 'pending').length,
    future: echeances.filter(e => getEcheanceStatus(e) === 'future').length,
  };

  // Calculer le pourcentage de remboursement
  const totalDu = Number(resume.totalDu || 0);
  const totalPaye = Number(resume.totalPaye || 0);
  const progress = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Dossier non trouvé</p>
        <Button variant="outline" onClick={() => navigate('/loans')} className="mt-4">
          Retour à la liste
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: number) => {
    const statuses: Record<number, { label: string; variant: any }> = {
      1: { label: 'En cours d\'analyse', variant: 'warning' },
      2: { label: 'Approuvé', variant: 'info' },
      3: { label: 'En attente décaissement', variant: 'info' },
      5: { label: 'Décaissé - Actif', variant: 'success' },
      7: { label: 'Soldé', variant: 'secondary' },
      8: { label: 'En retard', variant: 'destructive' },
      9: { label: 'Rejeté/Défaut', variant: 'destructive' },
      10: { label: 'Soldé', variant: 'secondary' },
    };
    const info = statuses[status] || { label: 'Inconnu', variant: 'secondary' };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  // Check if loan is closed/paid
  const isLoanClosed = loan?.cre_etat === 10 || loan?.cre_etat === 7 || loan?.etat === 10 || loan?.etat === 7;

  // Check if loan is active and can be closed
  const canBeClosed = (loan?.cre_etat === 5 || loan?.etat === 5) && hasNoScheduleInDB;

  const montantOctroi = Number(loan.cre_mnt_octr || loan.mnt_dem || 0);
  const taux = Number(loan.tx_interet_lcr || 18);
  const duree = Number(loan.duree_mois || 12);

  // Nom du client
  const clientNom = loan.client?.statut_juridique === 1
    ? `${loan.client?.pp_prenom || ''} ${loan.client?.pp_nom || ''}`.trim()
    : loan.client?.pm_raison_sociale || `Client #${loan.id_client}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/loans')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Dossier DCR-{String(loan.id_doss).padStart(6, '0')}
            </h1>
            {getStatusBadge(loan.cre_etat || loan.etat)}
          </div>
          <p className="text-gray-500">
            Client: {clientNom} | Demandé le {formatDate(loan.date_dem)}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Mark as closed button for active loans without schedule */}
          {canBeClosed && (
            <Button
              variant="outline"
              className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir marquer ce prêt comme soldé? Cette action indique que le prêt a été entièrement remboursé.')) {
                  markClosedMutation.mutate();
                }
              }}
              disabled={markClosedMutation.isPending}
            >
              {markClosedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Marquer Soldé
            </Button>
          )}
          {/* Reopen button for closed loans */}
          {isLoanClosed && (
            <Button
              variant="outline"
              className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir réouvrir ce prêt? Il sera remis en statut Actif.')) {
                  reopenMutation.mutate();
                }
              }}
              disabled={reopenMutation.isPending}
            >
              {reopenMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Réouvrir
            </Button>
          )}
          <Button variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Alert for overdue payments */}
      {echeanceStats.overdue > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">
              {echeanceStats.overdue} échéance(s) en retard de paiement
            </p>
            <p className="text-sm text-red-600">
              Montant total en retard: {formatCurrency(
                echeances
                  .filter(e => getEcheanceStatus(e) === 'overdue')
                  .reduce((sum, e) => sum + Number(e.solde_capital || 0) + Number(e.solde_int || 0), 0)
              )}
            </p>
          </div>
        </motion.div>
      )}

      {/* Loan Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="bg-gradient-to-br from-hopefund-500 to-hopefund-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-hopefund-100 text-sm">Montant Octroyé</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(montantOctroi)}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Banknote className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Taux d'intérêt</p>
                  <p className="text-2xl font-bold text-gray-900">{taux}%</p>
                  <p className="text-sm text-gray-500">Annuel</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Percent className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Durée</p>
                  <p className="text-2xl font-bold text-gray-900">{duree} mois</p>
                  <p className="text-sm text-gray-500">
                    {echeanceStats.total} échéances
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Solde Restant</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(resume.soldeRestant || 0)}
                  </p>
                  <p className="text-sm text-gray-500">{progress}% remboursé</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <User className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Progress & Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Repayment Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Avancement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative pt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Remboursé</span>
                  <span className="text-sm font-medium text-gray-700">{progress}%</span>
                </div>
                <div className="overflow-hidden h-3 text-xs flex rounded-full bg-gray-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={cn(
                      "shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center",
                      echeanceStats.overdue > 0 ? "bg-red-500" : "bg-hopefund-500"
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-500">Total Capital</span>
                  <span className="font-semibold">
                    {formatCurrency(resume.totalCapital || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-500">Total Intérêts</span>
                  <span className="font-semibold">
                    {formatCurrency(resume.totalInteret || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-500">Total Payé</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(resume.totalPaye || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-500">Solde Restant</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(resume.soldeRestant || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-500">Échéances payées</span>
                  <span className="font-semibold">
                    {echeanceStats.paid} / {echeanceStats.total}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Loan Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Détails du crédit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Client</p>
                    <p className="font-semibold">{clientNom}</p>
                    <p className="text-xs text-gray-400 mt-1">ID: {loan.id_client}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Objet du crédit</p>
                    <p className="font-semibold">{loan.detail_obj_dem || 'Non spécifié'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Date d'approbation</p>
                    <p className="font-semibold">
                      {loan.cre_date_approb ? formatDate(loan.cre_date_approb) : 'Non approuvé'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Date de décaissement</p>
                    <p className="font-semibold">
                      {loan.cre_date_debloc ? formatDate(loan.cre_date_debloc) : 'Non décaissé'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Compte de décaissement</p>
                    <p className="font-semibold font-mono">
                      {loan.cre_id_cpte ? `Compte #${loan.cre_id_cpte}` : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Gestionnaire</p>
                    <p className="font-semibold">Agent #{loan.id_agent_gest || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Simulation Section - Pour les prêts non décaissés OU décaissés sans échéancier */}
      {(isSimulationPhase || hasNoScheduleInDB) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  {isSimulationPhase ? "Simulation d'échéancier" : "Échéancier calculé"}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {isSimulationPhase
                    ? "Ajustez les paramètres pour voir la simulation. Cet échéancier sera appliqué après approbation."
                    : "Aucun échéancier n'a été enregistré en base. Voici l'échéancier théorique basé sur les paramètres du prêt."
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={showSimulation ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowSimulation(!showSimulation)}
                >
                  <Settings className="h-4 w-4" />
                  {showSimulation ? 'Masquer' : 'Ajuster'}
                </Button>
                {/* Bouton pour générer l'échéancier en base (seulement pour prêts décaissés sans échéancier) */}
                {!isSimulationPhase && hasNoScheduleInDB && (
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => generateScheduleMutation.mutate()}
                    disabled={generateScheduleMutation.isPending}
                  >
                    {generateScheduleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    Créer l'échéancier
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Paramètres de simulation */}
              {showSimulation && (
                <div className="mb-6 p-4 bg-white rounded-lg border">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="simMontant">Montant (FBu)</Label>
                      <Input
                        id="simMontant"
                        type="number"
                        value={effectiveMontant}
                        onChange={(e) => setSimMontant(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="simTaux">Taux d'intérêt annuel (%)</Label>
                      <Input
                        id="simTaux"
                        type="number"
                        step="0.1"
                        value={effectiveTaux}
                        onChange={(e) => setSimTaux(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="simDuree">Durée (mois)</Label>
                      <Input
                        id="simDuree"
                        type="number"
                        value={effectiveDuree}
                        onChange={(e) => setSimDuree(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSimMontant(null);
                        setSimTaux(null);
                        setSimDuree(null);
                      }}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Réinitialiser
                    </Button>
                  </div>
                </div>
              )}

              {/* Résumé de la simulation */}
              <div className="grid gap-4 sm:grid-cols-4 mb-6">
                <div className="p-4 bg-white rounded-lg border">
                  <p className="text-sm text-gray-500">Total Capital</p>
                  <p className="text-xl font-bold">{formatCurrency(simTotalCapital)}</p>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <p className="text-sm text-gray-500">Total Intérêts</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(simTotalInteret)}</p>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <p className="text-sm text-gray-500">Total à rembourser</p>
                  <p className="text-xl font-bold text-hopefund-600">{formatCurrency(simTotalDu)}</p>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <p className="text-sm text-gray-500">Mensualité moyenne</p>
                  <p className="text-xl font-bold">{formatCurrency(simMensualiteMoyenne)}</p>
                </div>
              </div>

              {/* Tableau de simulation */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>N°</TableHead>
                      <TableHead>Date échéance</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">Intérêts</TableHead>
                      <TableHead className="text-right">Mensualité</TableHead>
                      <TableHead className="text-right">Solde restant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulatedSchedule.map((ech) => (
                      <TableRow key={ech.num_ech} className="hover:bg-gray-50">
                        <TableCell className="font-medium">#{ech.num_ech}</TableCell>
                        <TableCell>{formatDate(ech.date_ech)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(ech.mnt_capital)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-blue-600">
                          {formatCurrency(ech.mnt_int)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(ech.total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-gray-500">
                          {formatCurrency(ech.solde_restant)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Payment Schedule - Pour les prêts décaissés avec échéancier en base */}
      {!isSimulationPhase && !hasNoScheduleInDB && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-500" />
                  Échéancier de remboursement
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {echeanceStats.paid} payées | {echeanceStats.overdue} en retard | {echeanceStats.future} à venir
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Télécharger PDF
              </Button>
            </CardHeader>
            <CardContent>
              {echeances.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucun échéancier disponible pour ce prêt</p>
                  <p className="text-sm">L'échéancier sera généré après le décaissement</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Date échéance</TableHead>
                      <TableHead className="text-right">Total dû</TableHead>
                      <TableHead className="text-right">Payé</TableHead>
                      <TableHead>Date paiement</TableHead>
                      <TableHead className="text-right">Solde</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {echeances.map((echeance, index) => {
                      const status = getEcheanceStatus(echeance);
                      const soldeRestant = Number(echeance.solde_capital || 0) + Number(echeance.solde_int || 0);
                      const totalDu = Number(echeance.mnt_capital || 0) + Number(echeance.mnt_int || 0);
                      // Calculate days late if overdue
                      const today = new Date();
                      const dateEch = new Date(echeance.date_ech);
                      const daysLate = status === 'overdue' ? Math.floor((today.getTime() - dateEch.getTime()) / (1000 * 60 * 60 * 24)) : 0;

                      return (
                        <motion.tr
                          key={echeance.id_ech}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.7 + index * 0.02 }}
                          className={cn(
                            'hover:bg-gray-50',
                            status === 'pending' && 'bg-yellow-50',
                            status === 'overdue' && 'bg-red-50'
                          )}
                        >
                          <TableCell className="font-medium">#{echeance.num_ech}</TableCell>
                          <TableCell>
                            <div>{formatDate(echeance.date_ech)}</div>
                            <div className="text-xs text-gray-400">
                              Cap: {formatCurrency(echeance.mnt_capital || 0)} | Int: {formatCurrency(echeance.mnt_int || 0)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(totalDu)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-green-600">
                            {formatCurrency(echeance.mnt_paye || 0)}
                          </TableCell>
                          <TableCell>
                            {echeance.date_paiement ? (
                              <span className="text-green-600">{formatDate(echeance.date_paiement)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {soldeRestant > 0 ? (
                              <span className="text-orange-600 font-medium">{formatCurrency(soldeRestant)}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {status === 'paid' && (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Payé
                              </Badge>
                            )}
                            {status === 'overdue' && (
                              <div>
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  En retard
                                </Badge>
                                <div className="text-xs text-red-600 mt-1">{daysLate} jours</div>
                              </div>
                            )}
                            {status === 'pending' && (
                              <Badge variant="warning" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Aujourd'hui
                              </Badge>
                            )}
                            {status === 'future' && (
                              <Badge variant="secondary">À venir</Badge>
                            )}
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
