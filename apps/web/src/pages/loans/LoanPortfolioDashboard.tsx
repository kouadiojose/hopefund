import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  PieChart,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { loansApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function LoanPortfolioDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['portfolio-stats'],
    queryFn: async () => {
      const response = await loansApi.getPortfolioStats();
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
      </div>
    );
  }

  const portfolio = stats?.portfolio || {};
  const par = stats?.par || {};
  const parByAge = stats?.par_by_age || [];
  const statsByStatus = stats?.stats_by_status || [];
  const recentDemands = stats?.recent_demands || {};
  const monthlyRepayments = stats?.monthly_repayments || {};

  // Déterminer le niveau de risque du PAR
  const parLevel = par.par_ratio > 10 ? 'critical' : par.par_ratio > 5 ? 'warning' : 'good';

  // Couleurs par état
  const statusColors: Record<number, string> = {
    1: 'bg-blue-500',
    2: 'bg-green-500',
    3: 'bg-yellow-500',
    5: 'bg-emerald-500',
    8: 'bg-red-500',
    9: 'bg-gray-500',
    10: 'bg-purple-500',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vue d'ensemble du Portefeuille</h1>
          <p className="text-gray-500">Tableau de bord exécutif - Gestion des crédits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/loans')}>
            Liste des crédits
          </Button>
          <Button variant="outline" onClick={() => navigate('/loans/delinquent')}>
            Retards de paiement
          </Button>
        </div>
      </div>

      {/* KPI Cards - Ligne principale */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Encours total */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="bg-gradient-to-br from-hopefund-500 to-hopefund-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-hopefund-100 text-sm">Encours Total</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(portfolio.encours_total || 0)}
                  </p>
                  <p className="text-hopefund-200 text-sm mt-1">
                    {portfolio.nb_credits_actifs || 0} crédits actifs
                  </p>
                </div>
                <div className="p-4 bg-white/20 rounded-2xl">
                  <Banknote className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* PAR - Portfolio at Risk */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className={cn(
            parLevel === 'critical' && 'border-red-300 bg-red-50',
            parLevel === 'warning' && 'border-yellow-300 bg-yellow-50'
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">PAR (Portfolio at Risk)</p>
                  <p className={cn(
                    'text-3xl font-bold mt-1',
                    parLevel === 'critical' && 'text-red-600',
                    parLevel === 'warning' && 'text-yellow-600',
                    parLevel === 'good' && 'text-green-600'
                  )}>
                    {par.par_ratio || 0}%
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(par.montant_retard || 0)} en retard
                  </p>
                </div>
                <div className={cn(
                  'p-4 rounded-2xl',
                  parLevel === 'critical' && 'bg-red-100',
                  parLevel === 'warning' && 'bg-yellow-100',
                  parLevel === 'good' && 'bg-green-100'
                )}>
                  {parLevel === 'good' ? (
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  ) : (
                    <TrendingDown className={cn(
                      'h-8 w-8',
                      parLevel === 'critical' ? 'text-red-600' : 'text-yellow-600'
                    )} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Crédits en retard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Crédits en retard</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">
                    {par.nb_credits_retard || 0}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {par.nb_clients_retard || 0} clients concernés
                  </p>
                </div>
                <div className="p-4 bg-red-100 rounded-2xl">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Remboursements du mois */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Remboursements ce mois</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {formatCurrency(monthlyRepayments.total_rembourse || 0)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {monthlyRepayments.echeances_payees || 0} échéances payées
                  </p>
                </div>
                <div className="p-4 bg-green-100 rounded-2xl">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Deuxième ligne - Détails */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Répartition PAR par ancienneté */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-500" />
                Ancienneté des retards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parByAge.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Aucun retard de paiement</p>
                </div>
              ) : (
                parByAge.map((tranche: any, index: number) => {
                  const colors = ['bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-red-700'];
                  const totalMontant = parByAge.reduce((sum: number, t: any) => sum + t.montant, 0);
                  const percent = totalMontant > 0 ? (tranche.montant / totalMontant) * 100 : 0;

                  return (
                    <div key={tranche.tranche} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{tranche.tranche}</span>
                        <span className="text-sm text-gray-500">
                          {tranche.nb_credits} crédits
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', colors[index] || 'bg-red-500')}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-24 text-right">
                          {formatCurrency(tranche.montant)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Répartition par état */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-gray-500" />
                Répartition par statut
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statsByStatus.map((status: any) => {
                const totalCount = statsByStatus.reduce((sum: number, s: any) => sum + s.count, 0);
                const percent = totalCount > 0 ? (status.count / totalCount) * 100 : 0;

                return (
                  <div key={status.etat} className="flex items-center gap-3">
                    <div className={cn(
                      'w-3 h-3 rounded-full',
                      statusColors[status.etat] || 'bg-gray-400'
                    )} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{status.label}</span>
                        <span className="text-sm font-semibold">{status.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            statusColors[status.etat] || 'bg-gray-400'
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Demandes récentes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-500" />
                Demandes (30 derniers jours)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900">{recentDemands.total || 0}</p>
                <p className="text-sm text-gray-500">Nouvelles demandes</p>
                <p className="text-lg font-semibold text-hopefund-600 mt-2">
                  {formatCurrency(recentDemands.montant_demande || 0)}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">En analyse</span>
                  </div>
                  <Badge variant="info">{recentDemands.en_analyse || 0}</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Approuvées</span>
                  </div>
                  <Badge variant="success">{recentDemands.approuves || 0}</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm">Rejetées</span>
                  </div>
                  <Badge variant="destructive">{recentDemands.rejetes || 0}</Badge>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => navigate('/loans')}
              >
                Voir toutes les demandes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Indicateurs de santé */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Indicateurs de santé du portefeuille</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-3">
              {/* PAR Indicator */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">PAR (Portfolio at Risk)</span>
                  <Badge variant={parLevel === 'good' ? 'success' : parLevel === 'warning' ? 'warning' : 'destructive'}>
                    {parLevel === 'good' ? 'Bon' : parLevel === 'warning' ? 'Attention' : 'Critique'}
                  </Badge>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      parLevel === 'good' && 'bg-green-500',
                      parLevel === 'warning' && 'bg-yellow-500',
                      parLevel === 'critical' && 'bg-red-500'
                    )}
                    style={{ width: `${Math.min(par.par_ratio || 0, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Objectif: &lt; 5% | Actuel: {par.par_ratio || 0}%
                </p>
              </div>

              {/* Taux de recouvrement estimé */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Taux de recouvrement</span>
                  <Badge variant="info">
                    {portfolio.encours_total > 0
                      ? Math.round(((portfolio.encours_total - par.montant_retard) / portfolio.encours_total) * 100)
                      : 100}%
                  </Badge>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-hopefund-500 rounded-full"
                    style={{
                      width: `${portfolio.encours_total > 0
                        ? ((portfolio.encours_total - par.montant_retard) / portfolio.encours_total) * 100
                        : 100}%`
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Portefeuille sain / Encours total
                </p>
              </div>

              {/* Couverture des provisions */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Crédits actifs</span>
                  <Badge variant="secondary">{portfolio.nb_credits_actifs || 0}</Badge>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Valeur: {formatCurrency(portfolio.encours_total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
