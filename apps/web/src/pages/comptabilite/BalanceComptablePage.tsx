import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calculator,
  Download,
  Calendar,
  Filter,
  Printer,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';

interface LigneBalance {
  numero_compte: string;
  libelle: string;
  solde_debut_debit: number;
  solde_debut_credit: number;
  mouvement_debit: number;
  mouvement_credit: number;
  solde_fin_debit: number;
  solde_fin_credit: number;
}

export default function BalanceComptablePage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [agence, setAgence] = useState('all');

  const { data: balance, isLoading } = useQuery({
    queryKey: ['balance-comptable', dateDebut, dateFin, agence],
    queryFn: () => comptabiliteApi.getBalance({ dateDebut, dateFin, agence }),
    enabled: !!dateDebut && !!dateFin,
  });

  // Sample data for demonstration
  const sampleBalance: LigneBalance[] = [
    {
      numero_compte: '1.0.1.1.1',
      libelle: 'COFFRE FORT SIEGE',
      solde_debut_debit: 45000000,
      solde_debut_credit: 0,
      mouvement_debit: 15000000,
      mouvement_credit: 11000000,
      solde_fin_debit: 49000000,
      solde_fin_credit: 0,
    },
    {
      numero_compte: '1.0.1.2.1',
      libelle: 'COFFRE FORT MAKAMBA',
      solde_debut_debit: 42000000,
      solde_debut_credit: 0,
      mouvement_debit: 12000000,
      mouvement_credit: 5000000,
      solde_fin_debit: 48991355,
      solde_fin_credit: 0,
    },
    {
      numero_compte: '1.1.1.1.1',
      libelle: 'B.R.B N° 1150/007',
      solde_debut_debit: 320000000,
      solde_debut_credit: 0,
      mouvement_debit: 25000000,
      mouvement_credit: 19230445,
      solde_fin_debit: 325769555,
      solde_fin_credit: 0,
    },
    {
      numero_compte: '2.1.1.1.6',
      libelle: 'Crédits CT Autres',
      solde_debut_debit: 250000000,
      solde_debut_credit: 0,
      mouvement_debit: 50000000,
      mouvement_credit: 36993652,
      solde_fin_debit: 263006348,
      solde_fin_credit: 0,
    },
    {
      numero_compte: '2.2.1.1',
      libelle: 'Dépôts à vue des individus',
      solde_debut_debit: 0,
      solde_debut_credit: 2100000000,
      mouvement_debit: 150000000,
      mouvement_credit: 229817193,
      solde_fin_debit: 0,
      solde_fin_credit: 2179817193,
    },
    {
      numero_compte: '5.5.1.1',
      libelle: 'Capital libéré',
      solde_debut_debit: 0,
      solde_debut_credit: 559300000,
      mouvement_debit: 0,
      mouvement_credit: 0,
      solde_fin_debit: 0,
      solde_fin_credit: 559300000,
    },
  ];

  const displayData = balance?.data || sampleBalance;

  const totaux = displayData.reduce(
    (acc, ligne) => ({
      solde_debut_debit: acc.solde_debut_debit + ligne.solde_debut_debit,
      solde_debut_credit: acc.solde_debut_credit + ligne.solde_debut_credit,
      mouvement_debit: acc.mouvement_debit + ligne.mouvement_debit,
      mouvement_credit: acc.mouvement_credit + ligne.mouvement_credit,
      solde_fin_debit: acc.solde_fin_debit + ligne.solde_fin_debit,
      solde_fin_credit: acc.solde_fin_credit + ligne.solde_fin_credit,
    }),
    {
      solde_debut_debit: 0,
      solde_debut_credit: 0,
      mouvement_debit: 0,
      mouvement_credit: 0,
      solde_fin_debit: 0,
      solde_fin_credit: 0,
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Balance Comptable
          </h1>
          <p className="text-gray-500">Balance générale des comptes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exporter Excel
          </Button>
        </div>
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
              <Label>Agence</Label>
              <Select value={agence} onValueChange={setAgence}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les agences" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les agences</SelectItem>
                  <SelectItem value="1">Bujumbura Siège</SelectItem>
                  <SelectItem value="2">Makamba</SelectItem>
                  <SelectItem value="3">Jabe</SelectItem>
                  <SelectItem value="4">Kamenge</SelectItem>
                  <SelectItem value="5">Nyanza Lac</SelectItem>
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

      {/* Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Balance au {dateFin || 'aujourd\'hui'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th rowSpan={2} className="px-4 py-2 text-left text-xs font-medium text-gray-500 border">N° Compte</th>
                  <th rowSpan={2} className="px-4 py-2 text-left text-xs font-medium text-gray-500 border">Libellé</th>
                  <th colSpan={2} className="px-4 py-2 text-center text-xs font-medium text-gray-500 border bg-blue-50">Solde Début</th>
                  <th colSpan={2} className="px-4 py-2 text-center text-xs font-medium text-gray-500 border bg-yellow-50">Mouvements</th>
                  <th colSpan={2} className="px-4 py-2 text-center text-xs font-medium text-gray-500 border bg-green-50">Solde Fin</th>
                </tr>
                <tr>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 border bg-blue-50">Débit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 border bg-blue-50">Crédit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 border bg-yellow-50">Débit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 border bg-yellow-50">Crédit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 border bg-green-50">Débit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 border bg-green-50">Crédit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayData.map((ligne, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono border">{ligne.numero_compte}</td>
                    <td className="px-4 py-2 text-sm border">{ligne.libelle}</td>
                    <td className="px-4 py-2 text-sm text-right border">
                      {ligne.solde_debut_debit > 0 ? formatCurrency(ligne.solde_debut_debit) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right border">
                      {ligne.solde_debut_credit > 0 ? formatCurrency(ligne.solde_debut_credit) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right border">
                      {ligne.mouvement_debit > 0 ? formatCurrency(ligne.mouvement_debit) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right border">
                      {ligne.mouvement_credit > 0 ? formatCurrency(ligne.mouvement_credit) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium border">
                      {ligne.solde_fin_debit > 0 ? formatCurrency(ligne.solde_fin_debit) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium border">
                      {ligne.solde_fin_credit > 0 ? formatCurrency(ligne.solde_fin_credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm border">TOTAUX</td>
                  <td className="px-4 py-3 text-sm text-right border">{formatCurrency(totaux.solde_debut_debit)}</td>
                  <td className="px-4 py-3 text-sm text-right border">{formatCurrency(totaux.solde_debut_credit)}</td>
                  <td className="px-4 py-3 text-sm text-right border">{formatCurrency(totaux.mouvement_debit)}</td>
                  <td className="px-4 py-3 text-sm text-right border">{formatCurrency(totaux.mouvement_credit)}</td>
                  <td className="px-4 py-3 text-sm text-right border">{formatCurrency(totaux.solde_fin_debit)}</td>
                  <td className="px-4 py-3 text-sm text-right border">{formatCurrency(totaux.solde_fin_credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
