import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-hopefund-50 via-white to-hopefund-100">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-hopefund-200/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-hopefund-300/30 rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-screen flex">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-hopefund-600 to-hopefund-800 p-12 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                <span className="text-hopefund-600 font-bold text-xl">H</span>
              </div>
              <span className="text-white text-2xl font-bold">Hopefund</span>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Système de Gestion Bancaire
              <br />
              <span className="text-hopefund-200">pour la Microfinance</span>
            </h1>
            <p className="text-hopefund-100 text-lg max-w-md">
              Gérez vos clients, comptes, crédits et transactions en toute simplicité
              avec notre plateforme moderne et sécurisée.
            </p>

            <div className="flex gap-8 pt-8">
              <div>
                <div className="text-3xl font-bold text-white">15K+</div>
                <div className="text-hopefund-200 text-sm">Clients actifs</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">60K+</div>
                <div className="text-hopefund-200 text-sm">Comptes</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">30+</div>
                <div className="text-hopefund-200 text-sm">Ans d'historique</div>
              </div>
            </div>
          </div>

          <div className="text-hopefund-200 text-sm">
            © 2024 Hopefund. Tous droits réservés.
          </div>
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
