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
  Lock,
  Unlock,
  Wallet,
  CreditCard,
  Banknote,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
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
import { accountsApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

export default function AccountsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts', page, search],
    queryFn: async () => {
      const response = await accountsApi.getAll({ page, limit: 10, search });
      return response.data;
    },
  });

  const accounts = accountsData?.data || [];
  const pagination = accountsData?.pagination;

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, { label: string; icon: any; color: string }> = {
      EP: { label: 'Épargne', icon: Wallet, color: 'bg-blue-100 text-blue-700' },
      CC: { label: 'Courant', icon: CreditCard, color: 'bg-green-100 text-green-700' },
      DAT: { label: 'Dépôt à terme', icon: Lock, color: 'bg-purple-100 text-purple-700' },
      PAT: { label: 'Plan épargne', icon: TrendingUp, color: 'bg-orange-100 text-orange-700' },
    };
    return types[type] || { label: type, icon: Wallet, color: 'bg-gray-100 text-gray-700' };
  };

  const getStatusBadge = (status: number, blocked: boolean) => {
    if (blocked) {
      return <Badge variant="destructive">Bloqué</Badge>;
    }
    switch (status) {
      case 1:
        return <Badge variant="success">Actif</Badge>;
      case 2:
        return <Badge variant="warning">Dormant</Badge>;
      case 0:
        return <Badge variant="secondary">Fermé</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptes</h1>
          <p className="text-gray-500">Gérez les comptes clients</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau compte
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Wallet className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Comptes</p>
                  <p className="text-2xl font-bold text-gray-900">60,412</p>
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
                <div className="p-3 bg-green-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Comptes Actifs</p>
                  <p className="text-2xl font-bold text-gray-900">54,230</p>
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
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Banknote className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Dépôts</p>
                  <p className="text-2xl font-bold text-gray-900">2.5B FCFA</p>
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
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Lock className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Comptes Bloqués</p>
                  <p className="text-2xl font-bold text-gray-900">342</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par numéro de compte, client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtres
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
                    <TableHead>Numéro Compte</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead>Date ouverture</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account: any, index: number) => {
                    const typeInfo = getAccountTypeLabel(account.type_compte);
                    const Icon = typeInfo.icon;
                    const solde = Number(account.solde || 0);
                    const blocked = Number(account.mnt_bloq || 0);
                    const minimum = Number(account.mnt_min_cpte || 0);
                    const disponible = solde - blocked - minimum;

                    return (
                      <motion.tr
                        key={account.id_cpte}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/accounts/${account.id_cpte}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn('p-2 rounded-lg', typeInfo.color)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-mono font-medium text-gray-900">
                                {account.num_complet_cpte}
                              </p>
                              <p className="text-xs text-gray-500">ID: {account.id_cpte}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={typeInfo.color}>
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">Client #{account.id_titulaire}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p
                            className={cn(
                              'font-semibold tabular-nums',
                              solde >= 0 ? 'text-gray-900' : 'text-red-600'
                            )}
                          >
                            {formatCurrency(solde)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p
                            className={cn(
                              'tabular-nums',
                              disponible >= 0 ? 'text-green-600' : 'text-red-600'
                            )}
                          >
                            {formatCurrency(disponible)}
                          </p>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {formatDate(account.date_ouvert)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(account.etat_cpte, blocked > 0)}
                        </TableCell>
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
                                  navigate(`/accounts/${account.id_cpte}`);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                                Voir détails
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Historique
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="gap-2">
                                <Lock className="h-4 w-4" />
                                Bloquer
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2">
                                <Unlock className="h-4 w-4" />
                                Débloquer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Affichage de {(page - 1) * 10 + 1} à{' '}
                    {Math.min(page * 10, pagination.total)} sur {pagination.total} comptes
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
