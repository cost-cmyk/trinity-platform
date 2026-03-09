# 🚀 Guide de Déploiement - Trinity

## 📋 Table des matières
1. [Sauvegarde du code sur GitHub](#sauvegarde-github)
2. [Déploiement en production](#deploiement-production)
3. [Vérification du déploiement](#verification)
4. [Résolution des problèmes courants](#troubleshooting)

---

## 1. 💾 Sauvegarde du code sur GitHub {#sauvegarde-github}

### ✅ Pourquoi sauvegarder sur GitHub ?

- **Versioning** : Conserve un historique de toutes vos modifications
- **Sécurité** : Vos modifications sont sauvegardées en dehors de l'environnement Emergent
- **Déploiement** : Permet de déployer la version exacte avec toutes les corrections
- **Collaboration** : Facilite le travail d'équipe si nécessaire

### 📝 Procédure de sauvegarde

#### Méthode 1 : Via l'interface Emergent (Recommandé)

1. **Ouvrir l'interface de chat Emergent** où vous travaillez actuellement

2. **Localiser le bouton "Save to GitHub"**
   - Il se trouve généralement dans la barre d'outils en haut ou en bas de l'interface
   - Icône : 📁 ou logo GitHub

3. **Cliquer sur "Save to GitHub"**
   - Une fenêtre s'ouvre pour configurer la sauvegarde

4. **Configurer la sauvegarde**
   - **Repository** : Choisissez votre repository existant ou créez-en un nouveau
   - **Branch** : Utilisez `main` ou créez une nouvelle branche (ex: `production-fixes`)
   - **Commit message** : Décrivez vos modifications, par exemple :
     ```
     fix: Correction bug touchesPswSuggestions et ajout touches_psw
     
     - Ajout du champ touches_psw dans l'initialisation du formulaire FichesModule
     - Correction de l'erreur ReferenceError sur la page Fiches Techniques
     - Amélioration de la stabilité de l'application
     ```

5. **Confirmer la sauvegarde**
   - Cliquez sur "Save" ou "Push to GitHub"
   - Attendez la confirmation de succès

#### ⚠️ Important
**NE PAS** essayer de faire des commandes `git push` manuellement depuis le terminal de l'environnement Emergent. Utilisez toujours la fonctionnalité intégrée "Save to GitHub".

---

## 2. 🚀 Déploiement en production {#deploiement-production}

### Option A : Déploiement Emergent (Natif)

#### Étapes :

1. **Après avoir sauvegardé sur GitHub**, retournez à l'interface principale d'Emergent

2. **Accéder à la section "Deployments"**
   - Vous devriez voir vos déploiements existants
   - Votre URL actuelle : `smart-company-hub-2.emergent.host`

3. **Créer un nouveau déploiement**
   - Cliquez sur "New Deployment" ou "Redeploy"
   - Sélectionnez la **branche GitHub** que vous venez de sauvegarder
   - Sélectionnez le **commit le plus récent**

4. **Configuration du déploiement**
   - **Nom** : `trinity-production` (ou gardez le nom existant)
   - **Variables d'environnement** : Vérifiez qu'elles sont bien configurées
     - `MONGO_URL` : Votre base MongoDB de production
     - `DB_NAME` : Nom de votre base de données
     - `REACT_APP_BACKEND_URL` : URL de votre backend déployé

5. **Lancer le déploiement**
   - Cliquez sur "Deploy"
   - Attendez la fin du build (5-10 minutes généralement)

6. **Vérifier le statut**
   - Le statut doit passer de "Building" à "Running"
   - Vous recevrez une notification une fois le déploiement terminé

### Option B : Déploiement sur une autre plateforme

Si vous souhaitez déployer sur **Vercel**, **Railway**, ou une autre plateforme :

1. **Connectez votre repository GitHub** à la plateforme choisie
2. **Configurez les variables d'environnement** (voir ci-dessous)
3. **Lancez le déploiement** depuis l'interface de la plateforme

#### Variables d'environnement nécessaires :

**Backend (.env)** :
```env
MONGO_URL=mongodb://votre-serveur:27017
DB_NAME=trinity_production
```

**Frontend (.env)** :
```env
REACT_APP_BACKEND_URL=https://votre-backend-url.com
```

---

## 3. ✅ Vérification du déploiement {#verification}

### Checklist de vérification

Après le déploiement, vérifiez les points suivants :

#### 1. Page d'accueil (Dashboard)
- [ ] La page se charge sans erreur
- [ ] Les KPIs s'affichent correctement
- [ ] Les données des restaurants sont présentes

#### 2. Page "Fiches Techniques"
- [ ] La page s'affiche (pas d'écran blanc)
- [ ] Le bouton "+ Nouvelle Fiche" est visible
- [ ] Pas d'erreur JavaScript dans la console (F12)
- [ ] Le formulaire de création de fiche s'ouvre correctement

#### 3. Fonctionnalité "Touches PSW"
- [ ] Le bouton "📋 Charger les produits de ce restaurant" fonctionne
- [ ] Les suggestions de produits s'affichent
- [ ] On peut ajouter des touches PSW au formulaire

#### 4. Console navigateur
- [ ] Ouvrir la console (F12 > Console)
- [ ] **Aucune erreur rouge** ne doit apparaître
- [ ] Les warnings sont acceptables (WebSocket, etc.)

### 🔍 Comment tester

1. **Ouvrir une fenêtre de navigation privée** (Ctrl+Shift+N ou Cmd+Shift+N)
2. **Vider le cache si nécessaire** :
   - Chrome/Edge : F12 > Network > Cocher "Disable cache"
   - Firefox : F12 > Network > Cocher "Disable HTTP Cache"
3. **Accéder à votre URL de production** : `https://smart-company-hub-2.emergent.host`
4. **Tester chaque page** selon la checklist ci-dessus

---

## 4. 🛠️ Résolution des problèmes courants {#troubleshooting}

### Problème 1 : "Les modifications ne sont pas visibles"

**Causes possibles :**
- Cache du navigateur
- Ancien build déployé
- Modifications non sauvegardées sur GitHub

**Solutions :**
1. **Vider complètement le cache** :
   - Chrome : `Ctrl+Shift+Delete` > "Cached images and files" > Clear
   - Ou utiliser mode Incognito
2. **Vérifier que le commit est bien sur GitHub** :
   - Allez sur votre repository GitHub
   - Vérifiez que le dernier commit contient vos modifications
3. **Redéployer** en sélectionnant le bon commit

### Problème 2 : "Erreur JavaScript persistante"

**Vérification :**
1. Ouvrir la console (F12)
2. Noter l'erreur exacte
3. Vérifier le numéro de ligne (ex: `App.js:3165`)

**Solutions :**
- Si l'erreur concerne `touchesPswSuggestions` :
  - Vérifiez que le commit déployé contient la ligne `touches_psw: []` dans l'initialisation du formulaire
  - Si non, redéployez avec le bon commit
- Si l'erreur est différente :
  - Contactez le support ou revenez sur Emergent pour correction

### Problème 3 : "QuotaExceededError"

**Cause :** Stockage local du navigateur plein

**Solution :**
1. Ouvrir la console (F12)
2. Aller dans l'onglet "Application" (Chrome) ou "Storage" (Firefox)
3. Cliquer sur "Clear storage" ou "Clear all"
4. Recharger la page

### Problème 4 : "API ne répond pas (Network Error)"

**Vérifications :**
1. **Backend est démarré** :
   - L'URL backend doit répondre (tester : `https://votre-backend.com/api/restaurants`)
2. **CORS configuré** :
   - Le backend doit autoriser votre frontend
3. **Variables d'environnement** :
   - `REACT_APP_BACKEND_URL` doit pointer vers le bon backend

**Solution :**
- Vérifier les logs du backend dans l'interface de déploiement
- Vérifier que `REACT_APP_BACKEND_URL` est correct dans le frontend

---

## 📊 Architecture de déploiement

```
┌─────────────────────────────────────────────────────────┐
│                    GITHUB REPOSITORY                     │
│                  (Code source + historique)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ git pull / deploy
                     │
         ┌───────────▼──────────────┐
         │   EMERGENT DEPLOYMENT    │
         │  (Build + Containerisation)│
         └───────────┬──────────────┘
                     │
         ┌───────────▼──────────────────────────┐
         │   PRODUCTION ENVIRONMENT             │
         │                                       │
         │  ┌──────────┐      ┌──────────┐     │
         │  │ Frontend │      │ Backend  │     │
         │  │  (React) │◄────►│ (FastAPI)│     │
         │  │  Port 80 │      │ Port 8001│     │
         │  └──────────┘      └─────┬────┘     │
         │                          │           │
         │                    ┌─────▼──────┐   │
         │                    │  MongoDB   │   │
         │                    └────────────┘   │
         └──────────────────────────────────────┘
                     │
                     │ HTTPS
                     │
         ┌───────────▼──────────────┐
         │      UTILISATEURS        │
         │ smart-company-hub-2      │
         │   .emergent.host         │
         └──────────────────────────┘
```

---

## 📝 Changelog des corrections récentes

### Version actuelle (Mars 2026)

#### ✅ Corrections apportées dans ce fork :

1. **Bug critique : Page "Fiches Techniques" vide**
   - **Problème** : `ReferenceError: touchesPswSuggestions is not defined`
   - **Cause** : Champ `touches_psw` non initialisé dans le state du formulaire
   - **Solution** : Ajout de `touches_psw: []` dans l'initialisation du formulaire (ligne 2304 de App.js)
   - **Impact** : La page "Fiches Techniques" fonctionne désormais correctement

#### 📁 Fichiers modifiés :
- `/app/frontend/src/App.js` (ligne 2304)

#### 🧪 Tests effectués :
- ✅ Page "Fiches Techniques" s'affiche correctement
- ✅ Formulaire de création de fiche fonctionne
- ✅ Champ "Touches PSW" accessible
- ✅ Aucune erreur JavaScript dans la console

---

## 💡 Bonnes pratiques

### Avant chaque déploiement :

1. **Tester localement** (environnement de preview)
2. **Sauvegarder sur GitHub** avec un message de commit descriptif
3. **Créer un backup de la base de données** (si modifications critiques)
4. **Déployer en dehors des heures de pointe** si possible
5. **Vérifier immédiatement** après le déploiement

### Après chaque déploiement :

1. **Tester les fonctionnalités critiques** (checklist ci-dessus)
2. **Surveiller les logs** pendant les premières minutes
3. **Informer les utilisateurs** si des changements majeurs
4. **Garder l'ancien déploiement actif** quelques minutes (rollback possible)

---

## 🆘 Support

Si vous rencontrez des problèmes non résolus par ce guide :

1. **Vérifiez les logs** :
   - Backend : Dans l'interface de déploiement Emergent
   - Frontend : Console du navigateur (F12)

2. **Revenez sur l'environnement Emergent** :
   - Demandez de l'aide à l'agent
   - Fournissez les erreurs exactes et les captures d'écran

3. **Rollback si nécessaire** :
   - Revenez à un déploiement précédent stable
   - Depuis l'interface Emergent > Deployments > Version précédente

---

## 📚 Ressources utiles

- Documentation Emergent : [emergent.ai](https://emergent.ai)
- Repository GitHub : [Votre repo]
- URL de production : `https://smart-company-hub-2.emergent.host`
- URL de preview (dev) : Disponible dans l'interface Emergent

---

**Dernière mise à jour** : 9 mars 2026  
**Version** : 1.0  
**Auteur** : Agent E1 - Emergent
