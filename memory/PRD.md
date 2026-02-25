# Trinity - Plateforme de Gestion Multi-Restaurants

## Date de création: 25 Février 2026

## Problem Statement Original
Plateforme de gestion multi-restaurants "Trinity" basée sur un cahier des charges technique complet. L'utilisateur a développé un prototype JSX avec Claude AI et souhaite une application web fonctionnelle.

## Architecture Technique
- **Frontend**: React 18 + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Base de données**: MongoDB
- **Design**: Dark mode exclusif, polices Outfit/DM Mono

## User Personas
1. **Gérants de restaurants** - Gestion quotidienne, saisie des données, consultation des KPIs
2. **Directeurs d'exploitation (DO)** - Vue consolidée du groupe, analyse des performances
3. **Équipe Finance** - Suivi des coûts, food cost, masse salariale

## Core Requirements (Static)
- Dashboard avec KPIs groupe et par restaurant
- Gestion des restaurants (CRUD)
- Carte & Produits avec catégorisation
- Fiches Techniques avec calcul automatique du food cost
- Import des ventes (format PSW .xls)
- Interface 100% en français
- Design dark mode avec couleurs par restaurant

---

## What's Been Implemented

### MVP Phase 1 - 25 Février 2026 ✅

#### Backend (server.py)
- [x] API REST complète avec FastAPI
- [x] Modèles Pydantic: Restaurant, Produit, FicheTechnique, Vente, Import
- [x] CRUD complet pour tous les modèles
- [x] Calcul automatique food cost dans les fiches techniques
- [x] Endpoints dashboard avec statistiques agrégées
- [x] Liaison fiche technique ↔ produit

#### Frontend (React)
- [x] Sidebar collapsible avec navigation par pôles
- [x] Dashboard avec KPIs (CA, restaurants, produits, fiches)
- [x] Module Restaurants (création, édition, suppression, couleurs)
- [x] Module Carte & Produits (listing, filtres, CRUD)
- [x] Module Fiches Techniques (ingrédients dynamiques, jauge food cost)
- [x] Module Import Ventes (drop zone, détection fichiers)
- [x] Composants UI: KPICard, Gauge, Pill, ProgressBar, Modal, EmptyState
- [x] Design dark mode avec polices Outfit/DM Mono
- [x] Toasts de notification (sonner)

#### Testing
- Backend: 100% des tests passés (17 endpoints)
- Frontend: 95% fonctionnel

---

## Prioritized Backlog

### P0 - Phase 2 (Prochaine itération)
- [ ] Import réel des fichiers XLS (parsing avec xlrd/openpyxl)
- [ ] Historique des imports avec calendrier
- [ ] Top 10 ventes dynamique basé sur les données importées
- [ ] Validation des ventes avant import

### P1 - Phase 3
- [ ] Menu Engineering (matrice BCG)
- [ ] Module Achats (import Odoo, suivi des prix)
- [ ] Comparatif fournisseurs
- [ ] Alertes sur hausses de prix

### P2 - Phase 4
- [ ] Bilans quotidiens (saisie, validation, historique)
- [ ] Masse salariale (import Silae/Payfit, ratios)
- [ ] Vue consolidée groupe améliorée

### P3 - Phase 5
- [ ] Système de permissions (RBAC)
- [ ] Authentification utilisateurs
- [ ] Gestion des groupes et droits
- [ ] Audit log

### Backlog
- [ ] Export PDF des fiches techniques
- [ ] Graphiques recharts pour tendances
- [ ] Mode mobile responsive
- [ ] Import PDF carte (extraction AI)
- [ ] Intégration API PSW directe

---

## Next Tasks List
1. Implémenter le parsing réel des fichiers XLS de ventes
2. Ajouter la validation des données avant import
3. Créer le calendrier d'historique des imports
4. Développer le top 10 ventes dynamique

---

## Notes Techniques
- Collection MongoDB: `restaurants`, `produits`, `fiches_techniques`, `ventes`, `imports`
- Food cost calculé: `(cout_total / nb_portions) / prix_vente * 100`
- Couleurs restaurants: palette de 8 couleurs prédéfinies
- Format fichier PSW: `NOM_RESTAURANT_ventes_du_YYYYMMDD_au_YYYYMMDD.xls`
