import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  Plus,
  Printer,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

  // Sample data
  const depenses: DepenseRevenu[] = [
    { id: 1, date: '2024-01-15', reference: 'DEP-001', libelle: 'Achat fournitures bureau siège', categorie: 'Fournitures de bureau', montant: 250000, type: 'depense', statut: 'valide' },
    { id: 2, date: '2024-01-15', reference: 'DEP-002', libelle: 'Carburant véhicule direction', categorie: 'Carburant', montant: 150000, type: 'depense', statut: 'valide' },
    { id: 3, date: '2024-01-16', reference: 'DEP-003', libelle: 'Réparation imprimante Makamba', categorie: 'Entretien et réparations', montant: 85000, type: 'depense', statut: 'valide' },
    { id: 4, date: '2024-01-17', reference: 'DEP-004', libelle: 'Loyer janvier agence Kamenge', categorie: 'Loyer', montant: 500000, type: 'depense', statut: 'en_attente' },
    { id: 5, date: '2024-01-31', reference: 'DEP-005', libelle: 'Salaires janvier 2024', categorie: 'Salaires', montant: 15000000, type: 'depense', statut: 'valide' },
  ];

  const revenus: DepenseRevenu[] = [
    { id: 1, date: '2024-01-15', reference: 'REV-001', libelle: 'Intérêts crédits janvier', categorie: 'Intérêts sur crédits', montant: 5500000, type: 'revenu', statut: 'valide' },
    { id: 2, date: '2024-01-15', reference: 'REV-002', libelle: 'Frais dossier crédit NIYONZIMA', categorie: 'Frais de dossier', montant: 150000, type: 'revenu', statut: 'valide' },
    { id: 3, date: '2024-01-16', reference: 'REV-003', libelle: 'Commissions virements', categorie: 'Commissions', montant: 85000, type: 'revenu', statut: 'valide' },
    { id: 4, date: '2024-01-17', reference: 'REV-004', libelle: 'Frais tenue compte Q1', categorie: 'Frais de tenue de compte', montant: 2500000, type: 'revenu', statut: 'valide' },
  ];

  const totalDepenses = depenses.reduce((sum, d) => sum + d.montant, 0);
  const totalRevenus = revenus.reduce((sum, r) => sum + r.montant, 0);
  const resultat = totalRevenus - totalDepenses;

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
              <Input type="date" />
            </div>
            <div>
              <Label>Date fin</Label>
              <Input type="date" />
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
