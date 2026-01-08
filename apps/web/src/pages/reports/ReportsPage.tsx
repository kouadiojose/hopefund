import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  LineChart,
  PieChart,
  Download,
  Calendar,
  TrendingUp,
  Users,
  Wallet,
  FileText,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';

const monthlyData = [
  { month: 'Jan', depots: 450000000, retraits: 320000000, credits: 280000000 },
  { month: 'Fév', depots: 520000000, retraits: 380000000, credits: 310000000 },
  { month: 'Mar', depots: 480000000, retraits: 350000000, credits: 420000000 },
  { month: 'Avr', depots: 610000000, retraits: 420000000, credits: 380000000 },
  { month: 'Mai', depots: 550000000, retraits: 390000000, credits: 450000000 },
  { month: 'Jun', depots: 680000000, retraits: 480000000, credits: 520000000 },
];

const portfolioDistribution = [
  { name: 'Épargne', value: 45, color: '#22c55e' },
  { name: 'Courant', value: 30, color: '#3b82f6' },
  { name: 'DAT', value: 15, color: '#8b5cf6' },
  { name: 'Autres', value: 10, color: '#f59e0b' },
];

const loanPerformance = [
  { month: 'Jan', remboursements: 85, retards: 12, defauts: 3 },
  { month: 'Fév', remboursements: 88, retards: 10, defauts: 2 },
  { month: 'Mar', remboursements: 82, retards: 14, defauts: 4 },
  { month: 'Avr', remboursements: 90, retards: 8, defauts: 2 },
  { month: 'Mai', remboursements: 87, retards: 11, defauts: 2 },
  { month: 'Jun', remboursements: 92, retards: 6, defauts: 2 },
];

const agencyPerformance = [
  { agence: 'Siège', clients: 5200, depots: 850000000, credits: 620000000 },
  { agence: 'Plateau', clients: 3800, depots: 520000000, credits: 420000000 },
  { agence: 'Cocody', clients: 3200, depots: 480000000, credits: 380000000 },
  { agence: 'Yopougon', clients: 2100, depots: 320000000, credits: 280000000 },
  { agence: 'Marcory', clients: 804, depots: 180000000, credits: 120000000 },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState('month');

  const kpis = [
    {
      title: 'Total Dépôts',
      value: formatCurrency(2500000000),
      change: '+15.3%',
      changeType: 'up' as const,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      title: 'Total Crédits',
      value: formatCurrency(1800000000),
      change: '+8.7%',
      changeType: 'up' as const,
      icon: Banknote,
      color: 'bg-blue-500',
    },
    {
      title: 'Nouveaux Clients',
      value: '1,247',
      change: '+23.1%',
      changeType: 'up' as const,
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      title: 'PAR 30',
      value: '2.3%',
      change: '-0.5%',
      changeType: 'down' as const,
      icon: FileText,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports</h1>
          <p className="text-gray-500">Analyse et statistiques de performance</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {['week', 'month', 'quarter', 'year'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-all',
                  period === p
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {p === 'week' && 'Semaine'}
                {p === 'month' && 'Mois'}
                {p === 'quarter' && 'Trimestre'}
                {p === 'year' && 'Année'}
              </button>
            ))}
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">{kpi.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                      <div className="flex items-center gap-1 mt-2">
                        {kpi.changeType === 'up' ? (
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-green-500" />
                        )}
                        <span
                          className={cn(
                            'text-sm font-medium',
                            kpi.changeType === 'up' ? 'text-green-500' : 'text-green-500'
                          )}
                        >
                          {kpi.change}
                        </span>
                      </div>
                    </div>
                    <div className={cn('p-3 rounded-xl', kpi.color)}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-500" />
                Activité mensuelle
              </CardTitle>
              <Badge variant="secondary">6 derniers mois</Badge>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorDepots" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRetraits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
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
                      dataKey="depots"
                      stroke="#22c55e"
                      fillOpacity={1}
                      fill="url(#colorDepots)"
                      strokeWidth={2}
                      name="Dépôts"
                    />
                    <Area
                      type="monotone"
                      dataKey="retraits"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorRetraits)"
                      strokeWidth={2}
                      name="Retraits"
                    />
                    <Area
                      type="monotone"
                      dataKey="credits"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorCredits)"
                      strokeWidth={2}
                      name="Crédits"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Portfolio Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-gray-500" />
                Répartition des dépôts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={portfolioDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {portfolioDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${value}%`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value: string) => (
                        <span className="text-gray-700">{value}</span>
                      )}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Loan Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <LineChart className="h-5 w-5 text-gray-500" />
                Performance du portefeuille crédit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={loanPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      formatter={(value: number) => `${value}%`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="remboursements"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Remboursements"
                    />
                    <Line
                      type="monotone"
                      dataKey="retards"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Retards"
                    />
                    <Line
                      type="monotone"
                      dataKey="defauts"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Défauts"
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Agency Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-500" />
                Performance par agence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agencyPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                    />
                    <YAxis type="category" dataKey="agence" stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="depots" fill="#22c55e" radius={[0, 4, 4, 0]} name="Dépôts" />
                    <Bar dataKey="credits" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Crédits" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Rapports disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'État des dépôts', icon: Wallet, color: 'bg-green-100 text-green-600' },
              { title: 'Portefeuille crédit', icon: FileText, color: 'bg-blue-100 text-blue-600' },
              { title: 'PAR Aging', icon: Calendar, color: 'bg-orange-100 text-orange-600' },
              { title: 'Activité agences', icon: BarChart3, color: 'bg-purple-100 text-purple-600' },
            ].map((report) => {
              const Icon = report.icon;
              return (
                <Button
                  key={report.title}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-3"
                >
                  <div className={cn('p-3 rounded-xl', report.color)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="font-medium">{report.title}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
