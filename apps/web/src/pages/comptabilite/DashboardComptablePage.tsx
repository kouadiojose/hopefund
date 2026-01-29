import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  FileText,
  RefreshCw,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { comptabiliteApi } from '@/lib/api';

export default function DashboardComptablePage() {
  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['comptabilite-dashboard'],
    queryFn: comptabiliteApi.getDashboard,
  });

  const { data: stats } = useQuery({
    queryKey: ['comptabilite-statistiques'],
    queryFn: comptabiliteApi.getStatistiques,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hopefund-600"></div>
      </div>
    );
  }

  const resume = dashboard?.resume || {};
  const parClasse = dashboard?.parClasse || [];
  const parAgence = dashboard?.parAgence || [];
  const topComptes = dashboard?.topComptes || [];
  const evolutionMensuelle = dashboard?.evolutionMensuelle || [];
  const dernieresEcritures = dashboard?.dernieresEcritures || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Tableau de Bord Comptable
          </h1>
          <p className="text-gray-500">Vue d'ensemble de toutes les opérations comptables</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Écritures</p>
                <p className="text-2xl font-bold text-gray-900">
                  {resume.nb_ecritures?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-400">
                  {resume.total_lignes?.toLocaleString() || 0} lignes
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Débit</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(resume.total_debit || 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <ArrowUpRight className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Crédit</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(resume.total_credit || 0)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <ArrowDownRight className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Comptes Actifs</p>
                <p className="text-2xl font-bold text-purple-600">
                  {resume.nb_comptes || 0}
                </p>
                <p className="text-xs text-gray-400">
                  {resume.nb_agences || 0} agences
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Période couverte */}
      {resume.premiere_date && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4 text-sm">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-gray-600">Période couverte:</span>
              <Badge variant="outline">
                {formatDate(resume.premiere_date)} - {formatDate(resume.derniere_date)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats par résultat */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Total Charges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">
                {formatCurrency(stats.totaux?.charges || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Total Produits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(stats.totaux?.produits || 0)}
              </p>
            </CardContent>
          </Card>

          <Card className={(stats.totaux?.resultat || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Résultat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${(stats.totaux?.resultat || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stats.totaux?.resultat || 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mouvements par classe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Mouvements par Classe Comptable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {parClasse.map((c: any) => (
                <div key={c.classe} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                      ${c.classe === '1' ? 'bg-blue-500' :
                        c.classe === '2' ? 'bg-green-500' :
                        c.classe === '3' ? 'bg-yellow-500' :
                        c.classe === '4' ? 'bg-purple-500' :
                        c.classe === '5' ? 'bg-indigo-500' :
                        c.classe === '6' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                      {c.classe}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{c.libelle}</p>
                      <p className="text-xs text-gray-500">{c.nb_mouvements} mouvements</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">D: {formatCurrency(c.total_debit)}</p>
                    <p className="text-sm font-medium text-red-600">C: {formatCurrency(c.total_credit)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mouvements par agence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Mouvements par Agence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {parAgence.map((a: any) => (
                <div key={a.id_ag} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{a.nom_agence || `Agence ${a.id_ag}`}</p>
                    <p className="text-xs text-gray-500">
                      {a.nb_ecritures} écritures - {a.nb_mouvements} lignes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">D: {formatCurrency(a.total_debit)}</p>
                    <p className="text-sm font-medium text-red-600">C: {formatCurrency(a.total_credit)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top comptes */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Comptes les Plus Mouvementés</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">N° Compte</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Libellé</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Nb Mouvements</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total Débit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total Crédit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topComptes.map((c: any) => (
                <tr key={c.compte} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-mono">{c.compte}</td>
                  <td className="px-4 py-2 text-sm">{c.libelle}</td>
                  <td className="px-4 py-2 text-sm text-right">{c.nb_mouvements}</td>
                  <td className="px-4 py-2 text-sm text-right text-green-600">{formatCurrency(c.total_debit)}</td>
                  <td className="px-4 py-2 text-sm text-right text-red-600">{formatCurrency(c.total_credit)}</td>
                  <td className={`px-4 py-2 text-sm text-right font-medium ${c.total_debit - c.total_credit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(c.total_debit - c.total_credit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Évolution mensuelle */}
      {evolutionMensuelle.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Évolution Mensuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Mois</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Écritures</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Mouvements</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total Débit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total Crédit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {evolutionMensuelle.map((e: any) => (
                  <tr key={e.mois} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium">{e.mois}</td>
                    <td className="px-4 py-2 text-sm text-right">{e.nb_ecritures}</td>
                    <td className="px-4 py-2 text-sm text-right">{e.nb_mouvements}</td>
                    <td className="px-4 py-2 text-sm text-right text-green-600">{formatCurrency(e.total_debit)}</td>
                    <td className="px-4 py-2 text-sm text-right text-red-600">{formatCurrency(e.total_credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Dernières écritures */}
      <Card>
        <CardHeader>
          <CardTitle>Dernières Écritures Comptables</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">N° Écriture</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Agence</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Comptes</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dernieresEcritures.map((e: any, idx: number) => (
                <tr key={`${e.id_ecriture}-${e.id_ag}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-mono">ECR-{e.id_ecriture}</td>
                  <td className="px-4 py-2 text-sm">{e.date_valeur ? formatDate(e.date_valeur) : '-'}</td>
                  <td className="px-4 py-2 text-sm">Agence {e.id_ag}</td>
                  <td className="px-4 py-2 text-sm font-mono text-xs">{e.comptes}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(e.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
