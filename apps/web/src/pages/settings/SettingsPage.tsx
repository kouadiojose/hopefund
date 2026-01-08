import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Lock,
  Bell,
  Shield,
  Building,
  Globe,
  Palette,
  Database,
  Mail,
  Smartphone,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'agency' | 'system';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const { user } = useAuthStore();

  const tabs = [
    { id: 'profile' as const, label: 'Profil', icon: User },
    { id: 'security' as const, label: 'Sécurité', icon: Lock },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'agency' as const, label: 'Agence', icon: Building },
    { id: 'system' as const, label: 'Système', icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500">Gérez vos préférences et configurations</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all',
                      activeTab === tab.id
                        ? 'bg-hopefund-50 text-hopefund-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Informations personnelles</CardTitle>
                  <CardDescription>
                    Mettez à jour vos informations de profil
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-hopefund-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-hopefund-700">
                        {user?.name?.charAt(0) || 'A'}
                      </span>
                    </div>
                    <div>
                      <Button variant="outline" size="sm">
                        Changer la photo
                      </Button>
                      <p className="text-sm text-gray-500 mt-1">
                        JPG, PNG ou GIF. Max 2MB.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Prénom</label>
                      <Input defaultValue={user?.name?.split(' ')[0] || ''} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Nom</label>
                      <Input defaultValue={user?.name?.split(' ')[1] || ''} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <Input type="email" defaultValue={user?.email || ''} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Téléphone</label>
                      <Input type="tel" placeholder="+225 XX XX XX XX XX" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="gap-2">
                      <Save className="h-4 w-4" />
                      Enregistrer
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rôle et permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-hopefund-100 rounded-lg">
                        <Shield className="h-5 w-5 text-hopefund-600" />
                      </div>
                      <div>
                        <p className="font-medium">{user?.role || 'Administrateur'}</p>
                        <p className="text-sm text-gray-500">Accès complet au système</p>
                      </div>
                    </div>
                    <Badge variant="success">Actif</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Changer le mot de passe</CardTitle>
                  <CardDescription>
                    Assurez-vous d'utiliser un mot de passe fort
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Mot de passe actuel
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Nouveau mot de passe
                    </label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Confirmer le mot de passe
                    </label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <div className="flex justify-end">
                    <Button>Mettre à jour</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Authentification à deux facteurs</CardTitle>
                  <CardDescription>
                    Ajoutez une couche de sécurité supplémentaire
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Smartphone className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium">Application d'authentification</p>
                        <p className="text-sm text-gray-500">
                          Utilisez Google Authenticator ou similaire
                        </p>
                      </div>
                    </div>
                    <Button variant="outline">Configurer</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sessions actives</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Session actuelle</p>
                        <p className="text-sm text-gray-500">
                          Chrome sur Windows - Abidjan, CI
                        </p>
                      </div>
                    </div>
                    <Badge variant="success">Actif maintenant</Badge>
                  </div>
                  <Button variant="destructive" className="w-full">
                    Déconnecter toutes les autres sessions
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Préférences de notification</CardTitle>
                  <CardDescription>
                    Choisissez comment vous souhaitez être notifié
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    {
                      title: 'Nouvelles transactions',
                      description: 'Recevoir une alerte pour chaque transaction',
                      icon: Mail,
                    },
                    {
                      title: 'Demandes de crédit',
                      description: 'Être notifié des nouvelles demandes de crédit',
                      icon: Bell,
                    },
                    {
                      title: 'Alertes système',
                      description: 'Recevoir les alertes importantes du système',
                      icon: Shield,
                    },
                    {
                      title: 'Rapports quotidiens',
                      description: 'Recevoir un résumé quotidien par email',
                      icon: Mail,
                    },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Icon className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-sm text-gray-500">{item.description}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            defaultChecked={index < 2}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hopefund-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hopefund-600"></div>
                        </label>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Agency Settings */}
          {activeTab === 'agency' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Informations de l'agence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Nom de l'agence</label>
                      <Input defaultValue="Hopefund - Siège" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Code agence</label>
                      <Input defaultValue="HF001" disabled />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Adresse</label>
                      <Input defaultValue="Plateau, Abidjan" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Téléphone</label>
                      <Input defaultValue="+225 27 20 XX XX XX" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Heures d'ouverture</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { day: 'Lundi - Vendredi', hours: '08:00 - 17:00' },
                      { day: 'Samedi', hours: '08:00 - 12:00' },
                      { day: 'Dimanche', hours: 'Fermé' },
                    ].map((schedule, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-gray-700">{schedule.day}</span>
                        <span className="font-medium">{schedule.hours}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Préférences système</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Globe className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Langue</p>
                        <p className="text-sm text-gray-500">Langue de l'interface</p>
                      </div>
                    </div>
                    <select className="border rounded-lg px-3 py-2 text-sm">
                      <option>Français</option>
                      <option>English</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Palette className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">Thème</p>
                        <p className="text-sm text-gray-500">Apparence de l'application</p>
                      </div>
                    </div>
                    <select className="border rounded-lg px-3 py-2 text-sm">
                      <option>Clair</option>
                      <option>Sombre</option>
                      <option>Système</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informations système</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Version</span>
                      <span className="font-mono">1.0.0</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Base de données</span>
                      <Badge variant="success">Connectée</Badge>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Dernière mise à jour</span>
                      <span>Janvier 2026</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
