import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Wallet,
  Receipt,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { transactionsApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

const depositSchema = z.object({
  accountId: z.string().min(1, 'Numéro de compte requis'),
  amount: z.string().min(1, 'Montant requis'),
  description: z.string().optional(),
});

const withdrawSchema = z.object({
  accountId: z.string().min(1, 'Numéro de compte requis'),
  amount: z.string().min(1, 'Montant requis'),
  description: z.string().optional(),
});

const transferSchema = z.object({
  fromAccountId: z.string().min(1, 'Compte source requis'),
  toAccountId: z.string().min(1, 'Compte destination requis'),
  amount: z.string().min(1, 'Montant requis'),
  description: z.string().optional(),
});

type TransactionType = 'deposit' | 'withdraw' | 'transfer';

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<TransactionType>('deposit');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);
  const [transactionResult, setTransactionResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

  const queryClient = useQueryClient();

  const depositForm = useForm({
    resolver: zodResolver(depositSchema),
    defaultValues: { accountId: '', amount: '', description: '' },
  });

  const withdrawForm = useForm({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { accountId: '', amount: '', description: '' },
  });

  const transferForm = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: '', description: '' },
  });

  const depositMutation = useMutation({
    mutationFn: (data: any) => transactionsApi.deposit(data),
    onSuccess: (response) => {
      setTransactionResult({
        success: true,
        message: 'Dépôt effectué avec succès',
        data: response.data,
      });
      depositForm.reset();
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      setTransactionResult({
        success: false,
        message: error.response?.data?.message || 'Erreur lors du dépôt',
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: any) => transactionsApi.withdraw(data),
    onSuccess: (response) => {
      setTransactionResult({
        success: true,
        message: 'Retrait effectué avec succès',
        data: response.data,
      });
      withdrawForm.reset();
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      setTransactionResult({
        success: false,
        message: error.response?.data?.message || 'Erreur lors du retrait',
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (data: any) => transactionsApi.transfer(data),
    onSuccess: (response) => {
      setTransactionResult({
        success: true,
        message: 'Virement effectué avec succès',
        data: response.data,
      });
      transferForm.reset();
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      setTransactionResult({
        success: false,
        message: error.response?.data?.message || 'Erreur lors du virement',
      });
    },
  });

  const handleSubmit = (type: TransactionType, data: any) => {
    const amount = parseFloat(data.amount.replace(/\s/g, ''));
    const transaction = { ...data, amount, type };
    setPendingTransaction(transaction);
    setShowConfirmDialog(true);
  };

  const confirmTransaction = () => {
    if (!pendingTransaction) return;

    const { type, ...data } = pendingTransaction;

    switch (type) {
      case 'deposit':
        depositMutation.mutate({
          accountNumber: data.accountId, // accountId field contains the account number string
          amount: data.amount,
          description: data.description,
        });
        break;
      case 'withdraw':
        withdrawMutation.mutate({
          accountNumber: data.accountId,
          amount: data.amount,
          description: data.description,
        });
        break;
      case 'transfer':
        transferMutation.mutate({
          fromAccountNumber: data.fromAccountId,
          toAccountNumber: data.toAccountId,
          amount: data.amount,
          description: data.description,
        });
        break;
    }
    setShowConfirmDialog(false);
  };

  const isLoading =
    depositMutation.isPending || withdrawMutation.isPending || transferMutation.isPending;

  const tabs = [
    {
      id: 'deposit' as TransactionType,
      label: 'Dépôt',
      icon: ArrowDownCircle,
      color: 'bg-green-500',
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      id: 'withdraw' as TransactionType,
      label: 'Retrait',
      icon: ArrowUpCircle,
      color: 'bg-red-500',
      gradient: 'from-red-500 to-rose-600',
    },
    {
      id: 'transfer' as TransactionType,
      label: 'Virement',
      icon: ArrowRightLeft,
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-indigo-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-500">Effectuez des opérations sur les comptes</p>
      </div>

      {/* Transaction Type Selector */}
      <div className="grid gap-4 sm:grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative p-6 rounded-2xl text-left transition-all duration-300',
                isActive
                  ? `bg-gradient-to-br ${tab.gradient} text-white shadow-lg scale-[1.02]`
                  : 'bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-md'
              )}
              whileHover={{ scale: isActive ? 1.02 : 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'p-3 rounded-xl',
                    isActive ? 'bg-white/20' : `${tab.color} bg-opacity-10`
                  )}
                >
                  <Icon
                    className={cn('h-6 w-6', isActive ? 'text-white' : tab.color.replace('bg-', 'text-'))}
                  />
                </div>
                <div>
                  <p className={cn('font-semibold text-lg', !isActive && 'text-gray-900')}>
                    {tab.label}
                  </p>
                  <p className={cn('text-sm', isActive ? 'text-white/80' : 'text-gray-500')}>
                    {tab.id === 'deposit' && "Ajouter de l'argent"}
                    {tab.id === 'withdraw' && "Retirer de l'argent"}
                    {tab.id === 'transfer' && 'Transférer entre comptes'}
                  </p>
                </div>
              </div>
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute inset-0 rounded-2xl border-2 border-white/30"
                  initial={false}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Transaction Result */}
      <AnimatePresence>
        {transactionResult && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card
              className={cn(
                'border-2',
                transactionResult.success
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {transactionResult.success ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <div className="flex-1">
                    <p
                      className={cn(
                        'font-medium',
                        transactionResult.success ? 'text-green-800' : 'text-red-800'
                      )}
                    >
                      {transactionResult.message}
                    </p>
                    {transactionResult.data?.newBalance && (
                      <p className="text-sm text-green-600">
                        Nouveau solde: {formatCurrency(transactionResult.data.newBalance)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTransactionResult(null)}
                  >
                    Fermer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeTab === 'deposit' && <ArrowDownCircle className="h-5 w-5 text-green-500" />}
              {activeTab === 'withdraw' && <ArrowUpCircle className="h-5 w-5 text-red-500" />}
              {activeTab === 'transfer' && <ArrowRightLeft className="h-5 w-5 text-blue-500" />}
              {activeTab === 'deposit' && 'Effectuer un dépôt'}
              {activeTab === 'withdraw' && 'Effectuer un retrait'}
              {activeTab === 'transfer' && 'Effectuer un virement'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'deposit' && 'Déposez de l\'argent sur un compte client'}
              {activeTab === 'withdraw' && 'Retirez de l\'argent d\'un compte client'}
              {activeTab === 'transfer' && 'Transférez de l\'argent entre deux comptes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {/* Deposit Form */}
              {activeTab === 'deposit' && (
                <motion.form
                  key="deposit"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={depositForm.handleSubmit((data) => handleSubmit('deposit', data))}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Numéro de compte</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        {...depositForm.register('accountId')}
                        placeholder="Entrez le numéro de compte"
                        className="pl-10"
                      />
                    </div>
                    {depositForm.formState.errors.accountId && (
                      <p className="text-sm text-red-500">
                        {depositForm.formState.errors.accountId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Montant (FCFA)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        FCFA
                      </span>
                      <Input
                        {...depositForm.register('amount')}
                        placeholder="0"
                        className="pl-16 text-right text-xl font-semibold"
                      />
                    </div>
                    {depositForm.formState.errors.amount && (
                      <p className="text-sm text-red-500">
                        {depositForm.formState.errors.amount.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Description (optionnel)
                    </label>
                    <Input
                      {...depositForm.register('description')}
                      placeholder="Ex: Dépôt espèces guichet"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 mr-2" />
                    )}
                    Valider le dépôt
                  </Button>
                </motion.form>
              )}

              {/* Withdraw Form */}
              {activeTab === 'withdraw' && (
                <motion.form
                  key="withdraw"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={withdrawForm.handleSubmit((data) => handleSubmit('withdraw', data))}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Numéro de compte</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        {...withdrawForm.register('accountId')}
                        placeholder="Entrez le numéro de compte"
                        className="pl-10"
                      />
                    </div>
                    {withdrawForm.formState.errors.accountId && (
                      <p className="text-sm text-red-500">
                        {withdrawForm.formState.errors.accountId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Montant (FCFA)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        FCFA
                      </span>
                      <Input
                        {...withdrawForm.register('amount')}
                        placeholder="0"
                        className="pl-16 text-right text-xl font-semibold"
                      />
                    </div>
                    {withdrawForm.formState.errors.amount && (
                      <p className="text-sm text-red-500">
                        {withdrawForm.formState.errors.amount.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Description (optionnel)
                    </label>
                    <Input
                      {...withdrawForm.register('description')}
                      placeholder="Ex: Retrait guichet"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 mr-2" />
                    )}
                    Valider le retrait
                  </Button>
                </motion.form>
              )}

              {/* Transfer Form */}
              {activeTab === 'transfer' && (
                <motion.form
                  key="transfer"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={transferForm.handleSubmit((data) => handleSubmit('transfer', data))}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Compte source</label>
                    <Input
                      {...transferForm.register('fromAccountId')}
                      placeholder="Numéro du compte débiteur"
                    />
                    {transferForm.formState.errors.fromAccountId && (
                      <p className="text-sm text-red-500">
                        {transferForm.formState.errors.fromAccountId.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <ArrowRightLeft className="h-5 w-5 text-gray-400 rotate-90" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Compte destination</label>
                    <Input
                      {...transferForm.register('toAccountId')}
                      placeholder="Numéro du compte créditeur"
                    />
                    {transferForm.formState.errors.toAccountId && (
                      <p className="text-sm text-red-500">
                        {transferForm.formState.errors.toAccountId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Montant (FCFA)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        FCFA
                      </span>
                      <Input
                        {...transferForm.register('amount')}
                        placeholder="0"
                        className="pl-16 text-right text-xl font-semibold"
                      />
                    </div>
                    {transferForm.formState.errors.amount && (
                      <p className="text-sm text-red-500">
                        {transferForm.formState.errors.amount.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Description (optionnel)
                    </label>
                    <Input
                      {...transferForm.register('description')}
                      placeholder="Ex: Virement interne"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                    )}
                    Valider le virement
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Quick Actions / Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-gray-500" />
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Button variant="outline" className="justify-start gap-3 h-auto py-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ArrowDownCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Dépôt multiple</p>
                  <p className="text-sm text-gray-500">Déposer sur plusieurs comptes</p>
                </div>
              </Button>

              <Button variant="outline" className="justify-start gap-3 h-auto py-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Virement de masse</p>
                  <p className="text-sm text-gray-500">Importer un fichier de virements</p>
                </div>
              </Button>

              <Button variant="outline" className="justify-start gap-3 h-auto py-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Wallet className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Consulter un solde</p>
                  <p className="text-sm text-gray-500">Vérifier le solde d'un compte</p>
                </div>
              </Button>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-gray-900 mb-3">Transactions récentes</h4>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-full',
                        i % 2 === 0 ? 'bg-green-100' : 'bg-red-100'
                      )}>
                        {i % 2 === 0 ? (
                          <ArrowDownCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {i % 2 === 0 ? 'Dépôt' : 'Retrait'}
                        </p>
                        <p className="text-xs text-gray-500">Il y a {i * 5} min</p>
                      </div>
                    </div>
                    <p className={cn(
                      'font-semibold tabular-nums',
                      i % 2 === 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {i % 2 === 0 ? '+' : '-'}{formatCurrency(150000 * i)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la transaction</DialogTitle>
            <DialogDescription>
              Veuillez vérifier les détails avant de confirmer
            </DialogDescription>
          </DialogHeader>
          {pendingTransaction && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Type</span>
                <Badge>
                  {pendingTransaction.type === 'deposit' && 'Dépôt'}
                  {pendingTransaction.type === 'withdraw' && 'Retrait'}
                  {pendingTransaction.type === 'transfer' && 'Virement'}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Montant</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(pendingTransaction.amount)}
                </span>
              </div>
              {pendingTransaction.type === 'transfer' ? (
                <>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">De</span>
                    <span className="font-mono">{pendingTransaction.fromAccountId}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Vers</span>
                    <span className="font-mono">{pendingTransaction.toAccountId}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Compte</span>
                  <span className="font-mono">{pendingTransaction.accountId}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Annuler
            </Button>
            <Button onClick={confirmTransaction} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
