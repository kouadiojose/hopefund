import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  Download,
  Calendar,
  Filter,
  Printer,
  Plus,
  Eye,
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
import { formatCurrency, formatDate } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';

interface LigneJournal {
  numero_compte: string;
  libelle_compte: string;
  debit: number;
  credit: number;
}

interface EcritureJournal {
  id: number;
  date: string;
  numero_piece: string;
  libelle: string;
  journal: string;
  lignes: LigneJournal[];
  total_debit: number;
  total_credit: number;
  statut: 'brouillon' | 'valide' | 'annule';
}

const journaux = [
  { code: 'OD', libelle: 'Opérations Diverses' },
  { code: 'CA', libelle: 'Caisse' },
  { code: 'BQ', libelle: 'Banque' },
  { code: 'CR', libelle: 'Crédits' },
  { code: 'AC', libelle: 'Achats' },
  { code: 'VE', libelle: 'Ventes' },
];

export default function JournalComptablePage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [journal, setJournal] = useState('all');

  // Sample data
  const sampleData: EcritureJournal[] = [
    {
      id: 1,
      date: '2024-01-15',
      numero_piece: 'CA-2024-0001',
      libelle: 'Approvisionnement caisse guichetier Claudine',
      journal: 'CA',
      lignes: [
        { numero_compte: '1.0.1.1.12', libelle_compte: 'Caisse Claudine', debit: 2000000, credit: 0 },
        { numero_compte: '1.0.1.1.1', libelle_compte: 'COFFRE FORT SIEGE', debit: 0, credit: 2000000 },
      ],
      total_debit: 2000000,
      total_credit: 2000000,
      statut: 'valide',
    },
    {
      id: 2,
      date: '2024-01-15',
      numero_piece: 'CR-2024-0012',
      libelle: 'Déblocage crédit NIYONZIMA Jean - Dossier 45678',
      journal: 'CR',
      lignes: [
        { numero_compte: '2.1.1.1.6', libelle_compte: 'Crédits CT Autres', debit: 5000000, credit: 0 },
        { numero_compte: '2.2.1.1', libelle_compte: 'Dépôts à vue des individus', debit: 0, credit: 5000000 },
      ],
      total_debit: 5000000,
      total_credit: 5000000,
      statut: 'valide',
    },
    {
      id: 3,
      date: '2024-01-16',
      numero_piece: 'BQ-2024-0005',
      libelle: 'Virement vers compte BGF',
      journal: 'BQ',
      lignes: [
        { numero_compte: '1.1.1.3.2.3', libelle_compte: 'BGF 800/001/50/12005/2/62', debit: 10000000, credit: 0 },
        { numero_compte: '1.0.1.1.1', libelle_compte: 'COFFRE FORT SIEGE', debit: 0, credit: 10000000 },
      ],
      total_debit: 10000000,
      total_credit: 10000000,
      statut: 'valide',
    },
    {
      id: 4,
      date: '2024-01-17',
      numero_piece: 'OD-2024-0003',
      libelle: 'Régularisation écart de caisse',
      journal: 'OD',
      lignes: [
        { numero_compte: '3.4.5', libelle_compte: 'Manquant de caisse à justifier', debit: 50000, credit: 0 },
        { numero_compte: '1.0.1.1.12', libelle_compte: 'Caisse Claudine', debit: 0, credit: 50000 },
      ],
      total_debit: 50000,
      total_credit: 50000,
      statut: 'brouillon',
    },
  ];

  const filteredData = journal === 'all'
    ? sampleData
    : sampleData.filter((e) => e.journal === journal);

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'valide':
        return <Badge className="bg-green-100 text-green-800">Validé</Badge>;
      case 'brouillon':
        return <Badge className="bg-yellow-100 text-yellow-800">Brouillon</Badge>;
      case 'annule':
        return <Badge className="bg-red-100 text-red-800">Annulé</Badge>;
      default:
        return null;
    }
  };

  const getJournalLabel = (code: string) => {
    return journaux.find((j) => j.code === code)?.libelle || code;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Journal Comptable
          </h1>
          <p className="text-gray-500">Écritures comptables journalières</p>
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
            Nouvelle écriture
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
              <Label>Journal</Label>
              <Select value={journal} onValueChange={setJournal}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les journaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les journaux</SelectItem>
                  {journaux.map((j) => (
                    <SelectItem key={j.code} value={j.code}>
                      {j.code} - {j.libelle}
                    </SelectItem>
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

      {/* Journal Entries */}
      <div className="space-y-4">
        {filteredData.map((ecriture) => (
          <Card key={ecriture.id}>
            <CardHeader className="py-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">{formatDate(ecriture.date)}</span>
                  <span className="font-mono font-bold text-hopefund-600">{ecriture.numero_piece}</span>
                  <Badge variant="outline">{getJournalLabel(ecriture.journal)}</Badge>
                  {getStatusBadge(ecriture.statut)}
                </div>
                <Button size="sm" variant="ghost">
                  <Eye className="h-4 w-4 mr-1" />
                  Détail
                </Button>
              </div>
              <p className="text-sm mt-1">{ecriture.libelle}</p>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">N° Compte</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Libellé</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Débit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Crédit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ecriture.lignes.map((ligne, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-mono">{ligne.numero_compte}</td>
                      <td className="px-4 py-2 text-sm">{ligne.libelle_compte}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        {ligne.debit > 0 ? formatCurrency(ligne.debit) : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        {ligne.credit > 0 ? formatCurrency(ligne.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-sm font-bold">Total</td>
                    <td className="px-4 py-2 text-sm text-right font-bold">{formatCurrency(ecriture.total_debit)}</td>
                    <td className="px-4 py-2 text-sm text-right font-bold">{formatCurrency(ecriture.total_credit)}</td>
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
