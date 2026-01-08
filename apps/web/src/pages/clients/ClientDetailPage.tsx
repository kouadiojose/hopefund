import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Wallet,
  FileText,
  Edit,
  CreditCard,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { clientsApi } from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: clientData, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const response = await clientsApi.getById(Number(id));
      return response.data;
    },
    enabled: !!id,
  });

  const client = clientData?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hopefund-600"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Client non trouvé</p>
        <Button variant="outline" onClick={() => navigate('/clients')} className="mt-4">
          Retour à la liste
        </Button>
      </div>
    );
  }

  const accounts = client.comptes || [];
  const loans = client.dossiers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Fiche Client</h1>
          <p className="text-gray-500">Détails et informations du client</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Edit className="h-4 w-4" />
          Modifier
        </Button>
      </div>

      {/* Client Info Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar and Basic Info */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 bg-hopefund-100">
                  <AvatarFallback className="text-2xl text-hopefund-700">
                    {getInitials(client.pp_prenom, client.pp_nom)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {client.pp_prenom} {client.pp_nom}
                  </h2>
                  <p className="text-gray-500">Client #{client.id_client}</p>
                  <Badge variant="success" className="mt-2">
                    {client.etat_client === 1 ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </div>

              {/* Contact Info */}
              <div className="flex-1 grid gap-4 md:grid-cols-2">
                {client.pp_tel && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Phone className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Téléphone</p>
                      <p className="font-medium">{client.pp_tel}</p>
                    </div>
                  </div>
                )}

                {client.pp_email && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Mail className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{client.pp_email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Agence</p>
                    <p className="font-medium">Agence {client.id_ag}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Calendar className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date d'adhésion</p>
                    <p className="font-medium">{formatDate(client.date_adh)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Wallet className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Comptes</p>
                  <p className="text-2xl font-bold">{accounts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Épargne</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      accounts.reduce((sum: number, acc: any) => sum + Number(acc.solde || 0), 0)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Crédits</p>
                  <p className="text-2xl font-bold">{loans.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Accounts Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-500" />
              Comptes ({accounts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date ouverture</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account: any) => (
                    <TableRow
                      key={account.id_cpte}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/accounts/${account.id_cpte}`)}
                    >
                      <TableCell className="font-mono">{account.num_complet_cpte}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{account.type_compte || 'EP'}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(account.solde || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.etat_cpte === 1 ? 'success' : 'secondary'}>
                          {account.etat_cpte === 1 ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(account.date_ouvert)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-500 py-8">Aucun compte</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Loans Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500" />
              Dossiers de crédit ({loans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loans.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date demande</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan: any) => (
                    <TableRow
                      key={loan.id_doss}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/loans/${loan.id_doss}`)}
                    >
                      <TableCell className="font-mono">
                        DCR-{String(loan.id_doss).padStart(6, '0')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(loan.mnt_dem || 0)}
                      </TableCell>
                      <TableCell>{loan.duree_mois || 12} mois</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            loan.etat_doss === 3
                              ? 'success'
                              : loan.etat_doss === 1
                              ? 'warning'
                              : 'secondary'
                          }
                        >
                          {loan.etat_doss === 3 ? 'Décaissé' : loan.etat_doss === 1 ? 'En cours' : 'Autre'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(loan.date_dem)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-500 py-8">Aucun dossier de crédit</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
