import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Lock,
  Check,
  ChevronDown,
  ChevronRight,
  Save,
  RefreshCw,
  Search,
  Info,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { adminApi, permissionsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Role {
  id?: number;
  value: string;
  code: string;
  label: string;
  description: string;
  color: string;
  is_system?: boolean;
  permissionCount: number;
  permissions?: string[];
}

interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
  module: string;
}

interface Module {
  code: string;
  label: string;
  description: string;
  icon: string;
  permissionCount: number;
}

const colorOptions = [
  { value: 'purple', label: 'Violet', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'blue', label: 'Bleu', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'green', label: 'Vert', class: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'yellow', label: 'Jaune', class: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'red', label: 'Rouge', class: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'pink', label: 'Rose', class: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'gray', label: 'Gris', class: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const getColorClass = (color: string) => {
  return colorOptions.find(c => c.value === color)?.class || 'bg-gray-100 text-gray-700 border-gray-200';
};

export default function RolesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [searchPermission, setSearchPermission] = useState('');
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    description: '',
    color: 'gray',
  });

  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await adminApi.getRoles();
      return response.data as Role[];
    },
  });

  // Fetch all permissions
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const response = await permissionsApi.getAll();
      return response.data;
    },
  });

  // Fetch modules
  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      const response = await permissionsApi.getModules();
      return response.data as Module[];
    },
  });

  // Fetch role permissions when a role is selected
  const { data: rolePermissionsData, isLoading: rolePermissionsLoading } = useQuery({
    queryKey: ['rolePermissions', selectedRole],
    queryFn: async () => {
      if (!selectedRole) return null;
      const response = await permissionsApi.getRolePermissions(selectedRole);
      return response.data;
    },
    enabled: !!selectedRole,
  });

  // Update role permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ role, permissionIds }: { role: string; permissionIds: number[] }) => {
      return permissionsApi.setRolePermissions(role, permissionIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['rolePermissions', selectedRole] });
      setHasChanges(false);
      toast({ title: 'Permissions mises à jour', description: 'Les permissions ont été enregistrées.' });
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour les permissions.', variant: 'destructive' });
    },
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return adminApi.createRole(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Rôle créé', description: 'Le nouveau rôle a été créé avec succès.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Impossible de créer le rôle.',
        variant: 'destructive',
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ code, data }: { code: string; data: Partial<typeof formData> }) => {
      return adminApi.updateRole(code, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowEditDialog(false);
      setEditingRole(null);
      resetForm();
      toast({ title: 'Rôle modifié', description: 'Le rôle a été mis à jour avec succès.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Impossible de modifier le rôle.',
        variant: 'destructive',
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (code: string) => {
      return adminApi.deleteRole(code);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowDeleteDialog(false);
      setEditingRole(null);
      if (selectedRole === editingRole?.code) {
        setSelectedRole(null);
      }
      toast({ title: 'Rôle supprimé', description: 'Le rôle a été supprimé avec succès.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Impossible de supprimer le rôle.',
        variant: 'destructive',
      });
    },
  });

  const permissions: Permission[] = permissionsData?.data || [];
  const groupedPermissions: Record<string, Permission[]> = permissionsData?.grouped || {};

  const resetForm = () => {
    setFormData({ code: '', label: '', description: '', color: 'gray' });
  };

  const handleSelectRole = (roleValue: string) => {
    setSelectedRole(roleValue);
    setHasChanges(false);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({
      code: role.code,
      label: role.label,
      description: role.description || '',
      color: role.color,
    });
    setShowEditDialog(true);
  };

  const handleDeleteRole = (role: Role) => {
    setEditingRole(role);
    setShowDeleteDialog(true);
  };

  // Filter permissions based on search
  const filteredGroupedPermissions = Object.entries(groupedPermissions).reduce((acc, [module, perms]) => {
    const filtered = perms.filter(
      p =>
        p.code.toLowerCase().includes(searchPermission.toLowerCase()) ||
        p.name.toLowerCase().includes(searchPermission.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[module] = filtered;
    }
    return acc;
  }, {} as Record<string, Permission[]>);

  const togglePermission = (permissionId: number) => {
    const role = roles?.find(r => r.value === selectedRole);
    if (role?.is_system && (selectedRole === 'SUPER_ADMIN' || selectedRole === 'DIRECTOR')) return;

    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
    setHasChanges(true);
  };

  const toggleModule = (module: string) => {
    const role = roles?.find(r => r.value === selectedRole);
    if (role?.is_system && (selectedRole === 'SUPER_ADMIN' || selectedRole === 'DIRECTOR')) return;

    const modulePerms = groupedPermissions[module] || [];
    const allSelected = modulePerms.every(p => selectedPermissions.has(p.id));

    const newSelected = new Set(selectedPermissions);
    modulePerms.forEach(p => {
      if (allSelected) {
        newSelected.delete(p.id);
      } else {
        newSelected.add(p.id);
      }
    });
    setSelectedPermissions(newSelected);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!selectedRole) return;
    updatePermissionsMutation.mutate({
      role: selectedRole,
      permissionIds: Array.from(selectedPermissions),
    });
  };

  const handleReset = () => {
    if (rolePermissionsData?.permissions) {
      setSelectedPermissions(new Set(rolePermissionsData.permissions.map((p: Permission) => p.id)));
      setHasChanges(false);
    }
  };

  // Update selected permissions when role permissions data changes
  if (rolePermissionsData?.permissions && !hasChanges) {
    const currentIds = new Set<number>(rolePermissionsData.permissions.map((p: Permission) => p.id));
    if (selectedPermissions.size !== currentIds.size ||
        ![...selectedPermissions].every(id => currentIds.has(id))) {
      setSelectedPermissions(currentIds);
    }
  }

  const currentRole = roles?.find(r => r.value === selectedRole);
  const isReadOnlyRole = currentRole?.is_system && (selectedRole === 'SUPER_ADMIN' || selectedRole === 'DIRECTOR');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Rôles</h1>
          <p className="text-gray-500">Créez des rôles et configurez leurs permissions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Rôle
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Roles List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Rôles
            </CardTitle>
            <CardDescription>Sélectionnez un rôle pour modifier ses permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rolesLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
              </div>
            ) : (
              roles?.map((role) => (
                <motion.div
                  key={role.value}
                  className={cn(
                    'p-4 rounded-lg border transition-all duration-200',
                    selectedRole === role.value
                      ? 'border-hopefund-500 bg-hopefund-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                  whileHover={{ scale: 1.01 }}
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => handleSelectRole(role.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', getColorClass(role.color))}>
                          <Shield className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{role.label}</p>
                            {role.is_system && (
                              <Badge variant="outline" className="text-xs">Système</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{role.permissionCount} permissions</p>
                        </div>
                      </div>
                      {selectedRole === role.value && (
                        <Check className="h-5 w-5 text-hopefund-600" />
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 line-clamp-2">{role.description}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditRole(role);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Modifier
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role);
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Supprimer
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Permissions Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Permissions
                  {selectedRole && currentRole && (
                    <Badge className={cn('ml-2', getColorClass(currentRole.color))}>
                      {currentRole.label}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {selectedRole
                    ? `Gérez les permissions du rôle ${currentRole?.label}`
                    : 'Sélectionnez un rôle pour voir ses permissions'}
                </CardDescription>
              </div>
              {selectedRole && hasChanges && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updatePermissionsMutation.isPending}
                  >
                    {updatePermissionsMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Enregistrer
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRole ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Shield className="h-12 w-12 mb-4 text-gray-300" />
                <p>Sélectionnez un rôle pour gérer ses permissions</p>
              </div>
            ) : rolePermissionsLoading || permissionsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {isReadOnlyRole && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Les rôles Super Admin et Directeur ont accès à toutes les permissions par défaut et ne peuvent pas être modifiés.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher une permission..."
                    value={searchPermission}
                    onChange={(e) => setSearchPermission(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    <strong className="text-gray-900">{selectedPermissions.size}</strong> permissions sélectionnées
                  </span>
                  <span>
                    sur <strong className="text-gray-900">{permissions.length}</strong> au total
                  </span>
                </div>

                {/* Permissions by Module */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {Object.entries(filteredGroupedPermissions).map(([module, modulePerms]) => {
                    const selectedCount = modulePerms.filter(p => selectedPermissions.has(p.id)).length;
                    const allSelected = selectedCount === modulePerms.length;
                    const someSelected = selectedCount > 0 && selectedCount < modulePerms.length;

                    return (
                      <div key={module} className="border rounded-lg">
                        <button
                          className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            if (expandedModules.includes(module)) {
                              setExpandedModules(expandedModules.filter(m => m !== module));
                            } else {
                              setExpandedModules([...expandedModules, module]);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={allSelected}
                              // @ts-ignore
                              indeterminate={someSelected}
                              onCheckedChange={() => toggleModule(module)}
                              disabled={isReadOnlyRole}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            />
                            <div>
                              <p className="font-medium text-gray-900 text-left">
                                {modules?.find(m => m.code === module)?.label || module}
                              </p>
                              <p className="text-xs text-gray-500 text-left">
                                {selectedCount} / {modulePerms.length} permissions
                              </p>
                            </div>
                          </div>
                          {expandedModules.includes(module) ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                        </button>

                        <AnimatePresence>
                          {expandedModules.includes(module) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-1 border-t pt-2">
                                {modulePerms.map((perm) => (
                                  <TooltipProvider key={perm.id}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <label
                                          className={cn(
                                            'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                                            selectedPermissions.has(perm.id)
                                              ? 'bg-hopefund-50'
                                              : 'hover:bg-gray-50',
                                            isReadOnlyRole && 'cursor-not-allowed opacity-75'
                                          )}
                                        >
                                          <Checkbox
                                            checked={isReadOnlyRole || selectedPermissions.has(perm.id)}
                                            onCheckedChange={() => togglePermission(perm.id)}
                                            disabled={isReadOnlyRole}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                              {perm.name}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                              {perm.code}
                                            </p>
                                          </div>
                                        </label>
                                      </TooltipTrigger>
                                      {perm.description && (
                                        <TooltipContent>
                                          <p>{perm.description}</p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau rôle</DialogTitle>
            <DialogDescription>
              Définissez les informations de base du rôle. Vous pourrez ensuite lui attribuer des permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code du rôle</Label>
              <Input
                id="code"
                placeholder="EX: AGENT_TERRAIN"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '') })}
              />
              <p className="text-xs text-gray-500">Majuscules et underscores uniquement (ex: AGENT_TERRAIN)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Nom du rôle</Label>
              <Input
                id="label"
                placeholder="Agent de terrain"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Description des responsabilités du rôle..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-4 h-4 rounded', color.class)} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Annuler
            </Button>
            <Button
              onClick={() => createRoleMutation.mutate(formData)}
              disabled={!formData.code || !formData.label || createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Modifiez les informations du rôle "{editingRole?.label}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Code du rôle</Label>
              <Input value={formData.code} disabled className="bg-gray-50" />
              <p className="text-xs text-gray-500">Le code ne peut pas être modifié</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-label">Nom du rôle</Label>
              <Input
                id="edit-label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-4 h-4 rounded', color.class)} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingRole(null); resetForm(); }}>
              Annuler
            </Button>
            <Button
              onClick={() => editingRole && updateRoleMutation.mutate({
                code: editingRole.code,
                data: { label: formData.label, description: formData.description, color: formData.color }
              })}
              disabled={!formData.label || updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le rôle</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le rôle "{editingRole?.label}" ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertDescription>
                Toutes les permissions associées à ce rôle seront également supprimées.
                Assurez-vous qu'aucun utilisateur n'utilise ce rôle.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setEditingRole(null); }}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => editingRole && deleteRoleMutation.mutate(editingRole.code)}
              disabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
