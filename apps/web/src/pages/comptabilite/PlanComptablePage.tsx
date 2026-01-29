import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';

interface CompteComptable {
  numero: string;
  libelle: string;
  classe: number;
  type: 'actif' | 'passif' | 'charge' | 'produit';
  sens: 'debiteur' | 'crediteur';
  solde?: number;
  children?: CompteComptable[];
}

// Plan comptable structure based on Hopefund's chart of accounts
const planComptableStructure = [
  {
    classe: 1,
    titre: 'TRESORERIE ET OPERATIONS AVEC LES INSTITUTIONS FINANCIERES',
    comptes: [
      { numero: '1.0', libelle: 'ENCAISSE', type: 'actif', sens: 'debiteur' },
      { numero: '1.0.1', libelle: 'Caisse', type: 'actif', sens: 'debiteur' },
      { numero: '1.0.1.1', libelle: 'Caisse en francs burundais', type: 'actif', sens: 'debiteur' },
      { numero: '1.1', libelle: 'DEPOTS', type: 'actif', sens: 'debiteur' },
      { numero: '1.1.1', libelle: 'DEPOTS A VUE', type: 'actif', sens: 'debiteur' },
      { numero: '1.1.1.1', libelle: 'Banque Centrale', type: 'actif', sens: 'debiteur' },
      { numero: '1.1.1.3', libelle: 'BANQUES COMPTES A VUE', type: 'actif', sens: 'debiteur' },
      { numero: '1.3', libelle: 'EMPRUNTS', type: 'passif', sens: 'crediteur' },
    ],
  },
  {
    classe: 2,
    titre: 'OPERATIONS AVEC LA CLIENTELE',
    comptes: [
      { numero: '2.1', libelle: 'CREDITS A L ECONOMIE', type: 'actif', sens: 'debiteur' },
      { numero: '2.1.1', libelle: 'CREDITS SAINS SUR RESSOURCES NON AFFECTEES', type: 'actif', sens: 'debiteur' },
      { numero: '2.1.1.1', libelle: 'CREDITS SAINS A COURT TERME', type: 'actif', sens: 'debiteur' },
      { numero: '2.1.1.2', libelle: 'CREDITS SAINS A MOYEN TERME', type: 'actif', sens: 'debiteur' },
      { numero: '2.1.4', libelle: 'CREDITS EN SOUFFRANCE', type: 'actif', sens: 'debiteur' },
      { numero: '2.2', libelle: 'DEPOTS DES MEMBRES, CLIENTS ET BENEFICIAIRES', type: 'passif', sens: 'crediteur' },
      { numero: '2.2.1.1', libelle: 'Dépôts à vue des individus', type: 'passif', sens: 'crediteur' },
      { numero: '2.9', libelle: 'PROVISION DES CREDITS EN SOUFFRANCE', type: 'passif', sens: 'crediteur' },
    ],
  },
  {
    classe: 3,
    titre: 'OPERATIONS DIVERSES',
    comptes: [
      { numero: '3.0', libelle: 'STOCKS', type: 'actif', sens: 'debiteur' },
      { numero: '3.1', libelle: 'DEBITEURS DIVERS', type: 'actif', sens: 'debiteur' },
      { numero: '3.3', libelle: 'CREDITEURS DIVERS', type: 'passif', sens: 'crediteur' },
      { numero: '3.3.1', libelle: 'SECURITE SOCIAL, INSS', type: 'passif', sens: 'crediteur' },
      { numero: '3.3.2', libelle: 'IMPOT', type: 'passif', sens: 'crediteur' },
      { numero: '3.5', libelle: 'AVANCE, PRETS AU PERSONNEL', type: 'actif', sens: 'debiteur' },
    ],
  },
  {
    classe: 4,
    titre: 'ACTIFS IMMOBILISES',
    comptes: [
      { numero: '4.0', libelle: 'IMMOBILISATIONS FINANCIERES', type: 'actif', sens: 'debiteur' },
      { numero: '4.2', libelle: 'IMMOBILISATIONS INCORPORELLES', type: 'actif', sens: 'debiteur' },
      { numero: '4.3', libelle: 'IMMOBILISATIONS CORPORELLES', type: 'actif', sens: 'debiteur' },
      { numero: '4.8', libelle: 'AMORTISSEMENT', type: 'passif', sens: 'crediteur' },
    ],
  },
  {
    classe: 5,
    titre: 'FONDS PROPRES',
    comptes: [
      { numero: '5.0', libelle: 'PROVISIONS POUR RISQUES', type: 'passif', sens: 'crediteur' },
      { numero: '5.2', libelle: 'SUBVENTIONS D\'INVESTISSEMENT', type: 'passif', sens: 'crediteur' },
      { numero: '5.4', libelle: 'RESERVES', type: 'passif', sens: 'crediteur' },
      { numero: '5.5', libelle: 'CAPITAL', type: 'passif', sens: 'crediteur' },
      { numero: '5.6', libelle: 'RESULTAT DE L\'EXERCICE', type: 'passif', sens: 'crediteur' },
    ],
  },
  {
    classe: 6,
    titre: 'CHARGES',
    comptes: [
      { numero: '6.0', libelle: 'CHARGES D\'INTERETS', type: 'charge', sens: 'debiteur' },
      { numero: '6.3', libelle: 'CHARGES GENERALES D\'EXPLOITATION', type: 'charge', sens: 'debiteur' },
      { numero: '6.4', libelle: 'IMPOTS ET TAXES', type: 'charge', sens: 'debiteur' },
      { numero: '6.5', libelle: 'PERSONNEL', type: 'charge', sens: 'debiteur' },
      { numero: '6.6', libelle: 'AUTRES CHARGES', type: 'charge', sens: 'debiteur' },
      { numero: '6.8', libelle: 'DOTATIONS AUX AMORTISSEMENTS ET PROVISIONS', type: 'charge', sens: 'debiteur' },
    ],
  },
  {
    classe: 7,
    titre: 'PRODUITS',
    comptes: [
      { numero: '7.0', libelle: 'PRODUITS D\'INTERETS', type: 'produit', sens: 'crediteur' },
      { numero: '7.1', libelle: 'COMMISSIONS SUR OPERATIONS FINANCIERES', type: 'produit', sens: 'crediteur' },
      { numero: '7.2', libelle: 'AUTRES PRODUITS', type: 'produit', sens: 'crediteur' },
      { numero: '7.4', libelle: 'PRODUITS EXCEPTIONNELS', type: 'produit', sens: 'crediteur' },
      { numero: '7.9', libelle: 'REPRISE D\'AMORTISSEMENTS ET DE PROVISIONS', type: 'produit', sens: 'crediteur' },
    ],
  },
];

