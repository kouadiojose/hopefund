import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Send,
  Download,
  Filter,
  Plus,
  Check,
  X,
  Clock,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';
import { toast } from 'sonner';

interface Virement {
  id: number;
  date: string;
  reference: string;
  compte_source: string;
  compte_destination: string;
  montant: number;
  motif: string;
  statut: 'en_attente' | 'valide' | 'rejete';
  cree_par: string;
  valide_par?: string;
}

export default function VirementsPage() {
  const [newVirementOpen, setNewVirementOpen] = useState(false);
  const [statut, setStatut] = useState('all');

  // Sample data
  const virements: Virement[] = [
    {
      id: 1,
      date: '2024-01-15',
      reference: 'VIR-2024-0001',
      compte_source: 'COFFRE FORT SIEGE',
      compte_destination: 'BGF 800/001/50/12005/2/62',
      montant: 50000000,
      motif: 'Alimentation compte bancaire',
      statut: 'valide',
      cree_par: 'Admin Comptable',
      valide_par: 'Directeur',
    },
    {
      id: 2,
      date: '2024-01-16',
      reference: 'VIR-2024-0002',
      compte_source: 'COFFRE FORT MAKAMBA',
      compte_destination: 'COFFRE FORT SIEGE',
      montant: 10000000,
      motif: 'Transfert inter-agence',
      statut: 'valide',
      cree_par: 'Chef Agence Makamba',
      valide_par: 'Directeur',
    },
    {
      id: 3,
      date: '2024-01-17',
      reference: 'VIR-2024-0003',
      compte_source: 'IBB 701-4122318-35',
      compte_destination: 'COFFRE FORT KAMENGE',
      montant: 20000000,
      motif: 'Approvisionnement agence',
      statut: 'en_attente',
      cree_par: 'Comptable',
    },
  ];

  const filteredVirements = statut === 'all'
    ? virements
    : virements.filter((v) => v.statut === statut);

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'valide':
        return <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" /> Validé</Badge>;
      case 'en_attente':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" /> En attente</Badge>;
      case 'rejete':
        return <Badge className="bg-red-100 text-red-800"><X className="h-3 w-3 mr-1" /> Rejeté</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Send className="h-6 w-6" />
            Virements
          </h1>
          <p className="text-gray-500">Gestion des virements entre comptes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </Button>
          <Button onClick={() => setNewVirementOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau virement
          </Button>
        </div>
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
              <Label>Statut</Label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="valide">Validé</SelectItem>
                  <SelectItem value="rejete">Rejeté</SelectItem>
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

      {/* Virements Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Référence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Destination</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredVirements.map((virement) => (
                <tr key={virement.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{formatDate(virement.date)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-medium">{virement.reference}</td>
                  <td className="px-4 py-3 text-sm">{virement.compte_source}</td>
                  <td className="px-4 py-3 text-sm">{virement.compte_destination}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(virement.montant)}</td>
                  <td className="px-4 py-3">{getStatusBadge(virement.statut)}</td>
                  <td className="px-4 py-3 text-right">
                    {virement.statut === 'en_attente' && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="text-green-600">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {virement.statut === 'valide' && (
                      <Button size="sm" variant="ghost">
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* New Virement Modal */}
      <Dialog open={newVirementOpen} onOpenChange={setNewVirementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau virement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Compte source</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coffre_siege">COFFRE FORT SIEGE</SelectItem>
                  <SelectItem value="coffre_makamba">COFFRE FORT MAKAMBA</SelectItem>
                  <SelectItem value="brb">B.R.B N° 1150/007</SelectItem>
                  <SelectItem value="bgf">BGF 800/001/50/12005/2/62</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Compte destination</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coffre_siege">COFFRE FORT SIEGE</SelectItem>
                  <SelectItem value="coffre_makamba">COFFRE FORT MAKAMBA</SelectItem>
                  <SelectItem value="brb">B.R.B N° 1150/007</SelectItem>
                  <SelectItem value="bgf">BGF 800/001/50/12005/2/62</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant (BIF)</Label>
              <Input type="number" placeholder="0" />
            </div>
            <div>
              <Label>Motif</Label>
              <Input placeholder="Raison du virement" />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setNewVirementOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => {
                toast.success('Virement créé avec succès');
                setNewVirementOpen(false);
              }}>
                Créer le virement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
