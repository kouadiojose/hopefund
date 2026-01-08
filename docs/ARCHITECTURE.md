# Architecture Technique - Hopefund Banking System

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOPEFUND BANKING PLATFORM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   Mobile    │  │   Web App   │  │  Back-Office│  │   Admin     │       │
│   │   Client    │  │   Client    │  │    Staff    │  │   Portal    │       │
│   │  (React     │  │  (React)    │  │  (React)    │  │  (React)    │       │
│   │   Native)   │  │             │  │             │  │             │       │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│          │                │                │                │              │
│          └────────────────┴────────────────┴────────────────┘              │
│                                    │                                        │
│                          ┌─────────▼─────────┐                             │
│                          │   API Gateway     │                             │
│                          │   (Node.js)       │                             │
│                          │   - Auth (JWT)    │                             │
│                          │   - Rate Limiting │                             │
│                          │   - Logging       │                             │
│                          └─────────┬─────────┘                             │
│                                    │                                        │
│          ┌─────────────────────────┼─────────────────────────┐             │
│          │                         │                         │             │
│   ┌──────▼──────┐          ┌───────▼───────┐         ┌──────▼──────┐      │
│   │   Service   │          │    Service    │         │   Service   │      │
│   │   Clients   │          │    Comptes    │         │   Crédits   │      │
│   │             │          │  & Épargne    │         │   & Prêts   │      │
│   └──────┬──────┘          └───────┬───────┘         └──────┬──────┘      │
│          │                         │                         │             │
│          │    ┌────────────────────┼────────────────────┐   │             │
│          │    │                    │                    │   │             │
│   ┌──────▼────▼──┐         ┌───────▼───────┐    ┌──────▼───▼──┐          │
│   │   Service    │         │    Service    │    │   Service   │          │
│   │ Transactions │         │   Reporting   │    │   Compta    │          │
│   └──────┬───────┘         └───────┬───────┘    └──────┬──────┘          │
│          │                         │                   │                  │
│          └─────────────────────────┼───────────────────┘                  │
│                                    │                                       │
│                          ┌─────────▼─────────┐                            │
│                          │    PostgreSQL     │                            │
│                          │   (DigitalOcean)  │                            │
│                          │                   │                            │
│                          │  - 214 tables     │                            │
│                          │  - 20M+ rows      │                            │
│                          │  - 30 ans data    │                            │
│                          └───────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Stack Technique

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js + TypeScript
- **ORM**: Prisma (pour interagir avec PostgreSQL existant)
- **Auth**: JWT + bcrypt
- **Validation**: Zod
- **Documentation API**: Swagger/OpenAPI

### Frontend Web
- **Framework**: React 18 + TypeScript
- **UI Library**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Routing**: React Router v6

### Mobile (Clients)
- **Framework**: React Native + Expo
- **Navigation**: React Navigation
- **State**: Zustand
- **UI**: NativeWind (Tailwind pour RN)

### Infrastructure
- **Database**: PostgreSQL 18 (DigitalOcean Managed)
- **Hosting API**: DigitalOcean App Platform
- **Hosting Web**: DigitalOcean App Platform
- **CDN/Storage**: DigitalOcean Spaces
- **Domain**: Votre domaine existant

---

## Modules Fonctionnels

### 1. Module Authentification & Utilisateurs
```
├── Authentification multi-facteur
├── Gestion des rôles (RBAC)
│   ├── Super Admin
│   ├── Directeur
│   ├── Chef d'agence
│   ├── Conseiller crédit
│   ├── Caissier
│   └── Client
├── Sessions sécurisées
└── Audit trail (journalisation)
```

### 2. Module Clients (ad_cli)
```
├── Inscription client (KYC)
├── Gestion profil
│   ├── Personne physique
│   └── Personne morale
├── Documents d'identité
├── Historique client
└── Scoring client
```

### 3. Module Comptes (ad_cpt)
```
├── Ouverture de compte
├── Types de comptes
│   ├── Compte épargne
│   ├── Compte courant
│   └── Compte à terme (DAT)
├── Consultation solde
├── Relevés de compte
├── Blocage/Déblocage
└── Clôture compte
```

