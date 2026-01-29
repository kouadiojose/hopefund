import { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  X,
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
import { toast } from 'sonner';

interface LigneEcriture {
  id: number;
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
}

const comptesDisponibles = [
  { numero: '1.0.1.1.1', libelle: 'COFFRE FORT SIEGE' },
  { numero: '1.0.1.2.1', libelle: 'COFFRE FORT MAKAMBA' },
  { numero: '1.0.1.3.1', libelle: 'COFFRE FORT GUICHET JABE' },
  { numero: '1.0.1.4.1', libelle: 'Coffre fort Kamenge' },
  { numero: '1.0.1.5.1', libelle: 'COFFRE FORT NYAZA LAC' },
  { numero: '1.1.1.1.1', libelle: 'B.R.B N° 1150/007' },
  { numero: '1.1.1.3.2.3', libelle: 'BGF 800/001/50/12005/2/62' },
  { numero: '2.1.1.1.6', libelle: 'Crédits CT Autres' },
  { numero: '2.2.1.1', libelle: 'Dépôts à vue des individus' },
  { numero: '3.1.8.8', libelle: 'autres debiteurs divers' },
  { numero: '3.3.1.1', libelle: 'INSS Part Patronale' },
  { numero: '3.3.2.1', libelle: 'Impot sur salaire' },
  { numero: '3.4.6', libelle: 'REGULARISATION DIVERSES' },
  { numero: '6.5.1.1.1.1', libelle: 'Salaires du personnel' },
  { numero: '7.0.2.1', libelle: 'Intérêts perçus sur crédits C.T' },
];

export default function EcrituresManuelsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [libelle, setLibelle] = useState('');
  const [journal, setJournal] = useState('OD');
  const [lignes, setLignes] = useState<LigneEcriture[]>([
    { id: 1, compte: '', libelle: '', debit: 0, credit: 0 },
    { id: 2, compte: '', libelle: '', debit: 0, credit: 0 },
  ]);

  const totalDebit = lignes.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lignes.reduce((sum, l) => sum + l.credit, 0);
  const isEquilibre = totalDebit === totalCredit && totalDebit > 0;

  const addLigne = () => {
    const newId = Math.max(...lignes.map((l) => l.id)) + 1;
    setLignes([...lignes, { id: newId, compte: '', libelle: '', debit: 0, credit: 0 }]);
  };

  const removeLigne = (id: number) => {
    if (lignes.length > 2) {
      setLignes(lignes.filter((l) => l.id !== id));
    }
  };

  const updateLigne = (id: number, field: keyof LigneEcriture, value: string | number) => {
    setLignes(
      lignes.map((l) => {
        if (l.id === id) {
          if (field === 'compte') {
            const compte = comptesDisponibles.find((c) => c.numero === value);
            return { ...l, compte: value as string, libelle: compte?.libelle || '' };
          }
          return { ...l, [field]: value };
        }
        return l;
      })
    );
  };

  const handleSave = () => {
    if (!libelle) {
      toast.error('Veuillez saisir un libellé');
      return;
    }
    if (!isEquilibre) {
      toast.error('L\'écriture n\'est pas équilibrée');
      return;
    }
    toast.success('Écriture enregistrée avec succès');
    // Reset form
    setLibelle('');
    setLignes([
      { id: 1, compte: '', libelle: '', debit: 0, credit: 0 },
      { id: 2, compte: '', libelle: '', debit: 0, credit: 0 },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Écritures Manuelles
          </h1>
          <p className="text-gray-500">Saisie d'écritures comptables manuelles</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle écriture comptable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Journal</Label>
              <Select value={journal} onValueChange={setJournal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OD">OD - Opérations Diverses</SelectItem>
                  <SelectItem value="CA">CA - Caisse</SelectItem>
                  <SelectItem value="BQ">BQ - Banque</SelectItem>
                  <SelectItem value="CR">CR - Crédits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Libellé de l'écriture</Label>
              <Input
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Description de l'opération"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Lignes d'écriture</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLigne}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une ligne
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-1/3">Compte</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Libellé</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 w-32">Débit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 w-32">Crédit</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lignes.map((ligne) => (
                    <tr key={ligne.id}>
                      <td className="px-2 py-2">
                        <Select
                          value={ligne.compte}
                          onValueChange={(v) => updateLigne(ligne.id, 'compte', v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner un compte" />
                          </SelectTrigger>
                          <SelectContent>
                            {comptesDisponibles.map((c) => (
                              <SelectItem key={c.numero} value={c.numero}>
                                {c.numero} - {c.libelle}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={ligne.libelle}
                          onChange={(e) => updateLigne(ligne.id, 'libelle', e.target.value)}
                          placeholder="Libellé"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          value={ligne.debit || ''}
                          onChange={(e) => updateLigne(ligne.id, 'debit', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="text-right"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          value={ligne.credit || ''}
                          onChange={(e) => updateLigne(ligne.id, 'credit', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="text-right"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLigne(ligne.id)}
                          disabled={lignes.length <= 2}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold">TOTAUX</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(totalDebit)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(totalCredit)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Balance indicator */}
            <div className={`p-3 rounded-lg ${isEquilibre ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {isEquilibre ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Écriture équilibrée
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Écart: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline">
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!isEquilibre}>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
