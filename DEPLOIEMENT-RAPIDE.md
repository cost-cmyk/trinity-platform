# 🚀 Guide Rapide - Déploiement Trinity

## 📋 Checklist de déploiement

### 1. Sauvegarde sur GitHub
- [ ] Ouvrir l'interface Emergent
- [ ] Cliquer sur **"Save to GitHub"**
- [ ] Écrire un message de commit descriptif
- [ ] Confirmer la sauvegarde
- [ ] Attendre la confirmation de succès

### 2. Déploiement
- [ ] Aller dans la section **"Deployments"**
- [ ] Cliquer sur **"New Deployment"** ou **"Redeploy"**
- [ ] Sélectionner la **branche** et le **commit** les plus récents
- [ ] Vérifier les **variables d'environnement**
- [ ] Cliquer sur **"Deploy"**
- [ ] Attendre la fin du build (5-10 min)

### 3. Vérification
- [ ] Ouvrir une **fenêtre de navigation privée**
- [ ] Aller sur `https://smart-company-hub-2.emergent.host`
- [ ] Tester la page **Dashboard**
- [ ] Tester la page **Fiches Techniques**
- [ ] Ouvrir la **console** (F12) → aucune erreur rouge
- [ ] Tester la création d'une **fiche technique**

---

## ⚠️ Points d'attention

### ❌ À NE PAS FAIRE
- ❌ Faire `git push` manuellement depuis le terminal
- ❌ Modifier directement les fichiers en production
- ❌ Déployer sans avoir sauvegardé sur GitHub

### ✅ À FAIRE
- ✅ Toujours utiliser "Save to GitHub" via l'interface
- ✅ Tester en navigation privée après déploiement
- ✅ Vérifier la console navigateur (F12)
- ✅ Faire un backup de la base avant déploiements majeurs

---

## 🔧 Résolution rapide

### Problème : Modifications non visibles
**Solution** :
1. Vider le cache (Ctrl+Shift+Delete)
2. Ouvrir en navigation privée
3. Vérifier que le bon commit est déployé

### Problème : Erreur JavaScript
**Solution** :
1. F12 > Console > Noter l'erreur
2. Vérifier que le dernier commit contient les corrections
3. Redéployer si nécessaire

### Problème : QuotaExceededError
**Solution** :
1. F12 > Application > Clear storage
2. Recharger la page

---

## 📞 Support

**Si ça ne fonctionne toujours pas** :
1. Revenir sur l'environnement Emergent
2. Fournir les erreurs de la console (F12)
3. Envoyer une capture d'écran

---

## 🎯 Correction actuelle à déployer

### Bug corrigé : Page "Fiches Techniques" vide

**Fichier modifié** : `/app/frontend/src/App.js` (ligne 2304)

**Modification** :
```javascript
// Avant (manquant)
const [form, setForm] = useState({
  nom: "", 
  restaurant_id: "", 
  // ...
  linked_produit_ids: [],
  // touches_psw MANQUAIT ICI !
  photo_url: null
});

// Après (corrigé)
const [form, setForm] = useState({
  nom: "", 
  restaurant_id: "", 
  // ...
  linked_produit_ids: [],
  touches_psw: [], // ✅ AJOUTÉ
  photo_url: null
});
```

**Impact** : La page "Fiches Techniques" fonctionne maintenant sans erreur.

---

**Version** : 1.0 | **Date** : 9 mars 2026
