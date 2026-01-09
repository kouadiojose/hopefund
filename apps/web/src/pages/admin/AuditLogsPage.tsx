import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  Clock,
  Monitor,
  LogOut,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Download,
  X,
  Smartphone,
  Globe,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auditApi, adminApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    role: string;
  };
}

interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  is_active: boolean;
  user?: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    role: string;
  };
}

const actionColors: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  LOGOUT: 'bg-gray-100 text-gray-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
  VIEW: 'bg-blue-100 text-blue-700',
  APPROVE: 'bg-green-100 text-green-700',
  REJECT: 'bg-red-100 text-red-700',
  DEPOSIT: 'bg-green-100 text-green-700',
  WITHDRAWAL: 'bg-orange-100 text-orange-700',
  TRANSFER: 'bg-purple-100 text-purple-700',
  DISBURSEMENT: 'bg-green-100 text-green-700',
  REPAYMENT: 'bg-blue-100 text-blue-700',
  PASSWORD_CHANGE: 'bg-yellow-100 text-yellow-700',
  PERMISSION_CHANGE: 'bg-purple-100 text-purple-700',
  EXPORT: 'bg-blue-100 text-blue-700',
};

const actionLabels: Record<string, string> = {
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  LOGIN_FAILED: 'Échec connexion',
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  VIEW: 'Consultation',
  APPROVE: 'Approbation',
  REJECT: 'Rejet',
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  TRANSFER: 'Transfert',
  DISBURSEMENT: 'Déboursement',
  REPAYMENT: 'Remboursement',
  PASSWORD_CHANGE: 'Changement mdp',
  PERMISSION_CHANGE: 'Changement permissions',
  EXPORT: 'Export',
};

