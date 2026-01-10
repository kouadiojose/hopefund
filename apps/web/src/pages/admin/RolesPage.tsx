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
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { adminApi, permissionsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Role {
  value: string;
  label: string;
  description: string;
  color: string;
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

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  DIRECTOR: 'bg-blue-100 text-blue-700 border-blue-200',
  BRANCH_MANAGER: 'bg-green-100 text-green-700 border-green-200',
  TELLER: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CREDIT_OFFICER: 'bg-orange-100 text-orange-700 border-orange-200',
};


export default function RolesPage() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [searchPermission, setSearchPermission] = useState('');
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

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
    },
  });

  const permissions: Permission[] = permissionsData?.data || [];
  const groupedPermissions: Record<string, Permission[]> = permissionsData?.grouped || {};

  // When role permissions are loaded, update selected permissions
  const handleSelectRole = (roleValue: string) => {
    setSelectedRole(roleValue);
    setHasChanges(false);
  };

  // Update selected permissions when role permissions are loaded
  useState(() => {
    if (rolePermissionsData?.permissions) {
      setSelectedPermissions(new Set(rolePermissionsData.permissions.map((p: Permission) => p.id)));
    }
  });

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
    if (selectedRole === 'SUPER_ADMIN' || selectedRole === 'DIRECTOR') return;

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
    if (selectedRole === 'SUPER_ADMIN' || selectedRole === 'DIRECTOR') return;

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

  const isReadOnlyRole = selectedRole === 'SUPER_ADMIN' || selectedRole === 'DIRECTOR';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Rôles</h1>
          <p className="text-gray-500">Configurez les permissions pour chaque rôle du système</p>
        </div>
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
                <motion.button
                  key={role.value}
                  onClick={() => handleSelectRole(role.value)}
                  className={cn(
                    'w-full p-4 rounded-lg border text-left transition-all duration-200',
                    selectedRole === role.value
                      ? 'border-hopefund-500 bg-hopefund-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', roleColors[role.value])}>
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{role.label}</p>
                        <p className="text-xs text-gray-500">{role.permissionCount} permissions</p>
                      </div>
                    </div>
                    {selectedRole === role.value && (
                      <Check className="h-5 w-5 text-hopefund-600" />
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 line-clamp-2">{role.description}</p>
                </motion.button>
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
                  {selectedRole && (
                    <Badge className={cn('ml-2', roleColors[selectedRole])}>
                      {roles?.find(r => r.value === selectedRole)?.label}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {selectedRole
                    ? `Gérez les permissions du rôle ${roles?.find(r => r.value === selectedRole)?.label}`
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
                      Les rôles Direction et Admin IT ont accès à toutes les permissions par défaut et ne peuvent pas être modifiés.
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
    </div>
  );
}
