import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  CheckCircle,
  XCircle,
  Banknote,
  Coins,
  FileText,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { caisseApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Valeurs des billets et pièces (Franc Burundais - BIF)
const BILLETS_BIF = [
  { key: 'billets_10000', value: 10000, label: '10 000 BIF' },
  { key: 'billets_5000', value: 5000, label: '5 000 BIF' },
  { key: 'billets_2000', value: 2000, label: '2 000 BIF' },
  { key: 'billets_1000', value: 1000, label: '1 000 BIF' },
  { key: 'billets_500', value: 500, label: '500 BIF' },
  { key: 'billets_100', value: 100, label: '100 BIF' },
  { key: 'billets_50', value: 50, label: '50 BIF' },
  { key: 'billets_20', value: 20, label: '20 BIF' },
  { key: 'billets_10', value: 10, label: '10 BIF' },
];

const PIECES_BIF = [
  { key: 'pieces_50', value: 50, label: '50 BIF' },
  { key: 'pieces_10', value: 10, label: '10 BIF' },
  { key: 'pieces_5', value: 5, label: '5 BIF' },
  { key: 'pieces_1', value: 1, label: '1 BIF' },
];

const BILLETS_USD = [
  { key: 'billets_100_usd', value: 100, label: '100 $' },
  { key: 'billets_50_usd', value: 50, label: '50 $' },
  { key: 'billets_20_usd', value: 20, label: '20 $' },
  { key: 'billets_10_usd', value: 10, label: '10 $' },
  { key: 'billets_5_usd', value: 5, label: '5 $' },
  { key: 'billets_1_usd', value: 1, label: '1 $' },
];

// Composant de décompte
function DecompteForm({
  values,
  onChange,
  readOnly = false,
}: {
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  readOnly?: boolean;
}) {
  const calculateTotal = (items: typeof BILLETS_BIF) => {
    return items.reduce((sum, item) => sum + (values[item.key] || 0) * item.value, 0);
  };

  const totalBilletsBIF = calculateTotal(BILLETS_BIF);
  const totalPiecesBIF = calculateTotal(PIECES_BIF);
  const totalUSD = calculateTotal(BILLETS_USD);
  const totalBIF = totalBilletsBIF + totalPiecesBIF;

  return (
    <div className="space-y-6">
      {/* Billets BIF */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Banknote className="h-5 w-5 text-green-600" />
          <h4 className="font-medium">Billets BIF</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BILLETS_BIF.map((item) => (
            <div key={item.key} className="space-y-1">
              <Label className="text-xs text-gray-500">{item.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={values[item.key] || 0}
                  onChange={(e) => onChange(item.key, parseInt(e.target.value) || 0)}
                  disabled={readOnly}
                  className="h-9"
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  = {formatCurrency((values[item.key] || 0) * item.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-sm font-medium text-green-600">
          Sous-total billets: {formatCurrency(totalBilletsBIF)}
        </div>
      </div>

      {/* Pièces BIF */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-5 w-5 text-amber-600" />
          <h4 className="font-medium">Pièces BIF</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {PIECES_BIF.map((item) => (
            <div key={item.key} className="space-y-1">
              <Label className="text-xs text-gray-500">{item.label}</Label>
              <Input
                type="number"
                min="0"
                value={values[item.key] || 0}
                onChange={(e) => onChange(item.key, parseInt(e.target.value) || 0)}
                disabled={readOnly}
                className="h-9"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-sm font-medium text-amber-600">
          Sous-total pièces: {formatCurrency(totalPiecesBIF)}
        </div>
      </div>

      {/* Billets USD */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Banknote className="h-5 w-5 text-blue-600" />
          <h4 className="font-medium">Billets USD</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {BILLETS_USD.map((item) => (
            <div key={item.key} className="space-y-1">
              <Label className="text-xs text-gray-500">{item.label}</Label>
              <Input
                type="number"
                min="0"
                value={values[item.key] || 0}
                onChange={(e) => onChange(item.key, parseInt(e.target.value) || 0)}
                disabled={readOnly}
                className="h-9"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-sm font-medium text-blue-600">
          Sous-total USD: ${totalUSD.toLocaleString()}
        </div>
      </div>

      {/* Totaux */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-medium">Total BIF</span>
          <span className="text-xl font-bold text-green-600">{formatCurrency(totalBIF)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium">Total USD</span>
          <span className="text-xl font-bold text-blue-600">${totalUSD.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// Composant principal
export default function CaissePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState<'ouvrir' | 'fermer' | 'approv' | 'reverse' | null>(null);
  const [decompte, setDecompte] = useState<Record<string, number>>({});
  const [montant, setMontant] = useState<number>(0);
  const [commentaire, setCommentaire] = useState('');

  // Récupérer la session actuelle
  const { data: sessionData, isLoading: sessionLoading, refetch: refetchSession } = useQuery({
    queryKey: ['caisse-session'],
    queryFn: () => caisseApi.getCurrentSession().then((r) => r.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Récupérer le brouillard
  const { data: brouillard } = useQuery({
    queryKey: ['caisse-brouillard'],
    queryFn: () => caisseApi.getBrouillard().then((r) => r.data),
    enabled: sessionData?.hasSession,
  });

  // Mutation: Ouvrir la caisse
  const ouvrirMutation = useMutation({
    mutationFn: (decompte: any) => caisseApi.ouvrirCaisse(decompte),
    onSuccess: () => {
      toast({ title: 'Caisse ouverte avec succès' });
      setOpenDialog(null);
      setDecompte({});
      queryClient.invalidateQueries({ queryKey: ['caisse-session'] });
      queryClient.invalidateQueries({ queryKey: ['caisse-brouillard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Erreur lors de l\'ouverture',
        variant: 'destructive',
      });
    },
  });

  // Mutation: Fermer la caisse
  const fermerMutation = useMutation({
    mutationFn: (decompte: any) => caisseApi.fermerCaisse(decompte),
    onSuccess: (data) => {
      const ecart = data.data.ecart;
      toast({
        title: 'Caisse fermée avec succès',
        description: ecart !== 0 ? `Attention: Écart de ${formatCurrency(ecart)}` : 'Aucun écart',
        variant: ecart !== 0 ? 'destructive' : 'default',
      });
      setOpenDialog(null);
      setDecompte({});
      queryClient.invalidateQueries({ queryKey: ['caisse-session'] });
      queryClient.invalidateQueries({ queryKey: ['caisse-brouillard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Erreur lors de la fermeture',
        variant: 'destructive',
      });
    },
  });

  // Mutation: Approvisionnement
  const approvMutation = useMutation({
    mutationFn: (data: any) => caisseApi.demanderApprovisionnement(data),
    onSuccess: () => {
      toast({ title: 'Demande d\'approvisionnement envoyée' });
      setOpenDialog(null);
      setDecompte({});
      setMontant(0);
      setCommentaire('');
      queryClient.invalidateQueries({ queryKey: ['caisse-session'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Erreur lors de la demande',
        variant: 'destructive',
      });
    },
  });

  // Mutation: Reversement
  const reverseMutation = useMutation({
    mutationFn: (data: any) => caisseApi.demanderReversement(data),
    onSuccess: () => {
      toast({ title: 'Demande de reversement envoyée' });
      setOpenDialog(null);
      setDecompte({});
      setMontant(0);
      setCommentaire('');
      queryClient.invalidateQueries({ queryKey: ['caisse-session'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Erreur lors de la demande',
        variant: 'destructive',
      });
    },
  });

  const handleDecompteChange = (key: string, value: number) => {
    setDecompte((prev) => ({ ...prev, [key]: value }));
  };

  const calculateDecompteTotal = () => {
    let total = 0;
    BILLETS_BIF.forEach((item) => {
      total += (decompte[item.key] || 0) * item.value;
    });
    PIECES_BIF.forEach((item) => {
      total += (decompte[item.key] || 0) * item.value;
    });
    return total;
  };

  const session = sessionData?.session;
  const hasOpenSession = sessionData?.hasSession && session?.etat === 1;

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion de Caisse</h1>
          <p className="text-gray-500">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchSession()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* État de la caisse */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className={`border-2 ${hasOpenSession ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${hasOpenSession ? 'bg-green-500' : 'bg-gray-400'}`}>
                  <Wallet className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {hasOpenSession ? 'Caisse Ouverte' : 'Caisse Fermée'}
                  </h2>
                  {hasOpenSession && session && (
                    <p className="text-gray-600">
                      Ouverte à {new Date(session.heure_ouverture).toLocaleTimeString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                {!hasOpenSession ? (
                  <Dialog open={openDialog === 'ouvrir'} onOpenChange={(open) => setOpenDialog(open ? 'ouvrir' : null)}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="bg-green-600 hover:bg-green-700">
                        <ArrowDownCircle className="h-5 w-5 mr-2" />
                        Ouvrir la Caisse
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Ouverture de Caisse</DialogTitle>
                        <DialogDescription>
                          Comptez les billets et pièces reçus de la caisse principale
                        </DialogDescription>
                      </DialogHeader>
                      <DecompteForm values={decompte} onChange={handleDecompteChange} />
                      <div className="mt-4">
                        <Label>Commentaire (optionnel)</Label>
                        <Textarea
                          value={commentaire}
                          onChange={(e) => setCommentaire(e.target.value)}
                          placeholder="Notes sur l'ouverture..."
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenDialog(null)}>
                          Annuler
                        </Button>
                        <Button
                          onClick={() => ouvrirMutation.mutate({ ...decompte, commentaire })}
                          disabled={ouvrirMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {ouvrirMutation.isPending ? 'Ouverture...' : 'Confirmer l\'ouverture'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <>
                    <Dialog open={openDialog === 'approv'} onOpenChange={(open) => setOpenDialog(open ? 'approv' : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <ArrowDownCircle className="h-4 w-4 mr-2 text-green-600" />
                          Approvisionnement
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Demander un Approvisionnement</DialogTitle>
                          <DialogDescription>
                            Demander des fonds à la caisse principale
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Montant (CDF)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={montant}
                              onChange={(e) => setMontant(parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label>Commentaire</Label>
                            <Textarea
                              value={commentaire}
                              onChange={(e) => setCommentaire(e.target.value)}
                              placeholder="Motif de l'approvisionnement..."
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpenDialog(null)}>
                            Annuler
                          </Button>
                          <Button
                            onClick={() => approvMutation.mutate({ montant, commentaire })}
                            disabled={approvMutation.isPending || montant <= 0}
                          >
                            Demander
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={openDialog === 'reverse'} onOpenChange={(open) => setOpenDialog(open ? 'reverse' : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <ArrowUpCircle className="h-4 w-4 mr-2 text-amber-600" />
                          Reversement
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Demander un Reversement</DialogTitle>
                          <DialogDescription>
                            Reverser des fonds à la caisse principale (décompte obligatoire)
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Montant à reverser (CDF)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={montant}
                              onChange={(e) => setMontant(parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                            {montant > 0 && calculateDecompteTotal() !== montant && (
                              <p className="text-sm text-red-500 mt-1">
                                Le décompte ({formatCurrency(calculateDecompteTotal())}) ne correspond pas au montant
                              </p>
                            )}
                          </div>
                          <DecompteForm values={decompte} onChange={handleDecompteChange} />
                          <div>
                            <Label>Commentaire</Label>
                            <Textarea
                              value={commentaire}
                              onChange={(e) => setCommentaire(e.target.value)}
                              placeholder="Motif du reversement..."
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpenDialog(null)}>
                            Annuler
                          </Button>
                          <Button
                            onClick={() => reverseMutation.mutate({ montant, decompte, commentaire })}
                            disabled={reverseMutation.isPending || montant <= 0 || calculateDecompteTotal() !== montant}
                          >
                            Demander le reversement
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={openDialog === 'fermer'} onOpenChange={(open) => setOpenDialog(open ? 'fermer' : null)}>
                      <DialogTrigger asChild>
                        <Button variant="destructive">
                          <XCircle className="h-4 w-4 mr-2" />
                          Fermer la Caisse
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Fermeture de Caisse</DialogTitle>
                          <DialogDescription>
                            Comptez tous les billets et pièces en votre possession
                          </DialogDescription>
                        </DialogHeader>

                        {session && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <h4 className="font-medium text-blue-800 mb-2">Solde théorique</h4>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Ouverture:</span>
                                <span className="ml-2 font-medium">{formatCurrency(session.montant_ouverture)}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Entrées:</span>
                                <span className="ml-2 font-medium text-green-600">+{formatCurrency(session.total_entrees)}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Sorties:</span>
                                <span className="ml-2 font-medium text-red-600">-{formatCurrency(session.total_sorties)}</span>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-blue-200">
                              <span className="text-gray-600">Solde attendu:</span>
                              <span className="ml-2 font-bold text-lg">{formatCurrency(session.solde_theorique)}</span>
                            </div>
                          </div>
                        )}

                        <DecompteForm values={decompte} onChange={handleDecompteChange} />

                        {session && calculateDecompteTotal() !== session.solde_theorique && calculateDecompteTotal() > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            <div>
                              <p className="font-medium text-amber-800">Écart détecté</p>
                              <p className="text-sm text-amber-700">
                                Différence: {formatCurrency(calculateDecompteTotal() - session.solde_theorique)}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="mt-4">
                          <Label>Commentaire sur l'écart (si applicable)</Label>
                          <Textarea
                            value={commentaire}
                            onChange={(e) => setCommentaire(e.target.value)}
                            placeholder="Expliquez l'écart si nécessaire..."
                          />
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpenDialog(null)}>
                            Annuler
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => fermerMutation.mutate({ ...decompte, commentaire })}
                            disabled={fermerMutation.isPending}
                          >
                            {fermerMutation.isPending ? 'Fermeture...' : 'Confirmer la fermeture'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </div>

            {/* Statistiques de la session */}
            {hasOpenSession && session && (
              <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Fond de caisse</p>
                  <p className="text-xl font-bold">{formatCurrency(session.montant_ouverture)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Entrées</p>
                  <p className="text-xl font-bold text-green-600">+{formatCurrency(session.total_entrees)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Sorties</p>
                  <p className="text-xl font-bold text-red-600">-{formatCurrency(session.total_sorties)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Solde actuel</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(session.solde_theorique)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs pour brouillard et mouvements */}
      {hasOpenSession && brouillard && (
        <Tabs defaultValue="brouillard" className="w-full">
          <TabsList>
            <TabsTrigger value="brouillard">
              <FileText className="h-4 w-4 mr-2" />
              Brouillard
            </TabsTrigger>
            <TabsTrigger value="mouvements">
              <Clock className="h-4 w-4 mr-2" />
              Mouvements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brouillard" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Brouillard de Caisse</CardTitle>
                <CardDescription>Récapitulatif des opérations du jour</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Ouverture</p>
                      <p className="text-lg font-bold">{formatCurrency(brouillard.montant_ouverture)}</p>
                      <p className="text-xs text-gray-400">
                        {brouillard.heure_ouverture && new Date(brouillard.heure_ouverture).toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600">Entrées</p>
                      <p className="text-lg font-bold text-green-700">+{formatCurrency(brouillard.total_entrees)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-red-600">Sorties</p>
                      <p className="text-lg font-bold text-red-700">-{formatCurrency(brouillard.total_sorties)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600">Solde</p>
                      <p className="text-lg font-bold text-blue-700">{formatCurrency(brouillard.solde_actuel)}</p>
                    </div>
                  </div>

                  <div className="text-center text-gray-500 py-4">
                    {brouillard.nombre_operations} opération(s) aujourd'hui
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mouvements" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Mouvements du Jour</CardTitle>
                <CardDescription>Approvisionnements et reversements</CardDescription>
              </CardHeader>
              <CardContent>
                {brouillard.mouvements && brouillard.mouvements.length > 0 ? (
                  <div className="space-y-3">
                    {brouillard.mouvements.map((m: any) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {m.type_mouvement === 1 ? (
                            <ArrowDownCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <ArrowUpCircle className="h-5 w-5 text-amber-600" />
                          )}
                          <div>
                            <p className="font-medium">{m.type_label}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(m.created_at).toLocaleTimeString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${m.type_mouvement === 1 ? 'text-green-600' : 'text-amber-600'}`}>
                            {m.type_mouvement === 1 ? '+' : '-'}{formatCurrency(m.montant)}
                          </p>
                          <Badge variant={m.etat === 2 ? 'default' : 'secondary'}>
                            {m.etat === 2 ? 'Validé' : 'En attente'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Aucun mouvement aujourd'hui
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Message si caisse fermée */}
      {!hasOpenSession && sessionData?.hasSession && session?.etat === 2 && (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Caisse clôturée</h3>
            <p className="text-gray-500 mt-2">
              Fermeture à {session.heure_fermeture && new Date(session.heure_fermeture).toLocaleTimeString('fr-FR')}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div>
                <p className="text-sm text-gray-500">Montant final</p>
                <p className="font-bold">{formatCurrency(session.montant_fermeture)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Opérations</p>
                <p className="font-bold">{session.nombre_operations}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Écart</p>
                <p className={`font-bold ${session.ecart !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(session.ecart || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
