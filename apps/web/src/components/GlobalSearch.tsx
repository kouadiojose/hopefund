import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  User,
  Wallet,
  FileText,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { clientsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Client {
  id_client: number;
  pp_nom: string;
  pp_prenom: string;
  pm_raison_sociale: string;
  statut_juridique: number;
  num_port: string;
  email: string;
  etat: number;
  comptes?: Array<{ id_cpte: number; solde: any; etat_cpte: number }>;
  dossiers_credit?: Array<{ id_doss: number; cre_mnt_octr: any; cre_etat: number }>;
  _count?: { comptes: number; dossiers_credit: number };
}

export default function GlobalSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search API
  const { data: searchResults, isLoading, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return null;
      const response = await clientsApi.getAll({ search: debouncedQuery, limit: 10 });
      return response.data;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const clients: Client[] = searchResults?.data || [];
  const showLoading = isLoading || isFetching;

  const getClientName = (client: Client) => {
    if (client.statut_juridique === 1) {
      return `${client.pp_prenom || ''} ${client.pp_nom || ''}`.trim();
    }
    return client.pm_raison_sociale || `Client #${client.id_client}`;
  };

  const getStatusLabel = (etat: number) => {
    const statuses: Record<number, { label: string; color: string }> = {
      1: { label: 'Actif', color: 'text-green-600 bg-green-50' },
      2: { label: 'Inactif', color: 'text-gray-600 bg-gray-100' },
      3: { label: 'Bloqué', color: 'text-red-600 bg-red-50' },
    };
    return statuses[etat] || { label: 'Inconnu', color: 'text-gray-500 bg-gray-50' };
  };

  const handleClientClick = (clientId: number) => {
    navigate(`/clients/${clientId}`);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Calculate totals for each client
  const getClientStats = (client: Client) => {
    const comptes = client.comptes || [];
    const credits = client.dossiers_credit || [];

    const comptesActifs = comptes.filter(c => c.etat_cpte === 1).length;
    const totalSolde = comptes.reduce((sum, c) => sum + Number(c.solde || 0), 0);
    const creditsActifs = credits.filter(c => [5, 8].includes(c.cre_etat)).length;
    const totalCredits = credits.reduce((sum, c) => sum + Number(c.cre_mnt_octr || 0), 0);

    return { comptesActifs, totalSolde, creditsActifs, totalCredits, totalComptes: comptes.length, totalDossiers: credits.length };
  };

  return (
    <div ref={containerRef} className="relative w-64 lg:w-80">
      <div className="relative">
        <Input
          ref={inputRef}
          type="search"
          placeholder="Rechercher client, ID, tél..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          icon={showLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          className="bg-gray-50 pr-8"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && debouncedQuery.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
          >
            {showLoading && clients.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Recherche en cours...
              </div>
            ) : clients.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Aucun client trouvé pour "{debouncedQuery}"
              </div>
            ) : (
              <div>
                <div className="px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
                  {clients.length} résultat{clients.length > 1 ? 's' : ''} pour "{debouncedQuery}"
                </div>
                {clients.map((client) => {
                  const stats = getClientStats(client);
                  const status = getStatusLabel(client.etat);

                  return (
                    <div
                      key={client.id_client}
                      onClick={() => handleClientClick(client.id_client)}
                      className="p-4 hover:bg-hopefund-50 cursor-pointer border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 truncate">
                              {getClientName(client)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mb-2">
                            ID: #{client.id_client}
                            {client.num_port && ` • ${client.num_port}`}
                          </div>

                          {/* Stats */}
                          <div className="flex flex-wrap gap-3 text-xs">
                            <div className="flex items-center gap-1 text-blue-600">
                              <Wallet className="h-3.5 w-3.5" />
                              <span>{stats.comptesActifs} compte{stats.comptesActifs > 1 ? 's' : ''}</span>
                              {stats.totalSolde > 0 && (
                                <span className="font-medium">({formatCurrency(stats.totalSolde)})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-green-600">
                              <FileText className="h-3.5 w-3.5" />
                              <span>{stats.totalDossiers} crédit{stats.totalDossiers > 1 ? 's' : ''}</span>
                              {stats.creditsActifs > 0 && (
                                <span className="text-orange-600">({stats.creditsActifs} actif{stats.creditsActifs > 1 ? 's' : ''})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  );
                })}

                {searchResults?.pagination?.total > 10 && (
                  <div
                    onClick={() => {
                      navigate(`/clients?search=${encodeURIComponent(debouncedQuery)}`);
                      setIsOpen(false);
                    }}
                    className="px-4 py-3 bg-gray-50 text-center text-sm text-hopefund-600 hover:bg-hopefund-50 cursor-pointer font-medium"
                  >
                    Voir tous les {searchResults.pagination.total} résultats →
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
