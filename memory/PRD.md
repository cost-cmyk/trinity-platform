# Trinity - Plateforme de Gestion Multi-Restaurants

## Date de création: 25 Février 2026

## Problem Statement Original
Plateforme de gestion multi-restaurants "Trinity" basée sur un cahier des charges technique complet. L'utilisateur a développé un prototype JSX avec Claude AI et souhaite une application web fonctionnelle.

## Architecture Technique
- **Frontend**: React 18 + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Base de données**: MongoDB
- **Design**: Dark mode exclusif, polices Outfit/DM Mono
- **Parsing XLS**: xlrd (Excel 97-2003) + openpyxl (Excel 2007+)

## User Personas
1. **Gérants de restaurants** - Gestion quotidienne, saisie des données, consultation des KPIs
2. **Directeurs d'exploitation (DO)** - Vue consolidée du groupe, analyse des performances
3. **Équipe Finance** - Suivi des coûts, food cost, masse salariale

## Core Requirements (Static)
- Dashboard avec KPIs groupe et par restaurant
- Gestion des restaurants (CRUD)
- Carte & Produits avec catégorisation
- Fiches Techniques avec calcul automatique du food cost
- Import des ventes (format PSW .xls/.xlsx)
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
- [x] **Upload et parsing réel des fichiers XLS/XLSX**
- [x] Détection automatique des colonnes (Désignation, Qté, PU, CA, Remise, Famille)
- [x] Classification automatique Nourriture/Boisson
- [x] Exclusion automatique des remises négatives (bug PSW)

#### Frontend (React)
- [x] Sidebar collapsible avec navigation par pôles
- [x] Dashboard avec KPIs (CA, restaurants, produits, fiches)
- [x] Module Restaurants (création, édition, suppression, couleurs)
- [x] Module Carte & Produits (listing, filtres, CRUD)
- [x] Module Fiches Techniques (ingrédients dynamiques, jauge food cost)
- [x] **Module Import Ventes complet:**
  - [x] Zone de dépôt drag-and-drop
  - [x] Détection automatique restaurant/date depuis nom fichier
  - [x] Upload réel avec parsing backend
  - [x] Historique des imports avec suppression
  - [x] Affichage du CA et nombre de lignes importées
- [x] Top 10 ventes dynamique
- [x] Design dark mode avec polices Outfit/DM Mono
- [x] Toasts de notification (sonner)

#### Testing
- Backend: 100% des tests passés
- Import XLS: Testé avec fichier réel (10 ventes, 922.50€ CA)

---

## Prioritized Backlog

### P1 - Phase 2 (Prochaine itération)
- [ ] Menu Engineering (matrice BCG)
- [ ] Module Achats (import Odoo, suivi des prix)
- [ ] Comparatif fournisseurs
- [ ] Alertes sur hausses de prix

### P2 - Phase 3
- [ ] Bilans quotidiens (saisie, validation, historique)
- [ ] Masse salariale (import Silae/Payfit, ratios)
- [ ] Vue consolidée groupe améliorée

### P3 - Phase 4
- [ ] Système de permissions (RBAC)
- [ ] Authentification utilisateurs
- [ ] Gestion des groupes et droits
- [ ] Audit log

### Backlog
- [ ] Export PDF des fiches techniques
- [ ] Graphiques recharts pour tendances
- [ ] Mode mobile responsive
- [ ] Import PDF carte (extraction AI)
- [ ] Validation des ventes avant import (preview)
- [ ] Calendrier d'historique des imports

---

## Notes Techniques
- Collection MongoDB: `restaurants`, `produits`, `fiches_techniques`, `ventes`, `imports`
- Food cost calculé: `(cout_total / nb_portions) / prix_vente * 100`
- Couleurs restaurants: palette de 8 couleurs prédéfinies
- Format fichier PSW: `NOM_RESTAURANT_ventes_du_YYYYMMDD.xls`
- Colonnes reconnues: Désignation, Quantité, PU TTC, CA TTC, Remise, Famille
- Boissons détectées par mots-clés: boisson, bière, vin, café, alcool, soda, etc.
