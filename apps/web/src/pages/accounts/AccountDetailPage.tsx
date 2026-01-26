import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Wallet,
  Lock,
  Clock,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
import { accountsApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

// Mock chart data
const balanceHistory = [
  { date: '01/12', solde: 450000 },
  { date: '05/12', solde: 520000 },
  { date: '10/12', solde: 480000 },
  { date: '15/12', solde: 610000 },
  { date: '20/12', solde: 550000 },
  { date: '25/12', solde: 680000 },
  { date: '31/12', solde: 720000 },
];

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedTx, setExpandedTx] = useState<number | null>(null);

  const { data: accountData, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      const response = await accountsApi.getById(Number(id));
      return response.data;
    },
    enabled: !!id,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['accountTransactions', id],
    queryFn: async () => {
      const response = await accountsApi.getTransactions(Number(id), { limit: 20 });
      return response.data;
    },
    enabled: !!id,
  });

  const account = accountData;
  const transactions = transactionsData?.data || transactionsData || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Compte non trouvé</p>
        <Button variant="outline" onClick={() => navigate('/accounts')} className="mt-4">
          Retour à la liste
        </Button>
      </div>
    );
  }

  const solde = Number(account.solde || 0);
  const blocked = Number(account.mnt_bloq || 0);
  const minimum = Number(account.mnt_min_cpte || 0);
  const disponible = solde - blocked - minimum;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/accounts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Détail du compte</h1>
          <p className="text-gray-500 font-mono">{account.num_complet_cpte}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Lock className="h-4 w-4" />
            Bloquer
          </Button>
          <Button className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Opération
          </Button>
        </div>
      </div>

      {/* Balance Cards */}
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
                  <p className="text-hopefund-100 text-sm">Solde Total</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(solde)}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Wallet className="h-6 w-6 text-white" />
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
                  <p className="text-sm text-gray-500">Disponible</p>
                  <p className={cn('text-2xl font-bold', disponible >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {formatCurrency(disponible)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-600" />
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
                  <p className="text-sm text-gray-500">Montant Bloqué</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(blocked)}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Lock className="h-6 w-6 text-orange-600" />
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
                  <p className="text-sm text-gray-500">Solde Minimum</p>
                  <p className="text-2xl font-bold text-gray-600">{formatCurrency(minimum)}</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-xl">
                  <TrendingDown className="h-6 w-6 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Account Info & Chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-500">Type de compte</span>
                <Badge variant="secondary">{account.type_compte || 'Épargne'}</Badge>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-500">Titulaire</span>
                <span className="font-medium">Client #{account.id_titulaire}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-500">Agence</span>
                <span className="font-medium">Agence {account.id_ag}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-500">Date ouverture</span>
                <span className="font-medium">{formatDate(account.date_ouvert)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-500">Statut</span>
                <Badge variant={account.etat_cpte === 1 ? 'success' : 'secondary'}>
                  {account.etat_cpte === 1 ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              {account.decouvert_max > 0 && (
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-500">Découvert autorisé</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(account.decouvert_max)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Balance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Évolution du solde</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceHistory}>
                    <defs>
                      <linearGradient id="colorSolde" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="solde"
                      stroke="#22c55e"
                      fillOpacity={1}
                      fill="url(#colorSolde)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Transactions History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Historique des mouvements
            </CardTitle>
            <Button variant="outline" size="sm">
              Voir tout
            </Button>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: any, index: number) => {
                    const txId = tx.id_mouvement || index;
                    const hasDetails = tx.libelle || tx.ref_externe || tx.info || tx.communication;
                    const isExpanded = expandedTx === txId;

                    return (
                      <React.Fragment key={txId}>
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            'hover:bg-gray-50 cursor-pointer',
                            isExpanded && 'bg-hopefund-50'
                          )}
                          onClick={() => hasDetails && setExpandedTx(isExpanded ? null : txId)}
                        >
                          <TableCell className="w-8 px-2">
                            {hasDetails ? (
                              isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              )
                            ) : null}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {formatDate(tx.date_mvt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-xs">
                                {tx.libelle || tx.compte_comptable || 'Mouvement'}
                              </span>
                              {hasDetails && (
                                <MessageSquare className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {tx.sens?.toLowerCase() === 'c' ? (
                                <ArrowDownCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <ArrowUpCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className={tx.sens?.toLowerCase() === 'c' ? 'text-green-600' : 'text-red-600'}>
                                {tx.sens?.toLowerCase() === 'c' ? 'Crédit' : 'Débit'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'font-semibold tabular-nums',
                                tx.sens?.toLowerCase() === 'c' ? 'text-green-600' : 'text-red-600'
                              )}
                            >
                              {tx.sens?.toLowerCase() === 'c' ? '+' : '-'}
                              {formatCurrency(tx.montant || 0)}
                            </span>
                          </TableCell>
                        </motion.tr>
                        <AnimatePresence>
                          {isExpanded && hasDetails && (
                            <motion.tr
                              key={`${txId}-details`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-gray-50"
                            >
                              <TableCell colSpan={5} className="py-3 px-4">
                                <div className="pl-6 space-y-2 text-sm">
                                  {tx.libelle && (
                                    <div className="flex gap-2">
                                      <span className="text-gray-500 font-medium min-w-24">Libellé:</span>
                                      <span className="text-gray-700">{tx.libelle}</span>
                                    </div>
                                  )}
                                  {tx.ref_externe && (
                                    <div className="flex gap-2">
                                      <span className="text-gray-500 font-medium min-w-24">Référence:</span>
                                      <span className="text-gray-700 font-mono text-xs">{tx.ref_externe}</span>
                                    </div>
                                  )}
                                  {tx.type_operation && (
                                    <div className="flex gap-2">
                                      <span className="text-gray-500 font-medium min-w-24">Type opération:</span>
                                      <span className="text-gray-700">{tx.type_operation}</span>
                                    </div>
                                  )}
                                  {tx.info && (
                                    <div className="flex gap-2">
                                      <span className="text-gray-500 font-medium min-w-24">Info:</span>
                                      <span className="text-gray-700">{tx.info}</span>
                                    </div>
                                  )}
                                  {tx.communication && (
                                    <div className="flex gap-2">
                                      <span className="text-gray-500 font-medium min-w-24">Communication:</span>
                                      <span className="text-gray-700">{tx.communication}</span>
                                    </div>
                                  )}
                                  {tx.date_valeur && (
                                    <div className="flex gap-2">
                                      <span className="text-gray-500 font-medium min-w-24">Date valeur:</span>
                                      <span className="text-gray-700">{formatDate(tx.date_valeur)}</span>
                                    </div>
                                  )}
                                  {tx.id_ecriture && (
                                    <div className="flex gap-2">
                                      <span className="text-gray-500 font-medium min-w-24">N° écriture:</span>
                                      <span className="text-gray-700 font-mono text-xs">#{tx.id_ecriture}</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-500 py-8">Aucun mouvement</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
