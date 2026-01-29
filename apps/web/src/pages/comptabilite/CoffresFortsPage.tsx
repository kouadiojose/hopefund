import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ArrowRight,
  Edit,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';

interface Agence {
  id_ag: number;
  libel_ag: string;
  ville_ag?: string;
  coffre_fort: number;
}

export default function CoffresFortsPage() {
  const [search, setSearch] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<'banque_coffre' | 'coffre_coffre' | 'coffre_banque'>('banque_coffre');
  const [selectedAgence, setSelectedAgence] = useState<Agence | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: agences, isLoading } = useQuery({
    queryKey: ['coffres-forts'],
    queryFn: comptabiliteApi.getCoffresForts,
  });

  const totalCoffresForts = agences?.reduce((sum: number, a: Agence) => sum + (a.coffre_fort || 0), 0) || 0;

  const filteredAgences = agences?.filter((a: Agence) =>
    a.libel_ag?.toLowerCase().includes(search.toLowerCase()) ||
    a.ville_ag?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const transferMutation = useMutation({
    mutationFn: comptabiliteApi.createTransfert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coffres-forts'] });
      alert('Transfert effectué avec succès');
      setTransferModalOpen(false);
    },
    onError: (error: any) => {
      alert(error.message || 'Erreur lors du transfert');
    },
  });

  const openTransferModal = (type: 'banque_coffre' | 'coffre_coffre' | 'coffre_banque') => {
    setTransferType(type);
    setTransferModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">COFFRE FORT</h1>
          <p className="text-gray-500 text-sm">Tableau de bord / Coffres forts</p>
        </div>
      </div>

      {/* Transfer Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openTransferModal('banque_coffre')}>
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-lg mb-4">Transfert Banque vers Coffre fort</h3>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Commencer
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openTransferModal('coffre_coffre')}>
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-lg mb-4">Transfert Coffre fort vers Coffre fort</h3>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Commencer
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openTransferModal('coffre_banque')}>
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-lg mb-4">Transfert Coffre fort vers Banque</h3>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Commencer
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Total */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-bold">
          Total montant coffres Forts: {formatCurrency(totalCoffresForts)}
        </h2>
      </div>

      {/* Table Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={entriesPerPage.toString()} onValueChange={(v) => setEntriesPerPage(parseInt(v))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500">entries per page</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N°</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom Agence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coffre Fort</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ville Agence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : filteredAgences.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Aucune agence trouvée
                  </td>
                </tr>
              ) : (
                filteredAgences.slice(0, entriesPerPage).map((agence: Agence, index: number) => (
                  <tr key={agence.id_ag} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{agence.libel_ag}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(agence.coffre_fort || 0)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{agence.ville_ag || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600"
                          onClick={() => {
                            setSelectedAgence(agence);
                            openTransferModal('coffre_coffre');
                          }}
                        >
                          Transfert <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-cyan-500 text-cyan-500 hover:bg-cyan-50"
                          onClick={() => {
                            setSelectedAgence(agence);
                            setEditModalOpen(true);
                          }}
                        >
                          <Edit className="mr-1 h-4 w-4" /> Modifier
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="text-sm text-gray-500">
        Showing 1 to {Math.min(entriesPerPage, filteredAgences.length)} of {filteredAgences.length} entries
      </div>

      {/* Transfer Modal */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transferType === 'banque_coffre' && 'Transfert Banque vers Coffre Fort'}
              {transferType === 'coffre_coffre' && 'Transfert Coffre vers Coffre'}
              {transferType === 'coffre_banque' && 'Transfert Coffre vers Banque'}
            </DialogTitle>
          </DialogHeader>
          <TransferForm
            type={transferType}
            agences={agences || []}
            selectedAgence={selectedAgence}
            onSubmit={(data) => transferMutation.mutate(data)}
            onCancel={() => setTransferModalOpen(false)}
            isLoading={transferMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le coffre fort</DialogTitle>
          </DialogHeader>
          {selectedAgence && (
            <div className="space-y-4">
              <div>
                <Label>Agence</Label>
                <Input value={selectedAgence.libel_ag} disabled />
              </div>
              <div>
                <Label>Montant du coffre fort (BIF)</Label>
                <Input type="number" defaultValue={selectedAgence.coffre_fort} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={() => {
                  alert('Coffre fort mis à jour');
                  setEditModalOpen(false);
                }}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TransferFormProps {
  type: 'banque_coffre' | 'coffre_coffre' | 'coffre_banque';
  agences: Agence[];
  selectedAgence: Agence | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function TransferForm({ type, agences, selectedAgence, onSubmit, onCancel, isLoading }: TransferFormProps) {
  const [formData, setFormData] = useState({
    agence_source: selectedAgence?.id_ag?.toString() || '',
    agence_destination: '',
    montant: '',
    commentaire: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type,
      ...formData,
      montant: parseFloat(formData.montant),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {type === 'banque_coffre' && (
        <div>
          <Label>Agence destination</Label>
          <Select
            value={formData.agence_destination}
            onValueChange={(v) => setFormData({ ...formData, agence_destination: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une agence" />
            </SelectTrigger>
            <SelectContent>
              {agences.map((a) => (
                <SelectItem key={a.id_ag} value={a.id_ag.toString()}>
                  {a.libel_ag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {type === 'coffre_coffre' && (
        <>
          <div>
            <Label>Agence source</Label>
            <Select
              value={formData.agence_source}
              onValueChange={(v) => setFormData({ ...formData, agence_source: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une agence" />
              </SelectTrigger>
              <SelectContent>
                {agences.map((a) => (
                  <SelectItem key={a.id_ag} value={a.id_ag.toString()}>
                    {a.libel_ag} ({formatCurrency(a.coffre_fort || 0)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Agence destination</Label>
            <Select
              value={formData.agence_destination}
              onValueChange={(v) => setFormData({ ...formData, agence_destination: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une agence" />
              </SelectTrigger>
              <SelectContent>
                {agences.filter(a => a.id_ag.toString() !== formData.agence_source).map((a) => (
                  <SelectItem key={a.id_ag} value={a.id_ag.toString()}>
                    {a.libel_ag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {type === 'coffre_banque' && (
        <div>
          <Label>Agence source</Label>
          <Select
            value={formData.agence_source}
            onValueChange={(v) => setFormData({ ...formData, agence_source: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une agence" />
            </SelectTrigger>
            <SelectContent>
              {agences.map((a) => (
                <SelectItem key={a.id_ag} value={a.id_ag.toString()}>
                  {a.libel_ag} ({formatCurrency(a.coffre_fort || 0)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>Montant (BIF)</Label>
        <Input
          type="number"
          value={formData.montant}
          onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
          placeholder="0"
          required
        />
      </div>

      <div>
        <Label>Commentaire</Label>
        <Input
          value={formData.commentaire}
          onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
          placeholder="Optionnel"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Traitement...' : 'Valider'}
        </Button>
      </div>
    </form>
  );
}
