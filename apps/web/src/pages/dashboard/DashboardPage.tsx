import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  Wallet,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { reportsApi } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';

// Mock data for charts
const chartData = [
  { month: 'Jan', deposits: 4000, withdrawals: 2400, loans: 2400 },
  { month: 'Fév', deposits: 3000, withdrawals: 1398, loans: 2210 },
  { month: 'Mar', deposits: 2000, withdrawals: 9800, loans: 2290 },
  { month: 'Avr', deposits: 2780, withdrawals: 3908, loans: 2000 },
  { month: 'Mai', deposits: 1890, withdrawals: 4800, loans: 2181 },
  { month: 'Jun', deposits: 2390, withdrawals: 3800, loans: 2500 },
];

const recentTransactions = [
  { id: 1, client: 'Jean-Baptiste M.', type: 'Dépôt', amount: 150000, time: '14:32' },
  { id: 2, client: 'Marie K.', type: 'Retrait', amount: -50000, time: '14:15' },
  { id: 3, client: 'Paul N.', type: 'Virement', amount: -75000, time: '13:45' },
  { id: 4, client: 'Anne R.', type: 'Remboursement', amount: 45000, time: '12:30' },
  { id: 5, client: 'Claude T.', type: 'Dépôt', amount: 200000, time: '11:20' },
];

const StatCard = ({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  change: string;
  changeType: 'up' | 'down';
  icon: any;
  color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <div className="flex items-center gap-1 mt-2">
              {changeType === 'up' ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  changeType === 'up' ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {change}
              </span>
              <span className="text-sm text-gray-400">vs mois dernier</span>
            </div>
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default function DashboardPage() {
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await reportsApi.getDashboard();
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500">Vue d'ensemble de vos opérations</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Exporter</Button>
          <Button>Nouvelle opération</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clients"
          value={formatNumber(dashboard?.overview?.totalClients || 15104)}
          change="+12%"
          changeType="up"
          icon={Users}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          title="Total Comptes"
          value={formatNumber(dashboard?.overview?.totalAccounts || 60412)}
          change="+8%"
          changeType="up"
          icon={Wallet}
          color="bg-gradient-to-br from-hopefund-500 to-hopefund-600"
        />
        <StatCard
          title="Crédits Actifs"
          value={formatNumber(dashboard?.overview?.activeLoans || 44211)}
          change="+5%"
          changeType="up"
          icon={FileText}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
        <StatCard
          title="Dépôts Aujourd'hui"
          value={formatCurrency(dashboard?.today?.deposits?.amount || 2500000)}
          change="-3%"
          changeType="down"
          icon={TrendingUp}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Évolution des opérations</CardTitle>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="deposits"
                      stroke="#22c55e"
                      fillOpacity={1}
                      fill="url(#colorDeposits)"
                      strokeWidth={2}
                      name="Dépôts"
                    />
                    <Area
                      type="monotone"
                      dataKey="withdrawals"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorWithdrawals)"
                      strokeWidth={2}
                      name="Retraits"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Transactions récentes</CardTitle>
              <Button variant="ghost" size="sm">
                Voir tout
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.amount > 0
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {tx.amount > 0 ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : (
                          <TrendingDown className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tx.client}</p>
                        <p className="text-sm text-gray-500">{tx.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold tabular-nums ${
                          tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {tx.amount > 0 ? '+' : ''}
                        {formatCurrency(tx.amount)}
                      </p>
                      <p className="text-sm text-gray-400">{tx.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Portfolio Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Répartition du portefeuille</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="loans"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    name="Crédits"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
