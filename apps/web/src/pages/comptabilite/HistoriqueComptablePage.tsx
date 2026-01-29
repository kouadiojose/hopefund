import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2,
  FileText,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';

interface Filters {
  dateDebut: string;
  dateFin: string;
  agence: string;
  compte: string;
  search: string;
}

export default function HistoriqueComptablePage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filters, setFilters] = useState<Filters>({
    dateDebut: '',
    dateFin: '',
    agence: '',
    compte: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEcriture, setSelectedEcriture] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['comptabilite-historique', page, limit, filters],
    queryFn: () => comptabiliteApi.getHistorique({
      page,
      limit,
      ...filters,
    }),
  });

  const ecritures = data?.ecritures || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({
      dateDebut: '',
      dateFin: '',
      agence: '',
      compte: '',
      search: '',
    });
    setPage(1);
  };

  const exportCSV = () => {
    if (!ecritures.length) return;

    const headers = ['N° Écriture', 'Date', 'Agence', 'Compte', 'Sens', 'Montant', 'Libellé'];
    const rows = ecritures.map((e: any) => [
      e.id_ecriture,
      e.date_valeur ? formatDate(e.date_valeur) : '',
      e.id_ag,
      e.compte,
      e.sens === 'd' ? 'Débit' : 'Crédit',
      e.montant,
      e.libelle || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map((cell: any) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historique-comptable-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="h-6 w-6" />
            Historique Comptable
          </h1>
          <p className="text-gray-500">Toutes les écritures comptables depuis le commencement</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-hopefund-50' : ''}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtres
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Filtres */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Date début</label>
                <Input
                  type="date"
                  value={filters.dateDebut}
                  onChange={(e) => handleFilterChange('dateDebut', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Date fin</label>
                <Input
                  type="date"
                  value={filters.dateFin}
                  onChange={(e) => handleFilterChange('dateFin', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Agence</label>
                <Input
                  placeholder="ID Agence"
                  value={filters.agence}
                  onChange={(e) => handleFilterChange('agence', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">N° Compte</label>
                <Input
                  placeholder="Numéro de compte"
                  value={filters.compte}
                  onChange={(e) => handleFilterChange('compte', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-10"
                    placeholder="Libellé..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <Button variant="outline" onClick={resetFilters}>
                Réinitialiser
              </Button>
              <Button onClick={() => refetch()}>
                Appliquer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Écritures</p>
                <p className="text-xl font-bold">{pagination.total?.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Page Actuelle</p>
                <p className="text-xl font-bold">{page} / {pagination.pages || 1}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Affichés</p>
                <p className="text-xl font-bold">{ecritures.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Filter className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Filtres Actifs</p>
                <p className="text-xl font-bold">
                  {Object.values(filters).filter(v => v).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table des écritures */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Écritures Comptables</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
            </div>
          ) : ecritures.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune écriture trouvée</p>
              {Object.values(filters).some(v => v) && (
                <Button variant="link" onClick={resetFilters}>
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Écriture</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compte</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sens</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ecritures.map((e: any, idx: number) => (
                    <tr key={`${e.id_ecriture}-${e.compte}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono">
                        <Badge variant="outline">ECR-{e.id_ecriture}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {e.date_valeur ? formatDate(e.date_valeur) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="secondary">AG-{e.id_ag}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">{e.compte}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={e.sens === 'd'
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-red-100 text-red-800 hover:bg-red-100'}
                        >
                          {e.sens === 'd' ? 'Débit' : 'Crédit'}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${e.sens === 'd' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(e.montant)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {e.libelle || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEcriture(e)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Page {page} sur {pagination.pages} ({pagination.total} écritures)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Précédent
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                    const pageNum = Math.max(1, Math.min(page - 2 + i, pagination.pages - 4)) + i;
                    if (pageNum > pagination.pages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-8"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal détail écriture */}
      {selectedEcriture && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Détail Écriture ECR-{selectedEcriture.id_ecriture}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEcriture(null)}>
                  ✕
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">N° Écriture</p>
                    <p className="font-mono font-medium">ECR-{selectedEcriture.id_ecriture}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date Valeur</p>
                    <p className="font-medium">
                      {selectedEcriture.date_valeur ? formatDate(selectedEcriture.date_valeur) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Agence</p>
                    <Badge variant="secondary">AG-{selectedEcriture.id_ag}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">N° Compte</p>
                    <p className="font-mono font-medium">{selectedEcriture.compte}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Sens</p>
                    <Badge
                      className={selectedEcriture.sens === 'd'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'}
                    >
                      {selectedEcriture.sens === 'd' ? 'Débit' : 'Crédit'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Montant</p>
                    <p className={`text-xl font-bold ${selectedEcriture.sens === 'd' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(selectedEcriture.montant)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Libellé</p>
                  <p className="font-medium">{selectedEcriture.libelle || '-'}</p>
                </div>
                {selectedEcriture.piece && (
                  <div>
                    <p className="text-sm text-gray-500">Pièce Justificative</p>
                    <p className="font-mono">{selectedEcriture.piece}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
