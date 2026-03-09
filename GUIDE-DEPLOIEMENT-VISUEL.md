# 🚀 Guide Visuel : Créer un Nouveau Déploiement sur Emergent

## 📍 Où créer un déploiement ?

Il existe **DEUX façons** de créer un déploiement sur Emergent :

---

## 🎯 MÉTHODE 1 : Via l'Interface de Chat (Plus Simple)

### Étape 1 : Localiser le bouton "Deploy" ou "Native Deploy"

Dans l'interface de chat où vous travaillez actuellement, regardez :

**Option A - En bas de l'écran** :
```
┌─────────────────────────────────────────────────────┐
│  [💬 Message input box]                             │
│  ┌──────────┬──────────┬──────────┬──────────────┐ │
│  │ 📁 Save  │ 🚀 Deploy│ 📦 Export│ 🔄 Rollback  │ │
│  │to GitHub │          │   Code   │              │ │
│  └──────────┴──────────┴──────────┴──────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Option B - Menu en haut à droite** :
```
┌─────────────────────────────────────────────────────┐
│  Trinity - Gestion Restaurant    [⚙️] [🎯] [☰ Menu]│
└─────────────────────────────────────────────────────┘
                                          ↑
                                     Cliquez ici
```

### Étape 2 : Cliquer sur "Deploy" ou "Native Deploy"

Vous verrez apparaître une fenêtre modale comme celle-ci :

```
┌─────────────────────────────────────────────────────┐
│  🚀 Déployer votre application                   [X]│
├─────────────────────────────────────────────────────┤
│                                                     │
│  📝 Nom du déploiement                              │
│  ┌─────────────────────────────────────────────┐   │
│  │ trinity-production                          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  🔗 Domaine (optionnel)                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ smart-company-hub-2                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ⚙️ Variables d'environnement                       │
│  ☑️ Utiliser les variables existantes              │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │  [🚀 Créer le déploiement]                  │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Étape 3 : Configurer le déploiement

**Champs à remplir :**

1. **Nom du déploiement** :
   - Exemple : `trinity-production-v2`
   - Ou gardez le nom existant si vous remplacez : `trinity-production`

2. **Domaine** :
   - Si vous voulez garder le même : `smart-company-hub-2`
   - Ou créez un nouveau sous-domaine : `trinity-app`

3. **Variables d'environnement** :
   - ✅ Cochez "Utiliser les variables existantes"
   - Ou cliquez sur "Configurer" si vous devez les modifier

### Étape 4 : Lancer le déploiement

1. Cliquez sur le bouton **"🚀 Créer le déploiement"**
2. Une notification apparaît : "Déploiement en cours..."

### Étape 5 : Suivre la progression

Vous verrez un écran de progression :

```
┌─────────────────────────────────────────────────────┐
│  🚀 Déploiement en cours...                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⏳ Étapes :                                        │
│                                                     │
│  ✅ 1. Préparation de l'environnement              │
│  ✅ 2. Installation des dépendances backend        │
│  ⏳ 3. Installation des dépendances frontend...    │
│  ⬜ 4. Build du frontend                           │
│  ⬜ 5. Démarrage des services                      │
│  ⬜ 6. Tests de santé                              │
│                                                     │
│  📊 Temps estimé : 5-10 minutes                     │
│                                                     │
│  [📋 Voir les logs]                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Étape 6 : Déploiement terminé

Une fois terminé, vous verrez :

```
┌─────────────────────────────────────────────────────┐
│  ✅ Déploiement réussi !                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🎉 Votre application est en ligne !                │
│                                                     │
│  🔗 URL : https://smart-company-hub-2.emergent.host │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [🌐 Ouvrir l'application]                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [📊 Voir les métriques]                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 MÉTHODE 2 : Via le Dashboard Emergent

Si vous ne trouvez pas le bouton dans le chat, vous pouvez passer par le dashboard principal :

### Étape 1 : Accéder au Dashboard

1. Allez sur **https://app.emergent.ai** (ou votre URL Emergent)
2. Connectez-vous avec votre compte

### Étape 2 : Trouver votre projet

```
┌─────────────────────────────────────────────────────┐
│  🏠 Mes Projets                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📁 Trinity - Gestion Restaurant                    │
│  smart-company-hub-2                                │
│  Dernière modification : Il y a 5 minutes           │
│                                                     │
│  [💬 Ouvrir le chat] [🚀 Deploy] [⚙️ Settings]     │
│                                                     │
└─────────────────────────────────────────────────────┘
                           ↑
                    Cliquez ici
```

### Étape 3 : Cliquer sur "Deploy"

Vous arriverez sur l'interface de déploiement (similaire à la Méthode 1)

### Étape 4 : Suivre les mêmes étapes que la Méthode 1

(Voir les étapes 3-6 de la Méthode 1 ci-dessus)