export default function AuditLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    entity: '',
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [activeTab, setActiveTab] = useState('logs');

  // Fetch audit logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['auditLogs', page, filters],
    queryFn: async () => {
      const params: any = { page, limit: 25 };
      if (filters.action) params.action = filters.action;
      if (filters.entity) params.entity = filters.entity;
      if (filters.userId) params.userId = parseInt(filters.userId);
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await auditApi.getLogs(params);
      return response.data;
    },
  });

  // Fetch audit stats
  const { data: statsData } = useQuery({
    queryKey: ['auditStats'],
    queryFn: async () => {
      const response = await auditApi.getStats(7);
      return response.data;
    },
  });

  // Fetch actions list
  const { data: actions } = useQuery({
    queryKey: ['auditActions'],
    queryFn: async () => {
      const response = await auditApi.getActions();
      return response.data;
    },
  });

  // Fetch entities list
  const { data: entities } = useQuery({
    queryKey: ['auditEntities'],
    queryFn: async () => {
      const response = await auditApi.getEntities();
      return response.data;
    },
  });

  // Fetch sessions
  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const response = await auditApi.getSessions({ activeOnly: true });
      return response.data;
    },
    enabled: activeTab === 'sessions',
  });

  // Fetch users for filter
  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: async () => {
      const response = await adminApi.getUsers({ limit: 100 });
      return response.data;
    },
  });

  // Invalidate session mutation
  const invalidateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return auditApi.invalidateSession(sessionId);
    },
    onSuccess: () => {
      refetchSessions();
    },
  });

  const logs: AuditLog[] = logsData?.data || [];
  const sessions: Session[] = sessionsData?.data || [];
  const pagination = logsData?.pagination;
  const users = usersData?.data || [];

  const clearFilters = () => {
    setFilters({
      action: '',
      entity: '',
      userId: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal d'Audit</h1>
          <p className="text-gray-500">Suivi des activités et sessions du système</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => activeTab === 'logs' ? refetchLogs() : refetchSessions()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Actions (7 jours)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsData?.actionStats?.reduce((acc: number, s: any) => acc + s.count, 0) || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100 text-blue-700">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Sessions actives</p>
                  <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-100 text-green-700">
                  <Monitor className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Utilisateurs actifs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsData?.userStats?.length || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-100 text-purple-700">
                  <User className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Échecs connexion</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsData?.actionStats?.find((s: any) => s.action === 'LOGIN_FAILED')?.count || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-red-100 text-red-700">
                  <LogOut className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs" className="gap-2">
            <Activity className="h-4 w-4" />
            Logs d'activité
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Monitor className="h-4 w-4" />
            Sessions actives
          </TabsTrigger>
        </TabsList>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-2 flex-1">
                  <Select
                    value={filters.action}
                    onValueChange={(value) => setFilters({ ...filters, action: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes actions</SelectItem>
                      {actions?.map((action: any) => (
                        <SelectItem key={action.code} value={action.code}>
                          {action.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.entity}
                    onValueChange={(value) => setFilters({ ...filters, entity: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Entité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes entités</SelectItem>
                      {entities?.map((entity: any) => (
                        <SelectItem key={entity.code} value={entity.code}>
                          {entity.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.userId}
                    onValueChange={(value) => setFilters({ ...filters, userId: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Utilisateur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous utilisateurs</SelectItem>
                      {users.map((user: any) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.prenom} {user.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-[150px]"
                    placeholder="Date début"
                  />

                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-[150px]"
                    placeholder="Date fin"
                  />
                </div>

                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Effacer filtres
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Heure</TableHead>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entité</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead className="text-right">Détails</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-gray-50">
                          <TableCell className="text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {formatDate(log.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.user ? (
                              <div>
                                <p className="font-medium text-gray-900">
                                  {log.user.prenom} {log.user.nom}
                                </p>
                                <p className="text-xs text-gray-500">{log.user.email}</p>
                              </div>
                            ) : (
                              <span className="text-gray-400">Système</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('border-0', actionColors[log.action] || 'bg-gray-100 text-gray-700')}>
                              {actionLabels[log.action] || log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{log.entity}</p>
                              {log.entity_id && (
                                <p className="text-xs text-gray-500">ID: {log.entity_id}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {log.ip_address || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {pagination && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-500">
                        {pagination.total} entrée(s) au total
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
                          Page {page} sur {pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => p + 1)}
                          disabled={page >= pagination.totalPages}
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
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Sessions actives</CardTitle>
              <CardDescription>
                Utilisateurs actuellement connectés au système
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Monitor className="h-12 w-12 mb-4 text-gray-300" />
                  <p>Aucune session active</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Connexion</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>IP / Appareil</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id} className="hover:bg-gray-50">
                        <TableCell>
                          {session.user ? (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-hopefund-100 rounded-full flex items-center justify-center">
                                <span className="text-hopefund-700 text-sm font-semibold">
                                  {session.user.prenom[0]}{session.user.nom[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {session.user.prenom} {session.user.nom}
                                </p>
                                <p className="text-xs text-gray-500">{session.user.email}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">Inconnu</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {session.user?.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(session.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(session.expires_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Globe className="h-4 w-4" />
                            <span>{session.ip_address || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => invalidateSessionMutation.mutate(session.id)}
                            disabled={invalidateSessionMutation.isPending}
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Déconnecter
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de l'entrée d'audit</DialogTitle>
            <DialogDescription>
              {selectedLog && formatDate(selectedLog.created_at)}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Action</Label>
                  <Badge className={cn('mt-1 border-0', actionColors[selectedLog.action])}>
                    {actionLabels[selectedLog.action] || selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <Label className="text-gray-500">Entité</Label>
                  <p className="font-medium">{selectedLog.entity}</p>
                </div>
                <div>
                  <Label className="text-gray-500">ID Entité</Label>
                  <p className="font-medium">{selectedLog.entity_id || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Utilisateur</Label>
                  <p className="font-medium">
                    {selectedLog.user
                      ? `${selectedLog.user.prenom} ${selectedLog.user.nom}`
                      : 'Système'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Adresse IP</Label>
                  <p className="font-medium">{selectedLog.ip_address || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">User Agent</Label>
                  <p className="font-medium text-xs truncate">{selectedLog.user_agent || '-'}</p>
                </div>
              </div>

              {selectedLog.old_values && (
                <div>
                  <Label className="text-gray-500">Anciennes valeurs</Label>
                  <pre className="mt-1 p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <Label className="text-gray-500">Nouvelles valeurs</Label>
                  <pre className="mt-1 p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
