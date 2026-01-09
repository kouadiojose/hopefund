import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Wallet,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Building,
  Briefcase,
  FileText,
  Clock
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clientsApi } from '@/lib/api';
import {
  formatCurrency,
  formatDate,
  formatPercent,
  getAccountStatusColor,
  getCreditStatusColor,
  getClientStatusColor,
  getClientStatusLabel,
  getEcheanceStatusColor,
  getPersonTypeLabel,
  getSexeLabel,
  getEtatCivilLabel,
  getDaysOverdue,
} from '@/lib/utils';

interface ClientDetail {
  id_client: number;
  id_ag: number;
  statut_juridique: number;
  nom_complet: string;
  pp_nom: string | null;
  pp_prenom: string | null;
  pp_date_naissance: string | null;
  pp_lieu_naissance: string | null;
  pp_sexe: number | null;
  pp_etat_civil: number | null;
  pp_employeur: string | null;
  pp_fonction: string | null;
  pp_revenu: number;
  pm_raison_sociale: string | null;
  pm_nature_juridique: string | null;
  pm_numero_reg_nat: string | null;
  adresse: string | null;
  ville: string | null;
  num_tel: string | null;
  num_port: string | null;
  email: string | null;
  etat: number;
  date_adh: string | null;
  statistiques: {
    total_solde: number;
    total_bloques: number;
    solde_disponible: number;
    nombre_comptes: number;
    comptes_actifs: number;
    nombre_credits: number;
    credits_en_cours: number;
    capital_restant: number;
    montant_en_retard: number;
    echeances_en_retard: number;
  };
  comptes: Array<{
    id_cpte: number;
    num_complet_cpte: string;
    intitule_compte: string;
    solde: number;
    mnt_bloq: number;
    solde_disponible: number;
    devise: string;
    etat_cpte: number;
    etat_label: string;
    date_ouvert: string | null;
    tx_interet_cpte: number | null;
    dernieres_transactions: Array<{
      id: number;
      date: string;
      sens: string;
      montant: number;
      libelle: string;
      solde_apres: number;
    }>;
  }>;
  credits: Array<{
    id_doss: number;
    date_demande: string | null;
    montant_demande: number;
    montant_octroye: number;
    date_deblocage: string | null;
    duree_mois: number;
    taux_interet: number;
    etat: number;
    etat_label: string;
    capital_restant: number;
    interets_restants: number;
    total_restant: number;
    echeances_payees: number;
    echeances_restantes: number;
    echeances_en_retard: number;
    montant_en_retard: number;
    garanties: Array<{
      id: number;
      type: number;
      description: string;
      valeur: number;
    }>;
    echeancier: Array<{
      num_ech: number;
      date_ech: string;
      mnt_capital: number;
      mnt_interet: number;
      montant_total: number;
      solde_capital: number;
      solde_interet: number;
      solde_total: number;
      date_paiement: string | null;
      mnt_paye: number;
      etat: number;
      etat_label: string;
      en_retard: boolean;
    }>;
  }>;
  prochaines_echeances: Array<{
    id_doss: number;
    num_ech: number;
    date_ech: string;
    montant_total: number;
  }>;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCredits, setExpandedCredits] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchClient = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await clientsApi.getById(parseInt(id));
        setClient(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [id]);

  const toggleCreditExpand = (creditId: number) => {
    const newExpanded = new Set(expandedCredits);
    if (newExpanded.has(creditId)) {
      newExpanded.delete(creditId);
    } else {
      newExpanded.add(creditId);
    }
    setExpandedCredits(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">
          {error || 'Client non trouve'}
        </div>
        <Button onClick={() => navigate('/clients')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const stats = client.statistiques;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/clients')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{client.nom_complet}</h1>
            <p className="text-muted-foreground">
              Client #{client.id_client} - {getPersonTypeLabel(client.statut_juridique)}
            </p>
          </div>
        </div>
        <Badge className={getClientStatusColor(client.etat)}>
          {getClientStatusLabel(client.etat)}
        </Badge>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Solde total</p>
                <p className="text-xl font-bold">{formatCurrency(stats.total_solde)}</p>
                <p className="text-xs text-muted-foreground">
                  Disponible: {formatCurrency(stats.solde_disponible)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CreditCard className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comptes</p>
                <p className="text-xl font-bold">{stats.nombre_comptes}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.comptes_actifs} actif(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capital restant</p>
                <p className="text-xl font-bold">{formatCurrency(stats.capital_restant)}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.credits_en_cours} credit(s) en cours
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.montant_en_retard > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${stats.montant_en_retard > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <AlertTriangle className={`w-6 h-6 ${stats.montant_en_retard > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En retard</p>
                <p className={`text-xl font-bold ${stats.montant_en_retard > 0 ? 'text-red-600' : ''}`}>
                  {formatCurrency(stats.montant_en_retard)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.echeances_en_retard} echeance(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations personnelles */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" /> Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.statut_juridique === 1 ? (
              <>
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nom complet</p>
                    <p className="font-medium">{client.pp_prenom} {client.pp_nom}</p>
                  </div>
                </div>
                {client.pp_date_naissance && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date de naissance</p>
                      <p className="font-medium">{formatDate(client.pp_date_naissance)}</p>
                      {client.pp_lieu_naissance && (
                        <p className="text-xs text-muted-foreground">a {client.pp_lieu_naissance}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Sexe</p>
                    <p className="font-medium">{getSexeLabel(client.pp_sexe)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Etat civil</p>
                    <p className="font-medium">{getEtatCivilLabel(client.pp_etat_civil)}</p>
                  </div>
                </div>
                {(client.pp_employeur || client.pp_fonction) && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Emploi</p>
                      <p className="font-medium">{client.pp_fonction || '-'}</p>
                      {client.pp_employeur && (
                        <p className="text-xs text-muted-foreground">chez {client.pp_employeur}</p>
                      )}
                    </div>
                  </div>
                )}
                {client.pp_revenu > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Revenu mensuel</p>
                    <p className="font-medium">{formatCurrency(client.pp_revenu)}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Raison sociale</p>
                    <p className="font-medium">{client.pm_raison_sociale}</p>
                  </div>
                </div>
                {client.pm_nature_juridique && (
                  <div>
                    <p className="text-sm text-muted-foreground">Nature juridique</p>
                    <p className="font-medium">{client.pm_nature_juridique}</p>
                  </div>
                )}
                {client.pm_numero_reg_nat && (
                  <div>
                    <p className="text-sm text-muted-foreground">N Registre national</p>
                    <p className="font-medium">{client.pm_numero_reg_nat}</p>
                  </div>
                )}
              </>
            )}

            <hr className="my-4" />

            {/* Contact */}
            {client.num_tel && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Telephone</p>
                  <p className="font-medium">{client.num_tel}</p>
                  {client.num_port && client.num_port !== client.num_tel && (
                    <p className="text-xs text-muted-foreground">{client.num_port}</p>
                  )}
                </div>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{client.email}</p>
                </div>
              </div>
            )}
            {(client.adresse || client.ville) && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Adresse</p>
                  <p className="font-medium">{client.adresse || '-'}</p>
                  {client.ville && <p className="text-xs text-muted-foreground">{client.ville}</p>}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date d'adhesion</p>
                <p className="font-medium">{formatDate(client.date_adh)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comptes et Credits */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prochaines echeances */}
          {client.prochaines_echeances && client.prochaines_echeances.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <Clock className="w-5 h-5" /> Prochaines echeances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {client.prochaines_echeances.map((ech, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-white rounded border">
                      <div>
                        <span className="font-medium">Credit #{ech.id_doss}</span>
                        <span className="text-muted-foreground ml-2">Ech. {ech.num_ech}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(ech.montant_total)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(ech.date_ech)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comptes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Comptes ({client.comptes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.comptes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Aucun compte</p>
              ) : (
                <div className="space-y-4">
                  {client.comptes.map((compte) => (
                    <div key={compte.id_cpte} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium">{compte.intitule_compte || 'Compte'}</p>
                          <p className="text-sm text-muted-foreground">{compte.num_complet_cpte}</p>
                        </div>
                        <Badge className={getAccountStatusColor(compte.etat_cpte)}>
                          {compte.etat_label}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Solde</p>
                          <p className="font-bold text-lg">{formatCurrency(compte.solde)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bloque</p>
                          <p className="font-medium text-orange-600">{formatCurrency(compte.mnt_bloq)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Disponible</p>
                          <p className="font-medium text-green-600">{formatCurrency(compte.solde_disponible)}</p>
                        </div>
                      </div>
                      {compte.dernieres_transactions && compte.dernieres_transactions.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Dernieres transactions</p>
                          <div className="space-y-1">
                            {compte.dernieres_transactions.slice(0, 3).map((tx) => (
                              <div key={tx.id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {formatDate(tx.date)} - {tx.libelle || 'Transaction'}
                                </span>
                                <span className={tx.sens === 'C' ? 'text-green-600' : 'text-red-600'}>
                                  {tx.sens === 'C' ? '+' : '-'}{formatCurrency(tx.montant)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" /> Credits ({client.credits.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.credits.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Aucun credit</p>
              ) : (
                <div className="space-y-4">
                  {client.credits.map((credit) => (
                    <div key={credit.id_doss} className="border rounded-lg">
                      <div
                        className="p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleCreditExpand(credit.id_doss)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {expandedCredits.has(credit.id_doss) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                            <div>
                              <p className="font-medium">Credit #{credit.id_doss}</p>
                              <p className="text-sm text-muted-foreground">
                                {credit.duree_mois} mois - {formatPercent(credit.taux_interet)} p.a.
                              </p>
                            </div>
                          </div>
                          <Badge className={getCreditStatusColor(credit.etat)}>
                            {credit.etat_label}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Montant octroye</p>
                            <p className="font-bold">{formatCurrency(credit.montant_octroye)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Capital restant</p>
                            <p className="font-medium">{formatCurrency(credit.capital_restant)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Echeances</p>
                            <p className="font-medium">
                              {credit.echeances_payees}/{credit.echeances_payees + credit.echeances_restantes}
                            </p>
                          </div>
                          {credit.echeances_en_retard > 0 && (
                            <div>
                              <p className="text-muted-foreground">En retard</p>
                              <p className="font-medium text-red-600">
                                {credit.echeances_en_retard} ({formatCurrency(credit.montant_en_retard)})
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Echeancier detaille */}
                      {expandedCredits.has(credit.id_doss) && (
                        <div className="border-t p-4 bg-muted/30">
                          <h4 className="font-medium mb-3">Echeancier</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-2">N</th>
                                  <th className="text-left py-2 px-2">Date</th>
                                  <th className="text-right py-2 px-2">Capital</th>
                                  <th className="text-right py-2 px-2">Interets</th>
                                  <th className="text-right py-2 px-2">Total</th>
                                  <th className="text-right py-2 px-2">Restant</th>
                                  <th className="text-center py-2 px-2">Etat</th>
                                </tr>
                              </thead>
                              <tbody>
                                {credit.echeancier.map((ech) => (
                                  <tr
                                    key={ech.num_ech}
                                    className={`border-b ${ech.en_retard ? 'bg-red-50' : ''}`}
                                  >
                                    <td className="py-2 px-2">{ech.num_ech}</td>
                                    <td className="py-2 px-2">
                                      {formatDate(ech.date_ech)}
                                      {ech.en_retard && (
                                        <span className="text-xs text-red-600 ml-1">
                                          ({getDaysOverdue(ech.date_ech)}j)
                                        </span>
                                      )}
                                    </td>
                                    <td className="text-right py-2 px-2">{formatCurrency(ech.mnt_capital)}</td>
                                    <td className="text-right py-2 px-2">{formatCurrency(ech.mnt_interet)}</td>
                                    <td className="text-right py-2 px-2 font-medium">{formatCurrency(ech.montant_total)}</td>
                                    <td className="text-right py-2 px-2">{formatCurrency(ech.solde_total)}</td>
                                    <td className="text-center py-2 px-2">
                                      <Badge className={`text-xs ${getEcheanceStatusColor(ech.etat_label)}`}>
                                        {ech.etat_label}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Garanties */}
                          {credit.garanties && credit.garanties.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="font-medium mb-2">Garanties</h4>
                              <div className="space-y-2">
                                {credit.garanties.map((gar) => (
                                  <div key={gar.id} className="flex justify-between text-sm">
                                    <span>{gar.description || `Garantie type ${gar.type}`}</span>
                                    <span className="font-medium">{formatCurrency(gar.valeur)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
