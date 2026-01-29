import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Download,
  Filter,
  Printer,
  Search,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';

interface EcritureGrandLivre {
  date: string;
  piece: string;
  libelle: string;
  debit: number;
  credit: number;
  solde: number;
}

interface CompteGrandLivre {
  numero_compte: string;
  libelle_compte: string;
  solde_initial: number;
  ecritures: EcritureGrandLivre[];
  solde_final: number;
}

export default function GrandLivrePage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [compte, setCompte] = useState('');
  const [search, setSearch] = useState('');

  const { data: grandLivreData } = useQuery({
    queryKey: ['grand-livre', dateDebut, dateFin, compte],
    queryFn: () => comptabiliteApi.getGrandLivre({
      dateDebut: dateDebut || undefined,
      dateFin: dateFin || undefined,
      compte: compte || undefined,
    }),
  });

  const comptes: CompteGrandLivre[] = grandLivreData?.data || [];

  const filteredData = comptes.filter(
    (c) =>
      c.numero_compte.includes(search) ||
      c.libelle_compte.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Grand Livre
          </h1>
          <p className="text-gray-500">Détail des mouvements par compte</p>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <Label>N° Compte</Label>
              <Input
                placeholder="Ex: 1.0.1"
                value={compte}
                onChange={(e) => setCompte(e.target.value)}
              />
            </div>
            <div>
              <Label>Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
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

      {/* Grand Livre */}
      <div className="space-y-6">
        {filteredData.map((compte) => (
          <Card key={compte.numero_compte}>
            <CardHeader className="bg-gray-50">
              <CardTitle className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-hopefund-600">{compte.numero_compte}</span>
                  <span className="mx-2">-</span>
                  <span>{compte.libelle_compte}</span>
                </div>
                <div className="text-sm font-normal">
                  Solde initial: <span className="font-bold">{formatCurrency(compte.solde_initial)}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">N° Pièce</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Libellé</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Débit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Crédit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {compte.ecritures.map((ecriture, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{formatDate(ecriture.date)}</td>
                      <td className="px-4 py-2 text-sm font-mono">{ecriture.piece}</td>
                      <td className="px-4 py-2 text-sm">{ecriture.libelle}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        {ecriture.debit > 0 ? formatCurrency(ecriture.debit) : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        {ecriture.credit > 0 ? formatCurrency(ecriture.credit) : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium">
                        {formatCurrency(ecriture.solde)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold">Solde Final</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      {formatCurrency(compte.ecritures.reduce((sum, e) => sum + e.debit, 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      {formatCurrency(compte.ecritures.reduce((sum, e) => sum + e.credit, 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-hopefund-600">
                      {formatCurrency(compte.solde_final)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
