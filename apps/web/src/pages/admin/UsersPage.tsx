import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Unlock,
  UserCheck,
  UserX,
  Shield,
  Building,
  ChevronLeft,
  ChevronRight,
  Save,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { adminApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  nom_complet: string;
  telephone: string | null;
  role: string;
  id_ag: number | null;
  agence_nom: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

interface Role {
  value: string;
  label: string;
  description: string;
  color: string;
  permissionCount: number;
}

interface Agency {
  id_ag: number;
  libel_ag: string;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  DIRECTOR: 'bg-blue-100 text-blue-700 border-blue-200',
  BRANCH_MANAGER: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  CREDIT_OFFICER: 'bg-green-100 text-green-700 border-green-200',
  TELLER: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  DIRECTOR: 'Directeur',
  BRANCH_MANAGER: 'Chef d\'Agence',
  CREDIT_OFFICER: 'Agent Crédit',
  TELLER: 'Caissier',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    telephone: '',
    role: 'TELLER',
    id_ag: null as number | null,
  });

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter],
    queryFn: async () => {
      const params: any = { page, limit: 10, search };
      if (roleFilter !== 'all') params.role = roleFilter;
      const response = await adminApi.getUsers(params);
      return response.data;
    },
  });

  // Fetch roles
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await adminApi.getRoles();
      return response.data as Role[];
    },
  });

  // Fetch agencies
  const { data: agenciesData } = useQuery({
    queryKey: ['agencies'],
    queryFn: async () => {
      const response = await adminApi.getAgencies();
      return response.data;
    },
  });

  const agencies: Agency[] = agenciesData?.data || [];
  const users: User[] = usersData?.data || [];
  const pagination = usersData?.pagination;

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await adminApi.createUser(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      setFormError(error.response?.data?.message || 'Erreur lors de la création');
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await adminApi.updateUser(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowEditDialog(false);
      setSelectedUser(null);
      resetForm();
    },
    onError: (error: any) => {
      setFormError(error.response?.data?.message || 'Erreur lors de la mise à jour');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await adminApi.deleteUser(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Unlock user mutation
  const unlockUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await adminApi.unlockUser(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      nom: '',
      prenom: '',
      telephone: '',
      role: 'TELLER',
      id_ag: null,
    });
    setFormError(null);
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      nom: user.nom,
      prenom: user.prenom,
      telephone: user.telephone || '',
      role: user.role,
      id_ag: user.id_ag,
    });
    setFormError(null);
    setShowEditDialog(true);
  };

  const handleCreateUser = () => {
    if (!formData.email || !formData.password || !formData.nom || !formData.prenom) {
      setFormError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    createUserMutation.mutate(formData);
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    if (!formData.email || !formData.nom || !formData.prenom) {
      setFormError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const updateData: any = {
      email: formData.email,
      nom: formData.nom,
      prenom: formData.prenom,
      telephone: formData.telephone || null,
      role: formData.role,
      id_ag: formData.id_ag,
    };

    if (formData.password) {
      updateData.password = formData.password;
    }

    updateUserMutation.mutate({ id: selectedUser.id, data: updateData });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
          <p className="text-gray-500">Créez et gérez les comptes utilisateurs</p>
        </div>
        <Button className="gap-2" onClick={() => {
          resetForm();
          setShowCreateDialog(true);
        }}>
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles?.map((role, index) => (
          <motion.div
            key={role.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setRoleFilter(roleFilter === role.value ? 'all' : role.value)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{role.label}</p>
                    <p className="text-xl font-bold text-gray-900">
                      {users.filter(u => u.role === role.value).length}
                    </p>
                  </div>
                  <div className={cn('p-3 rounded-lg', roleColors[role.value])}>
                    <Shield className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{role.permissionCount} permissions</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {roles?.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Agence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {users.map((user, index) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.05 }}
                        className="group hover:bg-gray-50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-hopefund-100 rounded-full flex items-center justify-center">
                              <span className="text-hopefund-700 font-semibold">
                                {user.prenom[0]}{user.nom[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.nom_complet}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('border', roleColors[user.role])}>
                            {roleLabels[user.role] || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Building className="h-4 w-4" />
                            <span>{user.agence_nom}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.is_active ? (
                            <Badge variant="success" className="gap-1">
                              <UserCheck className="h-3 w-3" />
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <UserX className="h-3 w-3" />
                              Inactif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {user.last_login ? formatDate(user.last_login) : 'Jamais'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => openEditDialog(user)}
                              >
                                <Edit className="h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => unlockUserMutation.mutate(user.id)}
                              >
                                <Unlock className="h-4 w-4" />
                                Réinitialiser mot de passe
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.is_active ? (
                                <DropdownMenuItem
                                  className="gap-2 text-red-600"
                                  onClick={() => deleteUserMutation.mutate(user.id)}
                                >
                                  <UserX className="h-4 w-4" />
                                  Désactiver
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="gap-2 text-green-600"
                                  onClick={() => updateUserMutation.mutate({
                                    id: user.id,
                                    data: { is_active: true }
                                  })}
                                >
                                  <UserCheck className="h-4 w-4" />
                                  Activer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    {pagination.total} utilisateur(s) au total
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

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Créez un nouveau compte utilisateur
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="jean.dupont@hopefund.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 6 caractères"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                placeholder="+257 XX XX XX XX"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          <Badge className={cn('border text-xs', roleColors[role.value])}>
                            {role.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agence">Agence</Label>
                <Select
                  value={formData.id_ag?.toString() || 'all'}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    id_ag: value === 'all' ? null : parseInt(value)
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les agences" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les agences</SelectItem>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id_ag} value={agency.id_ag.toString()}>
                        {agency.libel_ag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
              className="gap-2"
            >
              {createUserMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations de {selectedUser?.nom_complet}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-prenom">Prénom *</Label>
                <Input
                  id="edit-prenom"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nom">Nom *</Label>
                <Input
                  id="edit-nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">Nouveau mot de passe (optionnel)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Laisser vide pour ne pas modifier"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-telephone">Téléphone</Label>
              <Input
                id="edit-telephone"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rôle *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-agence">Agence</Label>
                <Select
                  value={formData.id_ag?.toString() || 'all'}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    id_ag: value === 'all' ? null : parseInt(value)
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les agences</SelectItem>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id_ag} value={agency.id_ag.toString()}>
                        {agency.libel_ag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
              className="gap-2"
            >
              {updateUserMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
