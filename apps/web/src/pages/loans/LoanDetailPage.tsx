import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// Mock schedule data
const mockSchedule = Array.from({ length: 12 }, (_, i) => ({
  echeance: i + 1,
  date: new Date(2024, i, 15).toISOString(),
  principal: 83333,
  interet: 15000 - i * 1000,
  total: 83333 + 15000 - i * 1000,
  solde: 1000000 - (i + 1) * 83333,
  status: i < 6 ? 'paid' : i === 6 ? 'pending' : 'future',
}));

export default function LoanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: loanData, isLoading } = useQuery({
    queryKey: ['loan', id],
    queryFn: async () => {
      const response = await loansApi.getById(Number(id));
      return response.data;
    },
    enabled: !!id,
  });

  const loan = loanData?.data;

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
      3: { label: 'Décaissé', variant: 'success' },
      4: { label: 'Remboursé', variant: 'secondary' },
      5: { label: 'En retard', variant: 'warning' },
      6: { label: 'Défaut', variant: 'destructive' },
      0: { label: 'Rejeté', variant: 'destructive' },
    };
    const info = statuses[status] || { label: 'Inconnu', variant: 'secondary' };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const montant = Number(loan.mnt_dem || 0);
  const taux = Number(loan.taux_interet || 18);
  const duree = Number(loan.duree_mois || 12);
  const progress = 50; // Percentage of loan repaid

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
            {getStatusBadge(loan.etat_doss)}
          </div>
          <p className="text-gray-500">Demandé le {formatDate(loan.date_dem)}</p>
        </div>
        <div className="flex gap-2">
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
                  <p className="text-hopefund-100 text-sm">Montant Accordé</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(montant)}</p>
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
                    Échéance: {formatDate(loan.date_ech)}
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
                  <p className="text-sm text-gray-500">Client</p>
                  <p className="text-2xl font-bold text-gray-900">#{loan.id_client}</p>
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
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-hopefund-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-500">Capital remboursé</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(montant * (progress / 100))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-500">Capital restant</span>
                  <span className="font-semibold">
                    {formatCurrency(montant * (1 - progress / 100))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-gray-500">Intérêts payés</span>
                  <span className="font-semibold">
                    {formatCurrency(montant * 0.09)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-500">Échéances payées</span>
                  <span className="font-semibold">6 / {duree}</span>
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
                    <p className="text-sm text-gray-500 mb-1">Type de crédit</p>
                    <p className="font-semibold">Crédit Ordinaire</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Objet du crédit</p>
                    <p className="font-semibold">{loan.objet_dem || 'Fonds de commerce'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Mode de remboursement</p>
                    <p className="font-semibold">Mensuel</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Date de décaissement</p>
                    <p className="font-semibold">{formatDate(loan.date_decais)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Compte de prélèvement</p>
                    <p className="font-semibold font-mono">{loan.cpte_prelev || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Gestionnaire</p>
                    <p className="font-semibold">Agent #{loan.id_gest || loan.id_utilisateur}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Payment Schedule */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500" />
              Échéancier de remboursement
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Télécharger PDF
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Intérêts</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Solde restant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockSchedule.map((row, index) => (
                  <motion.tr
                    key={row.echeance}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 + index * 0.03 }}
                    className={cn(
                      'hover:bg-gray-50',
                      row.status === 'pending' && 'bg-yellow-50'
                    )}
                  >
                    <TableCell className="font-medium">#{row.echeance}</TableCell>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.principal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.interet)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(row.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.solde)}
                    </TableCell>
                    <TableCell>
                      {row.status === 'paid' && (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Payé
                        </Badge>
                      )}
                      {row.status === 'pending' && (
                        <Badge variant="warning" className="gap-1">
                          <Clock className="h-3 w-3" />
                          En attente
                        </Badge>
                      )}
                      {row.status === 'future' && (
                        <Badge variant="secondary">À venir</Badge>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
