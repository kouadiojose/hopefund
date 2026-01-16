import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  Merge,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowRight,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { adminApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Duplicate {
  nom: string;
  prenom: string;
  count: number;
  clientIds: number[];
  etats: string[];
}

interface ClientAnalysis {
  client: {
    id_client: number;
    id_ag: number;
    nom: string;
    prenom: string;
    nom_complet: string;
    etat: number;
    date_adh: string;
    telephone: string;
    email: string;
  };
  comptes: Array<{
    id_cpte: number;
    id_ag: number;
    num_complet: string;
    intitule: string;
    solde: number;
    etat: number;
    date_ouvert: string;
    date_clot: string | null;
  }>;
  credits: Array<{
    id_doss: number;
    id_ag: number;
    montant_octroye: number;
    etat: number;
    date_demande: string;
    date_deblocage: string;
    duree_mois: number;
    echeances_count: number;
    garanties_count: number;
  }>;
  potentialDuplicates: Array<{
    id_client: number;
    id_ag: number;
    nom: string;
    prenom: string;
    etat: number;
    comptes_count: number;
    credits_count: number;
  }>;
  summary: {
    totalComptes: number;
    totalCredits: number;
    comptesActifs: number;
    creditsEnCours: number;
    hasDuplicates: boolean;
  };
}

export default function DataManagementPage() {
  const [searchClientId, setSearchClientId] = useState('');
  const [clientAnalysis, setClientAnalysis] = useState<ClientAnalysis | null>(null);
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<string>>(new Set());
  const [compareClients, setCompareClients] = useState<ClientAnalysis[]>([]);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [mergeDialog, setMergeDialog] = useState<{
    open: boolean;
    sourceId: number | null;
    targetId: number | null;
    sourceName: string;
    targetName: string;
  }>({ open: false, sourceId: null, targetId: null, sourceName: '', targetName: '' });
  const [activateDialog, setActivateDialog] = useState(false);

  // Fetch duplicates
  const { data: duplicatesData, isLoading: loadingDuplicates, refetch: refetchDuplicates, error: duplicatesError } = useQuery({
    queryKey: ['admin', 'duplicates'],
    queryFn: async () => {
      const response = await adminApi.getDuplicates();
      return response.data;
    },
  });

  // Activate all clients mutation
  const activateMutation = useMutation({
    mutationFn: () => adminApi.activateAllClients(),
    onSuccess: (response) => {
      alert(response.data.message);
      setActivateDialog(false);
      refetchDuplicates();
    },
    onError: (error: any) => {
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    },
  });

  // Analyze client mutation
  const analyzeMutation = useMutation({
    mutationFn: (clientId: number) => adminApi.analyzeClient(clientId),
    onSuccess: (response) => {
      setClientAnalysis(response.data);
    },
    onError: (error: any) => {
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    },
  });

  // Merge clients mutation
  const mergeMutation = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: number; targetId: number }) =>
      adminApi.mergeClients(sourceId, targetId),
    onSuccess: (response) => {
      alert(`Fusion réussie!\n${response.data.details.movedAccounts} compte(s) transféré(s)\n${response.data.details.movedCredits} crédit(s) transféré(s)`);
      setMergeDialog({ open: false, sourceId: null, targetId: null, sourceName: '', targetName: '' });
      setClientAnalysis(null);
      setCompareClients([]);
      refetchDuplicates();
    },
    onError: (error: any) => {
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    },
  });

  const handleAnalyzeClient = () => {
    const id = parseInt(searchClientId);
    if (isNaN(id)) {
      alert('Veuillez entrer un ID client valide');
      return;
    }
    analyzeMutation.mutate(id);
  };

  // Load and compare all clients in a duplicate group
  const handleCompareGroup = async (clientIds: number[]) => {
    setLoadingCompare(true);
    setCompareClients([]);
    try {
      const analyses = await Promise.all(
        clientIds.map(async (id) => {
          const response = await adminApi.analyzeClient(id);
          return response.data;
        })
      );
      setCompareClients(analyses);
    } catch (error: any) {
      alert('Erreur lors du chargement: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadingCompare(false);
    }
  };

  const toggleDuplicateExpand = (key: string) => {
    const newExpanded = new Set(expandedDuplicates);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedDuplicates(newExpanded);
  };

  const getEtatLabel = (etat: number | string | null | undefined) => {
    if (etat === null || etat === undefined) return 'Inconnu';
    const e = typeof etat === 'string' ? parseInt(etat) : etat;
    if (isNaN(e)) return 'Inconnu';
    switch (e) {
      case 1: return 'Actif';
      case 2: return 'Inactif';
      case 0: return 'Suspendu';
      default: return `Etat ${etat}`;
    }
  };

  const getEtatColor = (etat: number | string | null | undefined) => {
    if (etat === null || etat === undefined) return 'bg-gray-100 text-gray-700';
    const e = typeof etat === 'string' ? parseInt(etat) : etat;
    if (isNaN(e)) return 'bg-gray-100 text-gray-700';
    switch (e) {
      case 1: return 'bg-green-100 text-green-700';
      case 2: return 'bg-gray-100 text-gray-700';
      case 0: return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getTotalSolde = (comptes: ClientAnalysis['comptes']) => {
    return comptes.reduce((sum, c) => sum + (Number(c.solde) || 0), 0);
  };

  const getTotalCredits = (credits: ClientAnalysis['credits']) => {
    return credits.reduce((sum, c) => sum + (Number(c.montant_octroye) || 0), 0);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des données</h1>
          <p className="text-muted-foreground">Analyse et nettoyage des données clients</p>
        </div>
      </div>

      {/* Error display */}
      {duplicatesError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {(duplicatesError as any)?.response?.data?.error || (duplicatesError as any)?.message || 'Erreur inconnue'}
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {duplicatesData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total clients</p>
                  <p className="text-xl font-bold">{duplicatesData.statistics.totalClients.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clients inactifs</p>
                  <p className="text-xl font-bold">{duplicatesData.statistics.inactiveClients.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Database className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Groupes doublons</p>
                  <p className="text-xl font-bold">{duplicatesData.statistics.duplicateGroups}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total comptes</p>
                  <p className="text-xl font-bold">{duplicatesData.statistics.totalAccounts.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Activate All Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Activer tous les clients
            </CardTitle>
            <CardDescription>
              Met tous les clients en statut "Actif" (etat = 1)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setActivateDialog(true)}
              className="w-full"
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Activer {duplicatesData?.statistics.inactiveClients || 0} clients inactifs
            </Button>
          </CardContent>
        </Card>

        {/* Analyze Client */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Analyser un client
            </CardTitle>
            <CardDescription>
              Voir tous les comptes, crédits et doublons potentiels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="ID du client (ex: 4051)"
                value={searchClientId}
                onChange={(e) => setSearchClientId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeClient()}
              />
              <Button onClick={handleAnalyzeClient} disabled={analyzeMutation.isPending}>
                {analyzeMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison View */}
      {compareClients.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Comparaison des doublons ({compareClients.length} clients)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCompareClients([])}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white">
                  <tr>
                    <th className="text-left p-3 font-medium border-b">Propriété</th>
                    {compareClients.map((c) => (
                      <th key={c.client.id_client} className="text-left p-3 font-medium border-b min-w-[200px]">
                        Client #{c.client.id_client}
                        <Badge className={`ml-2 ${getEtatColor(c.client.etat)}`}>
                          {getEtatLabel(c.client.etat)}
                        </Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-medium bg-gray-50">Nom complet</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3">{c.client.nom_complet}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium bg-gray-50">Agence</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3">#{c.client.id_ag}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium bg-gray-50">Téléphone</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3">{c.client.telephone || 'N/A'}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium bg-gray-50">Email</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3">{c.client.email || 'N/A'}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium bg-gray-50">Date adhésion</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3">{formatDate(c.client.date_adh)}</td>
                    ))}
                  </tr>
                  <tr className="border-b bg-blue-50">
                    <td className="p-3 font-medium">Nombre de comptes</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3 font-bold">{c.summary.totalComptes}</td>
                    ))}
                  </tr>
                  <tr className="border-b bg-blue-50">
                    <td className="p-3 font-medium">Solde total</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3 font-bold">{formatCurrency(getTotalSolde(c.comptes))}</td>
                    ))}
                  </tr>
                  <tr className="border-b bg-green-50">
                    <td className="p-3 font-medium">Nombre de crédits</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3 font-bold">{c.summary.totalCredits}</td>
                    ))}
                  </tr>
                  <tr className="border-b bg-green-50">
                    <td className="p-3 font-medium">Total crédits octroyés</td>
                    {compareClients.map((c) => (
                      <td key={c.client.id_client} className="p-3 font-bold">{formatCurrency(getTotalCredits(c.credits))}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-medium bg-gray-50">Actions</td>
                    {compareClients.map((c, idx) => (
                      <td key={c.client.id_client} className="p-3">
                        <div className="flex flex-col gap-2">
                          {compareClients.filter((_, i) => i !== idx).map((other) => (
                            <Button
                              key={other.client.id_client}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => setMergeDialog({
                                open: true,
                                sourceId: other.client.id_client,
                                targetId: c.client.id_client,
                                sourceName: other.client.nom_complet,
                                targetName: c.client.nom_complet,
                              })}
                            >
                              <Merge className="w-3 h-3 mr-1" />
                              Fusionner #{other.client.id_client} → ici
                            </Button>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Detailed accounts and credits */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {compareClients.map((c) => (
                <div key={c.client.id_client} className="bg-white p-4 rounded-lg border">
                  <h4 className="font-medium mb-3">Client #{c.client.id_client} - Détails</h4>

                  {c.comptes.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Comptes:</p>
                      {c.comptes.map((compte) => (
                        <div key={compte.id_cpte} className="text-sm p-2 bg-gray-50 rounded mb-1">
                          <span className="font-mono">{compte.num_complet || `#${compte.id_cpte}`}</span>
                          <span className="float-right">{formatCurrency(compte.solde)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {c.credits.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Crédits:</p>
                      {c.credits.map((credit) => (
                        <div key={credit.id_doss} className="text-sm p-2 bg-gray-50 rounded mb-1">
                          <span>Crédit #{credit.id_doss}</span>
                          <span className="float-right">{formatCurrency(credit.montant_octroye)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {c.comptes.length === 0 && c.credits.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun compte ni crédit</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single Client Analysis Result */}
      {clientAnalysis && compareClients.length === 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle>Analyse du client #{clientAnalysis.client.id_client}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Nom complet</p>
                <p className="font-medium">{clientAnalysis.client.nom_complet}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Agence</p>
                <p className="font-medium">#{clientAnalysis.client.id_ag}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Téléphone</p>
                <p className="font-medium">{clientAnalysis.client.telephone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Statut</p>
                <Badge className={getEtatColor(clientAnalysis.client.etat)}>
                  {getEtatLabel(clientAnalysis.client.etat)}
                </Badge>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-white rounded-lg text-center">
                <p className="text-2xl font-bold">{clientAnalysis.summary.totalComptes}</p>
                <p className="text-sm text-muted-foreground">Comptes</p>
              </div>
              <div className="p-3 bg-white rounded-lg text-center">
                <p className="text-2xl font-bold">{clientAnalysis.summary.totalCredits}</p>
                <p className="text-sm text-muted-foreground">Crédits</p>
              </div>
              <div className="p-3 bg-white rounded-lg text-center">
                <p className="text-2xl font-bold">{clientAnalysis.summary.comptesActifs}</p>
                <p className="text-sm text-muted-foreground">Comptes actifs</p>
              </div>
              <div className="p-3 bg-white rounded-lg text-center">
                <p className="text-2xl font-bold">{clientAnalysis.potentialDuplicates.length}</p>
                <p className="text-sm text-muted-foreground">Doublons potentiels</p>
              </div>
            </div>

            {/* Comptes */}
            {clientAnalysis.comptes.length > 0 && (
              <div className="p-4 bg-white rounded-lg">
                <h4 className="font-medium mb-3">Comptes ({clientAnalysis.comptes.length})</h4>
                <div className="space-y-2">
                  {clientAnalysis.comptes.map((compte) => (
                    <div key={compte.id_cpte} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-mono text-sm">{compte.num_complet || `#${compte.id_cpte}`}</span>
                        <span className="text-muted-foreground ml-2 text-sm">{compte.intitule}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(compte.solde)}</p>
                        <Badge className={getEtatColor(compte.etat)} variant="outline">
                          {compte.etat === 1 ? 'Actif' : compte.etat === 4 ? 'Clôturé' : `Etat ${compte.etat}`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Crédits */}
            {clientAnalysis.credits.length > 0 && (
              <div className="p-4 bg-white rounded-lg">
                <h4 className="font-medium mb-3">Crédits ({clientAnalysis.credits.length})</h4>
                <div className="space-y-2">
                  {clientAnalysis.credits.map((credit) => (
                    <div key={credit.id_doss} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">Crédit #{credit.id_doss}</span>
                        <span className="text-muted-foreground ml-2 text-sm">
                          {credit.duree_mois} mois - {credit.echeances_count} échéances
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(credit.montant_octroye)}</p>
                        <Badge variant="outline">Etat {credit.etat}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Potential Duplicates */}
            {clientAnalysis.potentialDuplicates.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Doublons potentiels détectés!</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-2">
                    {clientAnalysis.potentialDuplicates.map((dup) => (
                      <div key={dup.id_client} className="flex justify-between items-center p-2 bg-white rounded">
                        <div>
                          <span className="font-medium">#{dup.id_client}</span>
                          <span className="ml-2">{dup.prenom} {dup.nom}</span>
                          <Badge className={getEtatColor(dup.etat)} variant="outline">
                            {getEtatLabel(dup.etat)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{dup.comptes_count} cptes, {dup.credits_count} crédits</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompareGroup([clientAnalysis.client.id_client, dup.id_client])}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Comparer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Duplicates List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Doublons détectés ({duplicatesData?.duplicates?.length || 0})
            </CardTitle>
            <CardDescription>
              Clients avec le même nom et prénom
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchDuplicates()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent>
          {loadingDuplicates ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !duplicatesData?.duplicates || duplicatesData.duplicates.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucun doublon détecté</p>
          ) : (
            <div className="space-y-2">
              {duplicatesData.duplicates.slice(0, 50).map((dup: Duplicate, idx: number) => {
                const key = `${dup.nom}-${dup.prenom}-${idx}`;
                const isExpanded = expandedDuplicates.has(key);

                return (
                  <div key={key} className="border rounded-lg">
                    <div
                      className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleDuplicateExpand(key)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        <span className="font-medium">{dup.prenom} {dup.nom}</span>
                        <Badge variant="secondary">{dup.count} enregistrements</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          IDs: {dup.clientIds?.join(', ') || 'N/A'}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dup.clientIds && dup.clientIds.length > 0) {
                              handleCompareGroup(dup.clientIds);
                            }
                          }}
                          disabled={loadingCompare}
                        >
                          {loadingCompare ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4 mr-1" />
                          )}
                          Comparer
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3 bg-muted/30 border-t space-y-2">
                        {dup.clientIds?.map((id, i) => (
                          <div key={id} className="flex justify-between items-center p-2 bg-white rounded">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Client #{id}</span>
                              <Badge className={getEtatColor(dup.etats?.[i])}>
                                {getEtatLabel(dup.etats?.[i])}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchClientId(id.toString());
                                  analyzeMutation.mutate(id);
                                }}
                              >
                                <Search className="w-4 h-4 mr-1" />
                                Analyser
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activate Dialog */}
      <Dialog open={activateDialog} onOpenChange={setActivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activer tous les clients?</DialogTitle>
            <DialogDescription>
              Cette action va mettre {duplicatesData?.statistics?.inactiveClients || 0} clients en statut "Actif".
              Cette opération est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialog.open} onOpenChange={(open) => !open && setMergeDialog({ open: false, sourceId: null, targetId: null, sourceName: '', targetName: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fusionner les clients?</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>Cette action va transférer tous les comptes et crédits:</p>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <span className="font-medium">#{mergeDialog.sourceId}</span>
                <span className="text-sm">{mergeDialog.sourceName}</span>
                <ArrowRight className="w-4 h-4" />
                <span className="font-medium">#{mergeDialog.targetId}</span>
                <span className="text-sm">{mergeDialog.targetName}</span>
              </div>
              <p>Le client source (#{mergeDialog.sourceId}) sera marqué comme inactif.</p>
              <p className="text-red-600 font-medium">⚠️ Cette opération est irréversible!</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog({ open: false, sourceId: null, targetId: null, sourceName: '', targetName: '' })}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (mergeDialog.sourceId && mergeDialog.targetId) {
                  mergeMutation.mutate({
                    sourceId: mergeDialog.sourceId,
                    targetId: mergeDialog.targetId,
                  });
                }
              }}
              disabled={mergeMutation.isPending}
            >
              {mergeMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Merge className="w-4 h-4 mr-2" />
              )}
              Fusionner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