export default function PlanComptablePage() {
  const [search, setSearch] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<number[]>([1, 2]);

  const toggleClass = (classe: number) => {
    setExpandedClasses((prev) =>
      prev.includes(classe) ? prev.filter((c) => c !== classe) : [...prev, classe]
    );
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'actif':
        return 'bg-blue-100 text-blue-800';
      case 'passif':
        return 'bg-purple-100 text-purple-800';
      case 'charge':
        return 'bg-red-100 text-red-800';
      case 'produit':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredPlan = planComptableStructure.map((classe) => ({
    ...classe,
    comptes: classe.comptes.filter(
      (c) =>
        c.numero.toLowerCase().includes(search.toLowerCase()) ||
        c.libelle.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((classe) => search === '' || classe.comptes.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Plan Comptable
          </h1>
          <p className="text-gray-500">Plan comptable des établissements financiers - Burundi</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau compte
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par numéro ou libellé..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Plan Comptable */}
      <div className="space-y-4">
        {filteredPlan.map((classe) => (
          <Card key={classe.classe}>
            <CardHeader
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => toggleClass(classe.classe)}
            >
              <CardTitle className="flex items-center gap-2">
                {expandedClasses.includes(classe.classe) ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <span className="bg-hopefund-600 text-white px-2 py-1 rounded text-sm">
                  Classe {classe.classe}
                </span>
                {classe.titre}
              </CardTitle>
            </CardHeader>
            {expandedClasses.includes(classe.classe) && (
              <CardContent>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">N° Compte</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Libellé</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Sens</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {classe.comptes.map((compte) => (
                      <tr key={compte.numero} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-mono">{compte.numero}</td>
                        <td className="px-4 py-2 text-sm">{compte.libelle}</td>
                        <td className="px-4 py-2">
                          <Badge className={getTypeColor(compte.type)}>
                            {compte.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-sm capitalize">{compte.sens}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