### 4. Module Transactions (ad_mouvement, ad_his)
```
├── Dépôts
├── Retraits
├── Virements internes
├── Virements externes
├── Paiements
└── Historique transactions
```

### 5. Module Crédits (ad_dcr)
```
├── Demande de crédit
├── Workflow d'approbation
│   ├── Analyse dossier
│   ├── Comité crédit
│   └── Déblocage fonds
├── Gestion garanties (ad_gar)
├── Échéancier remboursements (ad_sre)
├── Suivi impayés
├── Provisionnement
└── Restructuration
```

### 6. Module Caisse
```
├── Ouverture/Fermeture caisse
├── Opérations espèces
├── Réconciliation
├── Brouillard de caisse
└── Rapports journaliers
```

### 7. Module Comptabilité (ad_ecriture, ad_flux_compta)
```
├── Plan comptable
├── Écritures automatiques
├── Grand livre
├── Balance
├── États financiers
└── Export comptable
```

### 8. Module Reporting
```
├── Tableaux de bord
├── Rapports réglementaires
├── Rapports de gestion
├── Statistiques portefeuille
└── Export Excel/PDF
```

---

## Sécurité

### Authentification
- JWT avec refresh tokens
- Sessions expiration: 15min access / 7 jours refresh
- Blocage après 5 tentatives échouées
- 2FA optionnel pour admin/staff

### Autorisation (RBAC)
```typescript
enum Role {
  SUPER_ADMIN = 'super_admin',      // Tout accès
  DIRECTOR = 'director',             // Lecture globale + validation
  BRANCH_MANAGER = 'branch_manager', // Gestion agence
  CREDIT_OFFICER = 'credit_officer', // Gestion crédits
  TELLER = 'teller',                 // Opérations caisse
  CLIENT = 'client'                  // Accès limité compte perso
}
```

### Données
- Chiffrement TLS en transit
- Chiffrement au repos (DigitalOcean)
- Masquage données sensibles dans logs
- Conformité RGPD

### Audit
- Journalisation toutes opérations
- Historique modifications
- Traçabilité complète

---

## APIs Principales

### Auth API
```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

### Clients API
```
GET    /api/clients              # Liste clients
GET    /api/clients/:id          # Détail client
POST   /api/clients              # Créer client
PUT    /api/clients/:id          # Modifier client
GET    /api/clients/:id/accounts # Comptes du client
GET    /api/clients/:id/loans    # Prêts du client
```

### Comptes API
```
GET    /api/accounts             # Liste comptes
GET    /api/accounts/:id         # Détail compte
GET    /api/accounts/:id/balance # Solde
GET    /api/accounts/:id/transactions # Transactions
POST   /api/accounts/:id/block   # Bloquer
POST   /api/accounts/:id/unblock # Débloquer
```

### Transactions API
```
POST   /api/transactions/deposit    # Dépôt
POST   /api/transactions/withdraw   # Retrait
POST   /api/transactions/transfer   # Virement
GET    /api/transactions/:id        # Détail
```

### Crédits API
```
GET    /api/loans                # Liste prêts
GET    /api/loans/:id            # Détail prêt
POST   /api/loans                # Nouvelle demande
PUT    /api/loans/:id/approve    # Approuver
PUT    /api/loans/:id/disburse   # Débloquer
GET    /api/loans/:id/schedule   # Échéancier
POST   /api/loans/:id/repay      # Remboursement
```

---

## Estimation Infrastructure

### DigitalOcean (Mensuel)
| Service | Spécifications | Coût |
|---------|---------------|------|
| PostgreSQL | Basic 2GB RAM | $30 |
| App Platform (API) | Basic | $12 |
| App Platform (Web) | Basic | $5 |
| Spaces (Storage) | 250GB | $5 |
| **Total** | | **~$52/mois** |

### Pour commencer (MVP)
| Service | Spécifications | Coût |
|---------|---------------|------|
| PostgreSQL | Basic 1GB | $15 |
| App Platform (API) | Basic | $12 |
| **Total MVP** | | **~$27/mois** |
