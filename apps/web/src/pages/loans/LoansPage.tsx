import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Banknote,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Percent,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { loansApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

export default function LoansPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: loansData, isLoading } = useQuery({
    queryKey: ['loans', page, search, statusFilter],
    queryFn: async () => {
      const response = await loansApi.getAll({
        page,
        limit: 10,
        search,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      return response.data;
    },
  });

  const loans = loansData?.data || [];
  const pagination = loansData?.pagination;

  const getStatusBadge = (loan: any) => {
    // Utiliser cre_etat en priorité, sinon etat
    const status = loan.cre_etat ?? loan.etat ?? 0;
    const statuses: Record<number, { label: string; variant: any; icon: any }> = {
      1: { label: 'En analyse', variant: 'info', icon: Clock },
      2: { label: 'Approuvé', variant: 'success', icon: CheckCircle },
      3: { label: 'Att. décaissement', variant: 'warning', icon: Clock },
      5: { label: 'Actif', variant: 'success', icon: Banknote },
      8: { label: 'En retard', variant: 'destructive', icon: AlertTriangle },
      9: { label: 'Rejeté', variant: 'destructive', icon: XCircle },
      10: { label: 'Soldé', variant: 'secondary', icon: CheckCircle },
    };
    const statusInfo = statuses[status] || { label: `État ${status}`, variant: 'secondary', icon: Clock };
    const Icon = statusInfo.icon;
    return (
      <Badge variant={statusInfo.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  const statusTabs = [
    { id: 'all', label: 'Tous', count: pagination?.total || 0 },
    { id: '1', label: 'En analyse', count: null },
    { id: '5', label: 'Actifs', count: null },
    { id: '8', label: 'En retard', count: null },
    { id: '10', label: 'Soldés', count: null },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crédits</h1>
          <p className="text-gray-500">Gérez les dossiers de crédit</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau crédit
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 bg-gradient-to-br from-hopefund-500 to-hopefund-600">
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <p className="text-hopefund-100 text-sm">Portefeuille Total</p>
                    <p className="text-3xl font-bold mt-1">1.8B</p>
                    <p className="text-hopefund-200 text-sm mt-1">FCFA</p>
                  </div>
                  <div className="p-4 bg-white/20 rounded-2xl">
                    <Banknote className="h-8 w-8 text-white" />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-hopefund-50">
                <div className="flex items-center gap-2 text-hopefund-700">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">+12% ce mois</span>
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
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Crédits Actifs</p>
                  <p className="text-2xl font-bold text-gray-900">44,211</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '78%' }} />
                </div>
                <span className="text-sm text-gray-500">78%</span>
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
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">En Retard</p>
                  <p className="text-2xl font-bold text-gray-900">89</p>
                </div>
              </div>
              <div className="mt-4">
                <Badge variant="warning" className="text-xs">
                  PAR: 2.3%
                </Badge>
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
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Percent className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Taux Moyen</p>
                  <p className="text-2xl font-bold text-gray-900">18.5%</p>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-gray-500">Annuel</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={statusFilter === tab.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(tab.id)}
            className="whitespace-nowrap"
          >
            {tab.label}
            {tab.count !== null && (
              <span
                className={cn(
                  'ml-2 px-2 py-0.5 rounded-full text-xs',
                  statusFilter === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                )}
              >
                {tab.count.toLocaleString()}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Loans Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par numéro de dossier, client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Plus de filtres
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dossier</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Taux</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan: any, index: number) => (
                    <motion.tr
                      key={loan.id_doss}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/loans/${loan.id_doss}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium text-gray-900">
                            DCR-{String(loan.id_doss).padStart(6, '0')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(loan.date_dem)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-hopefund-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-hopefund-600" />
                          </div>
                          <span className="font-medium">{loan.client_nom || `Client #${loan.id_client}`}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-semibold tabular-nums text-gray-900">
                          {formatCurrency(loan.mnt_dem || 0)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{loan.duree_mois || 12} mois</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Percent className="h-4 w-4" />
                          <span>{loan.taux_interet || 18}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-gray-600">
                          {formatDate(loan.date_ech)}
                        </p>
                      </TableCell>
                      <TableCell>{getStatusBadge(loan)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/loans/${loan.id_doss}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              Voir détails
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/loans/${loan.id_doss}`);
                              }}
                            >
                              <FileText className="h-4 w-4" />
                              Échéancier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              Approuver
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-red-600">
                              <XCircle className="h-4 w-4" />
                              Rejeter
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Affichage de {(page - 1) * 10 + 1} à{' '}
                    {Math.min(page * 10, pagination.total)} sur {pagination.total} dossiers
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                      Page {page} sur {pagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= pagination.pages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
