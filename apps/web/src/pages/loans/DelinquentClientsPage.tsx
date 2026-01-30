import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Users,
  Banknote,
  Clock,
  Phone,
  Mail,
  ChevronRight,
  Search,
  Filter,
  Download,
  Calendar,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { loansApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface DelinquentClient {
  id_client: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  nb_prets: number;
  nb_echeances_retard: number;
  max_jours_retard: number;
  montant_total_retard: number;
  premiere_echeance_retard: string;
  niveau_risque: 'faible' | 'moyen' | 'eleve' | 'critique';
}

interface DelinquentSchedule {
  id_ech: number;
  id_doss: number;
  num_ech: number;
  date_ech: string;
  montant_du: number;
  jours_retard: number;
  client: {
    id_client: number;
    nom: string;
    telephone: string | null;
  };
  credit: {
    montant_octroyé: number;
    taux_interet: number;
  };
}

const riskLevelConfig = {
  faible: { label: '< 30 jours', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', badge: 'warning' },
  moyen: { label: '30-60 jours', color: 'bg-orange-100 text-orange-700 border-orange-200', badge: 'warning' },
  eleve: { label: '60-90 jours', color: 'bg-red-100 text-red-700 border-red-200', badge: 'destructive' },
  critique: { label: '> 90 jours', color: 'bg-red-200 text-red-800 border-red-300', badge: 'destructive' },
};

export default function DelinquentClientsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'clients' | 'schedules'>('clients');

  // Fetch delinquent clients
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['delinquent-clients', page],
    queryFn: async () => {
      const response = await loansApi.getDelinquentClients({ page, limit: 20 });
      return response.data;
    },
    enabled: viewMode === 'clients',
  });

  // Fetch delinquent schedules
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['delinquent-schedules', page],
    queryFn: async () => {
      const response = await loansApi.getDelinquent({ page, limit: 20 });
      return response.data;
    },
    enabled: viewMode === 'schedules',
  });

  const clients: DelinquentClient[] = clientsData?.data || [];
  const schedules: DelinquentSchedule[] = schedulesData?.data || [];

  // Use stats from whichever endpoint is active (both now return stats)
  const stats = (viewMode === 'clients' ? clientsData?.stats : schedulesData?.stats) || {
    nb_prets_retard: 0,
    nb_clients_retard: 0,
    montant_total_retard: 0,
    nb_echeances_retard: 0,
  };

  // Filter clients
  const filteredClients = clients.filter(client => {
    const matchesSearch = searchTerm === '' ||
      client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.telephone?.includes(searchTerm) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRisk = riskFilter === 'all' || client.niveau_risque === riskFilter;

    return matchesSearch && matchesRisk;
  });

  const isLoading = viewMode === 'clients' ? clientsLoading : schedulesLoading;
  const pagination = viewMode === 'clients' ? clientsData?.pagination : schedulesData?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-red-500" />
            Clients en Retard de Paiement
          </h1>
          <p className="text-gray-500">Suivi des échéances impayées et gestion du risque crédit</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exporter
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">Montant Total en Retard</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.montant_total_retard)}</p>
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
                  <p className="text-sm text-gray-500">Clients en retard</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.nb_clients_retard}</p>
                  <p className="text-sm text-red-500">À contacter</p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <Users className="h-6 w-6 text-red-600" />
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
                  <p className="text-sm text-gray-500">Prêts concernés</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.nb_prets_retard}</p>
                  <p className="text-sm text-gray-500">Dossiers actifs</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <TrendingDown className="h-6 w-6 text-orange-600" />
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
                  <p className="text-sm text-gray-500">Échéances impayées</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.nb_echeances_retard}</p>
                  <p className="text-sm text-gray-500">Total échéances</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters and View Toggle */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Liste des retards</CardTitle>
              <CardDescription>
                {viewMode === 'clients' ? 'Vue par client' : 'Vue par échéance'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'clients' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('clients')}
              >
                <Users className="h-4 w-4 mr-2" />
                Par Client
              </Button>
              <Button
                variant={viewMode === 'schedules' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('schedules')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Par Échéance
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom, téléphone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Niveau de risque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                <SelectItem value="faible">Faible (&lt; 30j)</SelectItem>
                <SelectItem value="moyen">Moyen (30-60j)</SelectItem>
                <SelectItem value="eleve">Élevé (60-90j)</SelectItem>
                <SelectItem value="critique">Critique (&gt; 90j)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
            </div>
          )}

          {/* Clients View */}
          {!isLoading && viewMode === 'clients' && (
            <>
              {filteredClients.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucun client en retard de paiement</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-center">Prêts</TableHead>
                      <TableHead className="text-center">Échéances</TableHead>
                      <TableHead className="text-right">Montant dû</TableHead>
                      <TableHead className="text-center">Max retard</TableHead>
                      <TableHead>Risque</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client, index) => {
                      const riskConfig = riskLevelConfig[client.niveau_risque];
                      return (
                        <motion.tr
                          key={client.id_client}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            'hover:bg-gray-50',
                            client.niveau_risque === 'critique' && 'bg-red-50',
                            client.niveau_risque === 'eleve' && 'bg-orange-50'
                          )}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{client.nom}</p>
                              <p className="text-xs text-gray-500">ID: {client.id_client}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {client.telephone && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="h-3 w-3 text-gray-400" />
                                  {client.telephone}
                                </div>
                              )}
                              {client.email && (
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <Mail className="h-3 w-3 text-gray-400" />
                                  {client.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{client.nb_prets}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="destructive">{client.nb_echeances_retard}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            {formatCurrency(client.montant_total_retard)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">{client.max_jours_retard}j</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={riskConfig.badge as any} className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {client.niveau_risque.charAt(0).toUpperCase() + client.niveau_risque.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/clients/${client.id_client}`)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </>
          )}

          {/* Schedules View */}
          {!isLoading && viewMode === 'schedules' && (
            <>
              {schedules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucune échéance en retard</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Dossier</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Date prévue</TableHead>
                      <TableHead className="text-right">Montant dû</TableHead>
                      <TableHead className="text-center">Jours retard</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule, index) => (
                      <motion.tr
                        key={schedule.id_ech}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className={cn(
                          'hover:bg-gray-50',
                          schedule.jours_retard > 90 && 'bg-red-50',
                          schedule.jours_retard > 60 && schedule.jours_retard <= 90 && 'bg-orange-50'
                        )}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{schedule.client.nom}</p>
                            <p className="text-xs text-gray-500">{schedule.client.telephone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            DCR-{String(schedule.id_doss).padStart(6, '0')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">#{schedule.num_ech}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(schedule.date_ech)}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatCurrency(schedule.montant_du)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              schedule.jours_retard > 90 ? 'destructive' :
                              schedule.jours_retard > 60 ? 'destructive' :
                              schedule.jours_retard > 30 ? 'warning' : 'warning'
                            }
                          >
                            {schedule.jours_retard}j
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/loans/${schedule.id_doss}`)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                Page {pagination.page} sur {pagination.totalPages} ({pagination.total} résultats)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= pagination.totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
