import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calculator,
  Users,
  Wallet,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

interface ValidationResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

interface ValidationResponse {
  validationDate: string;
  summary: {
    total: number;
    success: number;
    errors: number;
    status: string;
  };
  statistics?: any;
  results: ValidationResult[];
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return null;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'success':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Succès</Badge>;
    case 'warning':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Attention</Badge>;
    case 'error':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Erreur</Badge>;
    default:
      return null;
  }
};

function ValidationSection({
  title,
  icon: Icon,
  module,
  endpoint,
}: {
  title: string;
  icon: any;
  module: string;
  endpoint: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['validation', module],
    queryFn: async () => {
      const response = await api.get(endpoint);
      return response.data as ValidationResponse;
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {data && getStatusBadge(data.summary.status)}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-hopefund-600" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Résumé */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{data.summary.total}</p>
                <p className="text-sm text-gray-500">Tests</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{data.summary.success}</p>
                <p className="text-sm text-gray-500">Réussis</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{data.summary.errors}</p>
                <p className="text-sm text-gray-500">Erreurs</p>
              </div>
            </div>

            {/* Résultats */}
            <div>
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => setExpanded(!expanded)}
              >
                <span>Détails des tests</span>
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              {expanded && (
                <div className="mt-2 space-y-2">
                  {data.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        result.status === 'success'
                          ? 'border-green-200 bg-green-50'
                          : result.status === 'warning'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                          <p className="font-medium">{result.test}</p>
                          <p className="text-sm text-gray-600">{result.message}</p>
                          {result.details && (
                            <details className="mt-2">
                              <summary className="text-sm text-gray-500 cursor-pointer">
                                Voir les détails
                              </summary>
                              <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Statistiques */}
            {data.statistics && (
              <details className="mt-4">
                <summary className="text-sm text-gray-500 cursor-pointer font-medium">
                  Statistiques
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                  {JSON.stringify(data.statistics, null, 2)}
                </pre>
              </details>
            )}

            <p className="text-xs text-gray-400 text-right">
              Dernière validation: {new Date(data.validationDate).toLocaleString('fr-FR')}
            </p>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">Aucune donnée</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ValidationPage() {
  const { data: allValidation, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['validation', 'all'],
    queryFn: async () => {
      const response = await api.get('/validation/all');
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Validation des Données
          </h1>
          <p className="text-gray-500">Vérification de la cohérence des données du système</p>
        </div>
        <Button onClick={() => refetch()} disabled={isLoading || isRefetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Tout valider
        </Button>
      </div>

      {/* Résumé global */}
      {allValidation && (
        <Card className={allValidation.status === 'success' ? 'border-green-200' : 'border-red-200'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {allValidation.status === 'success' ? (
                <CheckCircle className="h-12 w-12 text-green-500" />
              ) : (
                <XCircle className="h-12 w-12 text-red-500" />
              )}
              <div>
                <h2 className="text-xl font-bold">
                  {allValidation.status === 'success'
                    ? 'Toutes les validations sont passées'
                    : 'Des erreurs ont été détectées'}
                </h2>
                <p className="text-gray-500">
                  {allValidation.status === 'success'
                    ? 'Les données du système sont cohérentes'
                    : 'Veuillez examiner les détails ci-dessous'}
                </p>
              </div>
            </div>

            {/* Aperçu des modules */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(allValidation.modules).map(([key, value]: [string, any]) => (
                <div
                  key={key}
                  className={`p-4 rounded-lg ${
                    value.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(value.status)}
                    <span className="font-medium capitalize">{key}</span>
                  </div>
                  {value.message && (
                    <p className="mt-1 text-sm text-gray-600">{value.message}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections de validation détaillées */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ValidationSection
          title="Comptabilité"
          icon={Calculator}
          module="comptabilite"
          endpoint="/validation/comptabilite"
        />
        <ValidationSection
          title="Caisse"
          icon={Wallet}
          module="caisse"
          endpoint="/validation/caisse"
        />
      </div>

      <ValidationSection
        title="Utilisateurs"
        icon={Users}
        module="utilisateurs"
        endpoint="/validation/utilisateurs"
      />
    </div>
  );
}
