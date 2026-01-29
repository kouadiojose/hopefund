import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  Plus,
  Printer,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';

interface DepenseRevenu {
  id: number;
  date: string;
  reference: string;
  libelle: string;
  categorie: string;
  montant: number;
  type: 'depense' | 'revenu';
  statut: 'valide' | 'en_attente';
}

const categoriesDepenses = [
  'Fournitures de bureau',
  'Carburant',
  'Entretien et réparations',
  'Salaires',
  'Charges sociales',
  'Impôts et taxes',
  'Loyer',
  'Téléphone et internet',
  'Honoraires',
  'Autres charges',
];

const categoriesRevenus = [
  'Intérêts sur crédits',
  'Frais de dossier',
  'Commissions',
  'Frais de tenue de compte',
  'Frais de virement',
  'Autres produits',
];

export default function DepensesRevenusPage() {
  const [activeTab, setActiveTab] = useState('depenses');
  const [categorie, setCategorie] = useState('all');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const { data: depensesRevenusData } = useQuery({
    queryKey: ['depenses-revenus', dateDebut, dateFin],
    queryFn: () => comptabiliteApi.getDepensesRevenus({
      dateDebut: dateDebut || undefined,
      dateFin: dateFin || undefined,
    }),
  });

  const depenses: DepenseRevenu[] = (depensesRevenusData?.depenses || []).map((d: any, index: number) => ({
    id: index + 1,
    date: new Date().toISOString().split('T')[0],
    reference: `DEP-${String(index + 1).padStart(3, '0')}`,
    libelle: d.libelle,
    categorie: d.compte,
    montant: d.montant,
    type: 'depense' as const,
    statut: 'valide' as const,
  }));

  const revenus: DepenseRevenu[] = (depensesRevenusData?.revenus || []).map((r: any, index: number) => ({
    id: index + 1,
    date: new Date().toISOString().split('T')[0],
    reference: `REV-${String(index + 1).padStart(3, '0')}`,
    libelle: r.libelle,
    categorie: r.compte,
    montant: r.montant,
    type: 'revenu' as const,
    statut: 'valide' as const,
  }));

  const totalDepenses = depensesRevenusData?.totalDepenses || 0;
  const totalRevenus = depensesRevenusData?.totalRevenus || 0;
  const resultat = depensesRevenusData?.resultat || (totalRevenus - totalDepenses);

  const filteredDepenses = categorie === 'all' ? depenses : depenses.filter((d) => d.categorie === categorie);
  const filteredRevenus = categorie === 'all' ? revenus : revenus.filter((r) => r.categorie === categorie);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Dépenses / Revenus
          </h1>
          <p className="text-gray-500">Suivi des charges et produits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle opération
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Dépenses</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDepenses)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenus</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenus)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${resultat >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Résultat</p>
                <p className={`text-2xl font-bold ${resultat >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(resultat)}
                </p>
              </div>
              <div className={`p-2 rounded-full ${resultat >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                {resultat >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-orange-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Date début</Label>
              <Input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div>
              <Label>Date fin</Label>
              <Input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
              />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {(activeTab === 'depenses' ? categoriesDepenses : categoriesRevenus).map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full">
                <Filter className="mr-2 h-4 w-4" />
                Filtrer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="depenses" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Dépenses
          </TabsTrigger>
          <TabsTrigger value="revenus" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenus
          </TabsTrigger>
        </TabsList>

        <TabsContent value="depenses">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Référence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Libellé</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Catégorie</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDepenses.map((depense) => (
                    <tr key={depense.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{formatDate(depense.date)}</td>
                      <td className="px-4 py-3 text-sm font-mono">{depense.reference}</td>
                      <td className="px-4 py-3 text-sm">{depense.libelle}</td>
                      <td className="px-4 py-3 text-sm">{depense.categorie}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                        {formatCurrency(depense.montant)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={depense.statut === 'valide' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {depense.statut === 'valide' ? 'Validé' : 'En attente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold">TOTAL DÉPENSES</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                      {formatCurrency(filteredDepenses.reduce((sum, d) => sum + d.montant, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenus">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Référence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Libellé</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Catégorie</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRevenus.map((revenu) => (
                    <tr key={revenu.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{formatDate(revenu.date)}</td>
                      <td className="px-4 py-3 text-sm font-mono">{revenu.reference}</td>
                      <td className="px-4 py-3 text-sm">{revenu.libelle}</td>
                      <td className="px-4 py-3 text-sm">{revenu.categorie}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                        {formatCurrency(revenu.montant)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={revenu.statut === 'valide' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {revenu.statut === 'valide' ? 'Validé' : 'En attente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold">TOTAL REVENUS</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                      {formatCurrency(filteredRevenus.reduce((sum, r) => sum + r.montant, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