---

## 🔧 Configuration Avancée (Optionnel)

### Si vous voulez modifier les variables d'environnement :

Décochez "Utiliser les variables existantes" et configurez :

#### Backend (.env)
```env
MONGO_URL=mongodb://votre-serveur:27017
DB_NAME=trinity_production
```

#### Frontend (.env)
```env
REACT_APP_BACKEND_URL=https://votre-backend-url.com
```

⚠️ **Attention** : Si vous utilisez une base MongoDB existante avec des données, assurez-vous que `MONGO_URL` et `DB_NAME` pointent vers la bonne base !

---

## 📝 Checklist avant de déployer

Avant de cliquer sur "Créer le déploiement", vérifiez :

- [ ] Vous avez **sauvegardé sur GitHub** (bouton "Save to GitHub")
- [ ] Le **nom du déploiement** est correct
- [ ] Le **domaine** est correct (ou nouveau si vous voulez un nouveau domaine)
- [ ] Les **variables d'environnement** sont configurées
- [ ] Vous avez un **backup de la base de données** (si données importantes)

---

## ⏱️ Durée du déploiement

**Temps moyen** : 5-10 minutes

**Détail des étapes** :
- ⏳ Préparation : 30 secondes
- ⏳ Installation dépendances backend : 1-2 minutes
- ⏳ Installation dépendances frontend : 2-3 minutes
- ⏳ Build frontend : 2-3 minutes
- ⏳ Démarrage services : 30 secondes
- ⏳ Tests de santé : 30 secondes

---

## 🚨 Que faire si le déploiement échoue ?

### Erreur : "Build failed"

**Solutions** :
1. Vérifier les logs de build (cliquer sur "Voir les logs")
2. Vérifier qu'il n'y a pas d'erreurs de syntaxe dans votre code
3. Réessayer le déploiement

### Erreur : "Health check failed"

**Solutions** :
1. Vérifier que les variables d'environnement sont correctes
2. Vérifier que MongoDB est accessible
3. Vérifier les logs backend

### Le déploiement se bloque

**Solutions** :
1. Attendre 2-3 minutes supplémentaires
2. Rafraîchir la page
3. Si ça persiste plus de 15 minutes, contacter le support

---

## 🎉 Après le déploiement

### 1. Tester l'application

- [ ] Ouvrir l'URL en navigation privée
- [ ] Tester la page Dashboard
- [ ] Tester la page Fiches Techniques
- [ ] Ouvrir la console (F12) : pas d'erreur rouge

### 2. Vérifier les métriques

Dans le dashboard Emergent, vous pouvez voir :
- 📊 **CPU et RAM** utilisés
- 🔄 **Requêtes par minute**
- ⏱️ **Temps de réponse**
- ❌ **Erreurs** éventuelles

### 3. Surveiller les logs

Pendant les premières minutes, gardez un œil sur les logs pour détecter d'éventuels problèmes.

---

## 💡 Astuces

### Astuce 1 : Déploiement de test
Avant de déployer sur votre domaine principal, vous pouvez créer un déploiement de test avec un nouveau nom :
- Nom : `trinity-test`
- Domaine : `trinity-test`

### Astuce 2 : Rollback rapide
Si quelque chose ne va pas, vous pouvez revenir à la version précédente :
1. Dashboard > Deployments
2. Cliquer sur la version précédente
3. Cliquer sur "Rollback"

### Astuce 3 : URL de preview
Vous pouvez toujours tester sur l'URL de preview avant de déployer :
- Format : `https://[id-unique].preview.emergentagent.com`
- Disponible dans l'interface de chat

---

## 📞 Support

Si vous ne trouvez pas les boutons mentionnés :

1. **Dans le chat Emergent**, tapez :
   ```
   Comment créer un déploiement ?
   ```

2. **Ou demandez-moi** :
   ```
   Où se trouve le bouton Deploy ?
   ```

3. **Support Emergent** :
   - Email : support@emergent.ai
   - Documentation : https://docs.emergent.ai

---

## 🔄 Mise à jour d'un déploiement existant

Si vous voulez **mettre à jour** un déploiement existant au lieu d'en créer un nouveau :

### Option A : Redéployer sur le même domaine
1. Suivre les mêmes étapes
2. Utiliser le **même nom de domaine** : `smart-company-hub-2`
3. L'ancien déploiement sera remplacé automatiquement

### Option B : Déploiement progressif (Blue-Green)
1. Créer un nouveau déploiement avec un nouveau nom : `trinity-production-v2`
2. Tester sur le nouveau domaine
3. Une fois validé, pointer votre domaine principal vers le nouveau déploiement
4. Supprimer l'ancien déploiement

---

**Version** : 1.0  
**Date** : 9 mars 2026  
**Auteur** : Agent E1 - Emergent Labs
