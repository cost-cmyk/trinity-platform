import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { UploadCloud, X, Trash2, FileText, AlertCircle, Info, FileSpreadsheet } from "lucide-react";
import { fmt, fmtPrice } from "@/utils/format";
import API from "@/utils/api";

const ImportModule = ({ restaurants, onRefresh }) => {
  const [activeTab, setActiveTab] = useState("ventes"); // ventes, carte, achats, budget, historique
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [imports, setImports] = useState([]);
  
  // États pour les filtres d'historique
  const [historyTypeFilter, setHistoryTypeFilter] = useState("tous"); // tous, ventes, produits, achats, budget
  const [historyDateFilter, setHistoryDateFilter] = useState(""); // YYYY-MM format
  
  // État de prévisualisation VENTES
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [excluded, setExcluded] = useState({});
  const [annotations, setAnnotations] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  
  // État CARTE
  const [cartePreview, setCartePreview] = useState(null);
  const [carteLoading, setCarteLoading] = useState(false);
  const [carteFile, setCarteFile] = useState(null);
  
  // État ACHATS
  const [achatsPreview, setAchatsPreview] = useState(null);
  const [achatsLoading, setAchatsLoading] = useState(false);
  const [achatsFile, setAchatsFile] = useState(null);
  const [achatsRestaurant, setAchatsRestaurant] = useState(null);
  
  // État BUDGET
  const [budgetPreview, setBudgetPreview] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetFile, setBudgetFile] = useState(null);
  const [budgetMois, setBudgetMois] = useState("");


  // Charger l'historique des imports
  useEffect(() => {
    const loadImports = async () => {
      try {
        const res = await axios.get(`${API}/imports`);
        console.log(`📊 Imports chargés depuis l'API: ${res.data.length}`);
        console.log('Détails:', res.data.map(imp => ({ id: imp.id.substring(0, 8), nom: imp.nom_fichier })));
        setImports(res.data);
      } catch (err) {
        console.error("Erreur chargement imports:", err);
      }
    };
    loadImports();
  }, []);

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer?.files || e.target.files || []);
    
    if (droppedFiles.length === 1) {
      // Un seul fichier = prévisualisation directe
      await loadPreview(droppedFiles[0]);
    } else {
      // Plusieurs fichiers = mode file d'attente
      processFiles(droppedFiles);
    }
  };

  const loadPreview = async (file) => {
    setPreviewLoading(true);
    setPreviewFile(file);
    setExcluded({});
    setAnnotations({});
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/imports/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setPreview(response.data);
      // Ne PAS auto-exclure les lignes avec remises négatives
      // La ligne est conservée, seule la remise est mise à 0
      setExcluded({});
      
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const processFiles = (newFiles) => {
    const processed = newFiles.map((file) => {
      const name = file.name.toLowerCase();
      let detectedRestaurant = null;
      let detectedDate = null;

      for (const resto of restaurants) {
        if (name.includes(resto.code.toLowerCase()) || name.includes(resto.nom.toLowerCase())) {
          detectedRestaurant = resto;
          break;
        }
      }

      const dateMatch = name.match(/(\d{4})(\d{2})(\d{2})/);
      if (dateMatch) {
        detectedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }

      return {
        file,
        name: file.name,
        size: file.size,
        restaurant: detectedRestaurant,
        date: detectedDate || new Date().toISOString().split('T')[0],
        status: "pending",  // pending, previewing, validated, importing, success, error
        error: null,
        result: null,
        previewData: null,   // Données de prévisualisation
        excluded: {},        // Lignes exclues {idx: true/false}
        validated: false     // Est-ce que le fichier a été validé ?
      };
    });

    setFiles([...files, ...processed]);
  };

  const toggleExclude = (idx) => {
    setExcluded(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleExcludeAll = (exclude) => {
    if (!preview) return;
    const newExcluded = {};
    preview.lignes.forEach(l => {
      newExcluded[l.idx] = exclude;
    });
    setExcluded(newExcluded);
  };

  const setAnnotation = (idx, note) => {
    setAnnotations(prev => ({ ...prev, [idx]: note }));
  };

  const confirmImport = async () => {
    if (!preview) return;
    
    const restaurant_id = preview.detected_restaurant_id;
    if (!restaurant_id) {
      toast.error("Sélectionnez un restaurant");
      return;
    }
    
    setImporting(true);
    
    try {
      // Préparer les lignes avec exclusions et annotations
      const lignes = preview.lignes.map(l => ({
        ...l,
        exclu: excluded[l.idx] || false,
        annotation: annotations[l.idx] || ""
      }));
      
      const response = await axios.post(`${API}/imports/confirm`, {
        restaurant_id,
        date_vente: preview.detected_date,
        filename: preview.filename,
        lignes
      });
      
      toast.success(response.data.message + ` (${response.data.nb_exclues} exclues)`);
      
      // Reset
      setPreview(null);
      setPreviewFile(null);
      setExcluded({});
      setAnnotations({});
      onRefresh();
      
      // Recharger historique
      const res = await axios.get(`${API}/imports`);
      setImports(res.data);
      
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
    }
  };

  // Prévisualiser un fichier de la file d'attente
  const previewQueuedFile = async (fileIndex) => {
    const fileItem = files[fileIndex];
    if (!fileItem || !fileItem.restaurant) {
      toast.error("Sélectionnez un restaurant d'abord");
      return;
    }

    // Mettre à jour le statut
    updateFile(fileIndex, { status: "previewing" });

    try {
      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('restaurant_id', fileItem.restaurant.id);
      formData.append('date_vente', fileItem.date);

      const response = await axios.post(`${API}/imports/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Stocker les données de prévisualisation dans le fichier
      updateFile(fileIndex, {
        previewData: response.data,
        status: "previewed"
      });

      toast.success(`Prévisualisation chargée: ${response.data.nb_lignes} lignes`);

    } catch (err) {
      toast.error("Erreur prévisualisation: " + (err.response?.data?.detail || err.message));
      updateFile(fileIndex, { 
        status: "error",
        error: err.response?.data?.detail || err.message
      });
    }
  };

  // Valider un fichier après prévisualisation
  const validateQueuedFile = (fileIndex) => {
    const fileItem = files[fileIndex];
    if (!fileItem.previewData) {
      toast.error("Prévisualisez le fichier d'abord");
      return;
    }

    updateFile(fileIndex, {
      validated: true,
      status: "validated"
    });

    toast.success(`Fichier validé: ${fileItem.name}`);
  };

  // Basculer l'exclusion d'une ligne dans un fichier de la file
  const toggleQueuedFileLineExclusion = (fileIndex, lineIdx) => {
    const fileItem = files[fileIndex];
    const newExcluded = { ...fileItem.excluded };
    newExcluded[lineIdx] = !newExcluded[lineIdx];
    
    updateFile(fileIndex, { excluded: newExcluded });
  };

  const cancelPreview = () => {
    setPreview(null);
    setPreviewFile(null);
    setExcluded({});
    setAnnotations({});
  };

  const updateFile = (idx, updates) => {
    setFiles(files.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const removeFile = (idx) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const uploadFiles = async () => {
    setImporting(true);

    // Ne traiter que les fichiers validés
    const validatedFiles = files.filter(f => f.validated && f.status === "validated");
    
    if (validatedFiles.length === 0) {
      toast.error("Aucun fichier validé à importer");
      setImporting(false);
      return;
    }

    // Importer chaque fichier validé
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      
      if (!f.validated || f.status !== "validated") continue;
      
      updateFile(i, { status: "importing" });
      
      try {
        // Préparer les lignes avec exclusions
        const lignes = f.previewData.lignes.map(l => ({
          ...l,
          exclu: f.excluded[l.idx] || false,
          annotation: ""
        }));

        const response = await axios.post(`${API}/imports/confirm`, {
          restaurant_id: f.restaurant.id,
          date_vente: f.date,
          filename: f.name,
          lignes
        });

        updateFile(i, { status: "success", result: response.data });
        toast.success(`✅ ${f.name}: ${response.data.nb_lignes} lignes importées`);

      } catch (err) {
        const errorMsg = err.response?.data?.detail || err.message;
        updateFile(i, { status: "error", error: errorMsg });
        toast.error(`❌ ${f.name}: ${errorMsg}`);
      }
    }

    setImporting(false);
    
    // Recharger l'historique
    try {
      const res = await axios.get(`${API}/imports`);
      setImports(res.data);
      onRefresh();
    } catch (err) {
      console.error("Erreur rechargement imports:", err);
    }
  };
  const deleteImport = async (importId) => {
    if (!window.confirm("Supprimer cet import et toutes ses ventes ?")) return;
    try {
      await axios.delete(`${API}/imports/${importId}`);
      setImports(imports.filter(i => i.id !== importId));
      toast.success("Import supprimé");
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    }
  };

  const getRestaurantById = (id) => restaurants.find(r => r.id === id);
  
  // Filtrer les imports selon les filtres de l'onglet Historique
  const filteredImports = imports.filter(imp => {
    // Filtre par type
    if (historyTypeFilter !== "tous") {
      const typeMap = {
        "ventes": "ventes",
        "produits": "produits",
        "achats": "achats",
        "budget": "budget"
      };
      const expectedType = typeMap[historyTypeFilter];
      // Utiliser imp.type (pas imp.type_import)
      const importType = imp.type || imp.type_import || "ventes";
      if (importType !== expectedType) return false;
    }
    
    // Filtre par date (mois)
    if (historyDateFilter) {
      const importDate = imp.date_import ? imp.date_import.substring(0, 7) : "";
      if (importDate !== historyDateFilter) return false;
    }
    
    return true;
  });

  // Calculs preview
  const activeLignes = preview ? preview.lignes.filter(l => !excluded[l.idx]) : [];
  const activeCA = activeLignes.reduce((sum, l) => sum + l.ca_ttc, 0);
  const activeQty = activeLignes.reduce((sum, l) => sum + l.quantite, 0);
  const activeRemise = activeLignes.reduce((sum, l) => sum + l.remise, 0);
  const excludedCount = preview ? Object.values(excluded).filter(Boolean).length : 0;
  
  // Lignes avec remises négatives (pour affichage détail)
  const lignesRemiseNegative = preview ? preview.lignes.filter(l => l.is_remise_negative) : [];

  const pendingCount = files.filter(f => f.status === "pending" || f.status === "previewed" || f.status === "validated").length;
  const validatedCount = files.filter(f => f.validated).length;
  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;

  // Mode prévisualisation
  if (preview) {
    return (
      <div className="space-y-6" data-testid="import-preview">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Contrôle de l'import</h1>
            <p className="text-muted-foreground">{preview.filename}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={cancelPreview}>
              Annuler
            </Button>
            <Button onClick={confirmImport} disabled={importing || activeLignes.length === 0} data-testid="confirm-import-btn">
              {importing ? "Import..." : `Valider l'import (${activeLignes.length} lignes)`}
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <KPICard label="Lignes totales" value={preview.nb_lignes} icon={FileSpreadsheet} />
          <KPICard label="Lignes actives" value={activeLignes.length} color="text-emerald-400" />
          <KPICard label="Exclues" value={excludedCount} color="text-amber-400" />
          <KPICard label="CA Total" value={fmtK(activeCA)} suffix="F" icon={TrendingUp} />
          <KPICard label="Total Remises" value={fmtK(activeRemise)} suffix="F" color="text-purple-400" />
          <KPICard label="Nourriture" value={preview.nb_food} color="text-orange-400" />
          <KPICard label="Boissons" value={preview.nb_drink} color="text-cyan-400" />
        </div>

        {/* Alertes remises négatives avec détail */}
        {lignesRemiseNegative.length > 0 && (
          <div className="trinity-card bg-amber-500/10 border-amber-500/50">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <span className="font-medium text-amber-400">{lignesRemiseNegative.length} remise(s) négative(s) détectée(s)</span>
                <span className="text-sm text-muted-foreground ml-2">(bug PSW - remises mises à 0, lignes conservées)</span>
              </div>
            </div>
            <div className="text-sm space-y-1 pl-8">
              {lignesRemiseNegative.map((l, idx) => (
                <div key={idx} className="flex justify-between text-muted-foreground">
                  <span>{l.produit_nom}</span>
                  <span className="font-mono text-amber-400">Remise ignorée</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restaurant et Date */}
        <div className="flex gap-4">
          <Select
            label="Restaurant"
            value={preview.detected_restaurant_id || ""}
            onChange={(v) => setPreview({...preview, detected_restaurant_id: v, restaurant: restaurants.find(r => r.id === v)})}
            options={restaurants.map(r => ({ value: r.id, label: r.nom }))}
            placeholder="Sélectionner *"
            className="w-64"
          />
          <Input
            label="Date de vente"
            type="date"
            value={preview.detected_date || ""}
            onChange={(v) => setPreview({...preview, detected_date: v})}
            className="w-48"
          />
          <div className="flex items-end gap-2">
            <Button variant="ghost" onClick={() => toggleExcludeAll(false)} className="text-xs">
              Tout inclure
            </Button>
            <Button variant="ghost" onClick={() => toggleExcludeAll(true)} className="text-xs">
              Tout exclure
            </Button>
          </div>
        </div>

        {/* Tableau des lignes */}
        <div className="trinity-card overflow-hidden p-0 max-h-[500px] overflow-y-auto">
          <table className="trinity-table">
            <thead className="sticky top-0 bg-card z-10">
              <tr>
                <th className="w-12">
                  <input 
                    type="checkbox" 
                    checked={excludedCount === 0}
                    onChange={(e) => toggleExcludeAll(!e.target.checked)}
                    className="rounded"
                  />
                </th>
                <th>Produit</th>
                <th>Famille</th>
                <th>Code Pro</th>
                <th>Type</th>
                <th className="text-right">Qté</th>
                <th className="text-right">PU</th>
                <th className="text-right">CA HT</th>
                <th className="text-right">CA TTC</th>
                <th className="text-right">Remise</th>
                <th className="w-20">Note</th>
              </tr>
            </thead>
            <tbody>
              {preview.lignes.map((ligne) => {
                const isExcluded = excluded[ligne.idx];
                const isRemiseNeg = ligne.is_remise_negative;
                return (
                  <tr 
                    key={ligne.idx} 
                    className={`${isExcluded ? 'opacity-40 line-through' : ''} ${isRemiseNeg ? 'bg-amber-500/10' : ''}`}
                  >
                    <td>
                      <input 
                        type="checkbox" 
                        checked={!isExcluded}
                        onChange={() => toggleExclude(ligne.idx)}
                        className="rounded"
                      />
                    </td>
                    <td className="font-medium">{ligne.produit_nom}</td>
                    <td className="text-sm text-muted-foreground">{ligne.famille || '—'}</td>
                    <td className="text-sm text-muted-foreground font-mono">{ligne.code_pro || '—'}</td>
                    <td>
                      <Pill type={ligne.is_food ? "food" : "drink"}>
                        {ligne.is_food ? "N" : "B"}
                      </Pill>
                    </td>
                    <td className="text-right font-mono">{ligne.quantite}</td>
                    <td className="text-right font-mono">{fmtPrice(ligne.prix_unitaire)}</td>
                    <td className="text-right font-mono text-sm text-muted-foreground">{ligne.ca_ht ? fmtPrice(ligne.ca_ht) : '—'}</td>
                    <td className="text-right font-mono">{fmtPrice(ligne.ca_ttc)}</td>
                    <td className={`text-right font-mono ${isRemiseNeg ? 'text-amber-400' : ''}`}>
                      {ligne.remise !== 0 ? fmtPrice(ligne.remise) : '—'}
                    </td>
                    <td>
                      {editingNote === ligne.idx ? (
                        <input
                          type="text"
                          value={annotations[ligne.idx] || ""}
                          onChange={(e) => setAnnotation(ligne.idx, e.target.value)}
                          onBlur={() => setEditingNote(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingNote(null)}
                          className="trinity-input text-xs w-full"
                          autoFocus
                        />
                      ) : (
                        <button 
                          onClick={() => setEditingNote(ligne.idx)}
                          className={`p-1 rounded hover:bg-accent ${annotations[ligne.idx] ? 'text-cyan-400' : 'text-muted-foreground'}`}
                          title={annotations[ligne.idx] || "Ajouter une note"}
                        >
                          {annotations[ligne.idx] ? '📝' : '✏️'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Résumé */}
        <div className="trinity-card bg-secondary/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-medium">Résumé de l'import</span>
              <p className="text-sm text-muted-foreground mt-1">
                {activeLignes.length} lignes seront importées ({excludedCount} exclues)
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold">{fmtPrice(activeCA)}</div>
              <div className="text-sm text-muted-foreground">{activeQty} articles</div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // ========== HANDLERS IMPORT CARTE ==========
  const handleCarteFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCarteLoading(true);
    setCarteFile(file);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/imports/carte/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setCartePreview(response.data);
      toast.success(`${response.data.nb_produits} produits détectés`);
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
      setCartePreview(null);
    } finally {
      setCarteLoading(false);
    }
  };
  
  const confirmCarteImport = async () => {
    if (!cartePreview) return;
    
    setImporting(true);
    
    try {
      const response = await axios.post(`${API}/imports/carte/confirm`, {
        restaurants: cartePreview.restaurants,
        produits: cartePreview.produits,
        filename: carteFile?.name || 'carte.xlsx'
      });
      
      toast.success(response.data.message);
      setCartePreview(null);
      setCarteFile(null);
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
    }
  };
  
  // ========== HANDLERS IMPORT ACHATS ==========
  const handleAchatsFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setAchatsLoading(true);
    setAchatsFile(file);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/imports/achats/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setAchatsPreview(response.data);
      toast.success(`${response.data.nb_achats} lignes d'achats détectées`);
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
      setAchatsPreview(null);
    } finally {
      setAchatsLoading(false);
    }
  };
  
  const confirmAchatsImport = async () => {
    if (!achatsPreview || !achatsRestaurant) {
      toast.error("Sélectionnez un restaurant");
      return;
    }
    
    setImporting(true);
    
    try {
      const response = await axios.post(`${API}/imports/achats/confirm`, {
        achats: achatsPreview.achats,
        restaurant_id: achatsRestaurant.id,
        filename: achatsFile?.name || 'achats.xlsx'
      });
      
      toast.success(response.data.message);
      setAchatsPreview(null);
      setAchatsFile(null);
      setAchatsRestaurant(null);
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
    }
  };

  // Fonction pour gérer l'import Budget
  const handleBudgetFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !budgetMois) return;
    
    setBudgetFile(file);
    setBudgetLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mois', budgetMois);
      
      const response = await axios.post(`${API}/imports/budget/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setBudgetPreview(response.data);
      toast.success(`${response.data.nb_lignes} lignes de budget détectées pour ${response.data.nb_restaurants} restaurants`);
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
      setBudgetPreview(null);
    } finally {
      setBudgetLoading(false);
    }
  };
  
  const confirmBudgetImport = async () => {
    if (!budgetPreview || !budgetMois) {
      toast.error("Données manquantes");
      return;
    }
    
    setImporting(true);
    
    try {
      const response = await axios.post(`${API}/imports/budget/confirm`, {
        budgets: budgetPreview.budgets,
        mois: budgetMois,
        filename: budgetFile?.name || 'budget.xlsx'
      });
      
      toast.success(`${response.data.nb_budgets_crees} budgets importés pour ${budgetMois}`);
      setBudgetPreview(null);
      setBudgetFile(null);
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
    }
  };


  return (
    <div className="space-y-6" data-testid="import-module">
      {/* Header avec tabs */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Import de Données</h1>
        
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-border mb-6">
          <button
            onClick={() => setActiveTab("ventes")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "ventes"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <UploadCloud className="w-4 h-4 inline mr-2" />
            Ventes PSW
          </button>
          <button
            onClick={() => setActiveTab("carte")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "carte"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 inline mr-2" />
            Carte & Produits
          </button>
          <button
            onClick={() => setActiveTab("achats")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "achats"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Achats Odoo
          </button>
          <button
            onClick={() => setActiveTab("budget")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "budget"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Budget CA
          </button>
          <button
            onClick={() => setActiveTab("historique")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "historique"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Historique ({imports.length})
          </button>
        </div>
      </div>
      
      {/* Contenu des tabs */}
      {activeTab === "ventes" && (
        <>
          <p className="text-muted-foreground">Importez vos fichiers de ventes PSW (.xls, .xlsx)</p>
          {/* Zone de drop */}
          <div
            className={`drop-zone ${dragOver ? 'dragover' : ''} ${previewLoading ? 'animate-pulse' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !previewLoading && document.getElementById('file-input').click()}
            data-testid="drop-zone"
          >
            {previewLoading ? (
              <>
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-lg font-medium">Analyse du fichier...</p>
              </>
            ) : (
              <>
                <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Glissez votre fichier ici</p>
                <p className="text-sm text-muted-foreground">pour prévisualiser et contrôler avant import</p>
                <p className="text-xs text-muted-foreground mt-2">Format: .xls ou .xlsx (export PSW)</p>
              </>
            )}
            <input
              id="file-input"
              type="file"
              accept=".xls,.xlsx"
              onChange={handleDrop}
              className="hidden"
            />
          </div>

          {/* File queue (si plusieurs fichiers) */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-4 text-sm">
                  <span>{pendingCount} en attente</span>
                  {validatedCount > 0 && <span className="text-blue-400">{validatedCount} validé(s)</span>}
                  {successCount > 0 && <span className="text-emerald-400">{successCount} importé(s)</span>}
                  {errorCount > 0 && <span className="text-red-400">{errorCount} erreur(s)</span>}
                </div>
                {validatedCount > 0 && (
                  <Button onClick={uploadFiles} disabled={importing} data-testid="import-btn">
                    {importing ? "Import en cours..." : `Importer ${validatedCount} fichier(s) validé(s)`}
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {files.map((f, idx) => {
                  // Calculer les stats du fichier
                  const previewStats = f.previewData ? {
                    nbLignes: f.previewData.nb_lignes || 0,
                    caHT: f.previewData.ca_total || 0,
                    caTTC: f.previewData.ca_ttc_total || 0,
                    remises: f.previewData.total_remises || 0,
                    remisesNegatives: f.previewData.lignes?.filter(l => l.is_remise_negative).length || 0,
                    excludedCount: Object.values(f.excluded).filter(Boolean).length
                  } : null;

                  return (
                    <div 
                      key={idx} 
                      className={`trinity-card ${
                        f.status === 'error' ? 'border-red-500/50' : 
                        f.status === 'success' ? 'border-emerald-500/50' : 
                        f.status === 'validated' ? 'border-blue-500/50' : ''
                      }`}
                    >
                      {/* En-tête du fichier */}
                      <div className="flex items-start gap-3">
                        <FileSpreadsheet className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
                        
                        <div className="flex-1 min-w-0">
                          {/* Nom + Taille */}
                          <div className="font-medium truncate">{f.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(f.size / 1024).toFixed(1)} KB
                          </div>

                          {/* Restaurant + Date */}
                          <div className="flex gap-2 mt-2">
                            <Select
                              value={f.restaurant?.id || ""}
                              onChange={(v) => updateFile(idx, { restaurant: restaurants.find(r => r.id === v) })}
                              options={restaurants.map(r => ({ value: r.id, label: r.nom }))}
                              placeholder="Restaurant *"
                              className="w-48"
                              disabled={f.status === 'importing' || f.status === 'success'}
                            />
                            <Input
                              type="date"
                              value={f.date || ""}
                              onChange={(v) => updateFile(idx, { date: v })}
                              className="w-36"
                              disabled={f.status === 'importing' || f.status === 'success'}
                            />
                          </div>

                          {/* Points clés de contrôle (si prévisualisé) */}
                          {previewStats && (
                            <div className="mt-3 p-3 bg-secondary/30 rounded-lg">
                              <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Lignes :</span>{' '}
                                  <span className="font-mono font-medium">
                                    {previewStats.nbLignes}
                                    {previewStats.excludedCount > 0 && (
                                      <span className="text-amber-400"> ({previewStats.excludedCount} ✕)</span>
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">CA HT :</span>{' '}
                                  <span className="font-mono font-medium">{fmtPrice(previewStats.caHT)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">CA TTC :</span>{' '}
                                  <span className="font-mono font-medium">{fmtPrice(previewStats.caTTC)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Remises :</span>{' '}
                                  <span className="font-mono font-medium">{fmtPrice(Math.abs(previewStats.remises))}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Alertes :</span>{' '}
                                  {previewStats.remisesNegatives > 0 ? (
                                    <span className="text-amber-400 font-medium">⚠️ {previewStats.remisesNegatives} remise(s) négative(s)</span>
                                  ) : (
                                    <span className="text-emerald-400">✓ Aucune</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Message d'erreur */}
                          {f.error && (
                            <div className="mt-2 text-sm text-red-400">
                              ❌ {f.error}
                            </div>
                          )}
                        </div>

                        {/* Actions + Statut */}
                        <div className="flex flex-col items-end gap-2 ml-auto">
                          {/* Statut */}
                          <div className="flex items-center gap-2">
                            {f.status === "pending" && (
                              <span className="text-xs text-muted-foreground px-2 py-1 bg-secondary rounded">⏳ En attente</span>
                            )}
                            {f.status === "previewing" && (
                              <span className="text-xs text-blue-400 px-2 py-1 bg-blue-500/10 rounded animate-pulse">🔍 Chargement...</span>
                            )}
                            {f.status === "previewed" && (
                              <span className="text-xs text-amber-400 px-2 py-1 bg-amber-500/10 rounded">👁️ À valider</span>
                            )}
                            {f.status === "validated" && (
                              <span className="text-xs text-blue-400 px-2 py-1 bg-blue-500/10 rounded">✅ Validé</span>
                            )}
                            {f.status === "importing" && (
                              <span className="text-xs text-amber-400 px-2 py-1 bg-amber-500/10 rounded animate-pulse">📤 Import...</span>
                            )}
                            {f.status === "success" && (
                              <span className="text-xs text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded">✅ Importé</span>
                            )}
                            {f.status === "error" && (
                              <span className="text-xs text-red-400 px-2 py-1 bg-red-500/10 rounded">❌ Erreur</span>
                            )}
                          </div>

                          {/* Boutons d'action */}
                          <div className="flex gap-1">
                            {!f.previewData && f.status !== 'success' && f.status !== 'error' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => previewQueuedFile(idx)}
                                disabled={!f.restaurant || f.status === 'previewing'}
                              >
                                {f.status === 'previewing' ? '...' : '👁️ Contrôler'}
                              </Button>
                            )}
                            
                            {f.previewData && !f.validated && f.status !== 'success' && (
                              <Button
                                size="sm"
                                onClick={() => validateQueuedFile(idx)}
                              >
                                ✅ Valider
                              </Button>
                            )}
                            
                            {f.status !== 'importing' && f.status !== 'success' && (
                              <button 
                                onClick={() => removeFile(idx)} 
                                className="p-2 hover:bg-destructive/20 rounded text-destructive"
                                title="Retirer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <Button variant="ghost" onClick={() => setFiles([])} className="text-muted-foreground mt-4">
                Effacer tout
              </Button>
            </div>
          )}

          {/* Aide */}
          <div className="trinity-card bg-secondary/30">
            <h4 className="font-medium mb-2">📋 Workflow d'import multiple</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>1. <strong>Charger</strong> plusieurs fichiers (glisser-déposer)</p>
              <p>2. <strong>Contrôler</strong> chaque fichier individuellement (voir les lignes, exclure si besoin)</p>
              <p>3. <strong>Valider</strong> les fichiers contrôlés</p>
              <p>4. <strong>Importer</strong> tous les fichiers validés en une fois</p>
              <p className="pt-2 text-xs">💡 Astuce : Les points clés (CA, alertes) sont visibles directement</p>
            </div>
          </div>
        </>
      )}

      {/* Tab CARTE */}
      {activeTab === "carte" && (
        <div className="space-y-4">
          <div className="trinity-card">
            <h3 className="text-lg font-medium mb-4">Import de Carte Restaurant</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Format Excel (.xlsx) avec feuilles par restaurant. Les restaurants seront créés automatiquement.
            </p>
            
            <input
              type="file"
              accept=".xlsx"
              onChange={handleCarteFile}
              className="mb-4"
              disabled={carteLoading || importing}
            />
            
            {carteLoading && (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Analyse du fichier...</p>
              </div>
            )}
            
            {cartePreview && !carteLoading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <KPICard label="Restaurants" value={cartePreview.nb_restaurants} color="#34d399" />
                  <KPICard label="Produits" value={cartePreview.nb_produits} color="#f97316" />
                </div>
                
                <div className="trinity-card bg-secondary/30">
                  <h4 className="font-medium mb-2">Restaurants détectés</h4>
                  <div className="flex flex-wrap gap-2">
                    {cartePreview.restaurants.map((r, idx) => (
                      <span key={idx} className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
                        {r.nom}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="trinity-card bg-secondary/30 max-h-64 overflow-y-auto">
                  <h4 className="font-medium mb-2">Aperçu des produits (premiers 20)</h4>
                  <div className="space-y-1 text-sm">
                    {cartePreview.produits.slice(0, 20).map((p, idx) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-border/30">
                        <span>{p.nom} <span className="text-muted-foreground text-xs">({p.restaurant_nom})</span></span>
                        <span className="font-mono">{p.prix_vente} F</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => {setCartePreview(null); setCarteFile(null);}}>
                    Annuler
                  </Button>
                  <Button onClick={confirmCarteImport} disabled={importing}>
                    {importing ? "Import en cours..." : "Confirmer l'import"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab ACHATS */}
      {activeTab === "achats" && (
        <div className="space-y-4">
          <div className="trinity-card">
            <h3 className="text-lg font-medium mb-4">Import d'Achats Odoo</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Format Excel (.xlsx) exporté depuis Odoo avec les lignes de commande d'achat.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Restaurant</label>
                <select
                  value={achatsRestaurant?.id || ""}
                  onChange={(e) => setAchatsRestaurant(restaurants.find(r => r.id === e.target.value))}
                  className="w-full p-2 bg-background border border-border rounded-md"
                  disabled={achatsLoading || importing}
                >
                  <option value="">Sélectionnez un restaurant</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>{r.nom}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Fichier Odoo</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleAchatsFile}
                  disabled={achatsLoading || importing || !achatsRestaurant}
                />
              </div>
            </div>
            
            {achatsLoading && (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Analyse du fichier...</p>
              </div>
            )}
            
            {achatsPreview && !achatsLoading && (
              <div className="space-y-4 mt-4">
                <KPICard label="Lignes d'achats" value={achatsPreview.nb_achats} color="#3b82f6" />
                
                <div className="trinity-card bg-secondary/30 max-h-64 overflow-y-auto">
                  <h4 className="font-medium mb-2">Aperçu des achats (premiers 20)</h4>
                  <div className="space-y-1 text-sm">
                    {achatsPreview.achats.slice(0, 20).map((a, idx) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-border/30">
                        <div className="flex-1">
                          <div>{a.produit}</div>
                          <div className="text-xs text-muted-foreground">{a.fournisseur}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono">{a.total} F</div>
                          <div className="text-xs text-muted-foreground">{a.quantite} {a.unite}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => {setAchatsPreview(null); setAchatsFile(null);}}>
                    Annuler
                  </Button>
                  <Button onClick={confirmAchatsImport} disabled={importing}>
                    {importing ? "Import en cours..." : "Confirmer l'import"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "budget" && (
        <div className="space-y-4">
          <div className="trinity-card">
            <h3 className="text-lg font-medium mb-4">Import Budget CA Mensuel</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Format Excel (.xlsx) avec les feuilles "Budget CA - [Restaurant] - [Mois]"
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Mois du Budget *</label>
                <input
                  type="month"
                  value={budgetMois || ""}
                  onChange={(e) => setBudgetMois(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-md"
                  disabled={budgetLoading || importing}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Fichier Budget</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleBudgetFile}
                  disabled={budgetLoading || importing || !budgetMois}
                />
              </div>
            </div>
            
            {budgetLoading && (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Analyse du fichier...</p>
              </div>
            )}
            
            {budgetPreview && !budgetLoading && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <KPICard label="Restaurants" value={budgetPreview.nb_restaurants} color="#3b82f6" />
                  <KPICard label="Lignes" value={budgetPreview.nb_lignes} color="#10b981" />
                  <KPICard label="Budget Total" value={`${Math.round(budgetPreview.total_budget / 1000)}k F`} color="#f59e0b" />
                </div>
                
                <div className="trinity-card bg-secondary/30 max-h-96 overflow-y-auto">
                  <h4 className="font-medium mb-2">Aperçu du budget</h4>
                  <table className="w-full text-sm">
                    <thead className="border-b border-border sticky top-0 bg-secondary/50">
                      <tr>
                        <th className="text-left py-2">Restaurant</th>
                        <th className="text-left">Date</th>
                        <th className="text-right">CA Budget</th>
                        <th className="text-right">CA 2025</th>
                        <th className="text-right">Écart %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetPreview.budgets.slice(0, 50).map((b, idx) => (
                        <tr key={idx} className="border-b border-border/30">
                          <td className="py-1">{b.restaurant_nom}</td>
                          <td>{b.date}</td>
                          <td className="text-right font-mono">{fmtPrice(b.ca_budget)}</td>
                          <td className="text-right font-mono">{b.ca_reel > 0 ? fmtPrice(b.ca_reel) : "—"}</td>
                          <td className="text-right font-mono">{b.ecart_pct !== 0 ? `${b.ecart_pct.toFixed(1)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => {setBudgetPreview(null); setBudgetFile(null);}}>
                    Annuler
                  </Button>
                  <Button onClick={confirmBudgetImport} disabled={importing}>
                    {importing ? "Import en cours..." : `Valider l'import (${budgetPreview.nb_lignes} lignes)`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab HISTORIQUE */}
      {activeTab === "historique" && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="trinity-card">
            <h3 className="text-lg font-medium mb-4">Filtres</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type d'import</label>
                <select
                  value={historyTypeFilter}
                  onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-md"
                >
                  <option value="tous">Tous les types</option>
                  <option value="ventes">Ventes PSW</option>
                  <option value="produits">Cartes & Produits</option>
                  <option value="achats">Achats Odoo</option>
                  <option value="budget">Budget CA</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Mois</label>
                <input
                  type="month"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-md"
                  placeholder="Tous les mois"
                />
              </div>
            </div>
            
            {(historyTypeFilter !== "tous" || historyDateFilter) && (
              <div className="mt-4 flex gap-2">
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setHistoryTypeFilter("tous");
                    setHistoryDateFilter("");
                  }}
                  className="text-sm"
                >
                  <X className="w-4 h-4 mr-1" />
                  Réinitialiser les filtres
                </Button>
              </div>
            )}
            
            {/* Bouton de nettoyage des doublons */}
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-400 mb-1">Nettoyage des doublons</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Si vous voyez des imports en double, utilisez ce bouton pour nettoyer automatiquement la base de données. 
                    L'import le plus récent sera conservé pour chaque doublon.
                  </p>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!window.confirm('Voulez-vous vraiment nettoyer les imports en double ? Cette action est irréversible.')) {
                        return;
                      }
                      
                      try {
                        const res = await axios.post(`${API}/imports/cleanup-duplicates`);
                        toast.success(`Nettoyage terminé : ${res.data.doublons_supprimes} doublons supprimés`);
                        
                        // Recharger la liste des imports
                        const importsRes = await axios.get(`${API}/imports`);
                        setImports(importsRes.data);
                      } catch (err) {
                        toast.error("Erreur lors du nettoyage : " + (err.response?.data?.detail || err.message));
                      }
                    }}
                    className="text-sm"
                  >
                    🧹 Nettoyer les doublons maintenant
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des imports */}
          <div className="space-y-3">
            {filteredImports.length > 0 ? (
              filteredImports.map((imp) => {
                const resto = getRestaurantById(imp.restaurant_id);
                const typeLabels = {
                  "ventes": "Ventes PSW",
                  "produits": "Cartes & Produits",
                  "achats": "Achats Odoo",
                  "budget": "Budget CA"
                };
                // Utiliser imp.type (pas imp.type_import)
                const importType = imp.type || imp.type_import || "ventes";
                const typeLabel = typeLabels[importType] || importType || "Ventes";
                
                return (
                  <div key={imp.id} className="trinity-card flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-1 h-16 rounded-full" 
                        style={{ backgroundColor: resto?.couleur || '#666' }}
                      />
                      <div>
                        <div className="font-medium">{imp.nom_fichier}</div>
                        <div className="text-sm text-muted-foreground">
                          {resto?.nom || "—"} • {typeLabel}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(imp.date_import).toLocaleDateString('fr-FR', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono text-lg">{imp.details?.nb_lignes || imp.nb_lignes || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {imp.details?.nb_exclues || imp.nb_exclues ? `(${imp.details?.nb_exclues || imp.nb_exclues} exclues)` : 'lignes'}
                        </div>
                      </div>
                      <Pill type={imp.statut === "importé" ? "success" : imp.statut === "erreur" ? "error" : "warning"}>
                        {imp.statut}
                      </Pill>
                      <button 
                        onClick={() => deleteImport(imp.id)}
                        className="p-2 hover:bg-destructive/20 rounded text-destructive transition-colors"
                        title="Supprimer cet import"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon={FileText}
                title="Aucun import trouvé"
                description={
                  historyTypeFilter !== "tous" || historyDateFilter 
                    ? "Aucun import ne correspond à vos filtres" 
                    : "Vos imports apparaîtront ici"
                }
              />
            )}
          </div>
          
          {/* Statistiques en bas */}
          {filteredImports.length > 0 && (
            <div className="trinity-card bg-secondary/30">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total affiché</span>
                <span className="font-medium">{filteredImports.length} import{filteredImports.length > 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

// ====================== MAIN APP ======================

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [restaurants, setRestaurants] = useState([]);
  const [produits, setProduits] = useState([]);
  const [fiches, setFiches] = useState([]);
  const [stats, setStats] = useState({
    restaurants_count: 0,
    produits_count: 0,
    fiches_count: 0,
    ca_total: 0,
    avg_food_cost: 0,
    top_ventes: []
  });
  const [restaurantStats, setRestaurantStats] = useState([]);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState(null); // Filtre de mois global

  const fetchData = useCallback(async (monthFilter = null) => {
    setLoading(true);
    try {
      // Construire les URLs avec filtre de mois si nécessaire
      const statsUrl = monthFilter 
        ? `${API}/dashboard/stats?month=${monthFilter}`
        : `${API}/dashboard/stats`;
      
      const restoStatsUrl = monthFilter
        ? `${API}/dashboard/restaurants-stats?month=${monthFilter}`
        : `${API}/dashboard/restaurants-stats`;

      const [restosRes, produitsRes, fichesRes, statsRes, restoStatsRes] = await Promise.all([
        axios.get(`${API}/restaurants`),
        axios.get(`${API}/produits`),
        axios.get(`${API}/fiches`),
        axios.get(statsUrl),
        axios.get(restoStatsUrl)
      ]);
      setRestaurants(restosRes.data);
      setProduits(produitsRes.data);
      setFiches(fichesRes.data);
      setStats(statsRes.data);
      setRestaurantStats(restoStatsRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Erreur de chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fonction pour recharger avec un filtre de mois
  const handleMonthFilterChange = useCallback((month) => {
    setSelectedMonthFilter(month);
    fetchData(month);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <Dashboard stats={stats} restaurantStats={restaurantStats} loading={loading} restaurants={restaurants} onRefreshWithMonth={handleMonthFilterChange} />;
      case "budget-vs-reel":
        return <BudgetVsReelModule restaurants={restaurants} />;
      case "restaurants":
        return <RestaurantsModule restaurants={restaurants} onRefresh={fetchData} />;
      case "carte":
        return <CarteModule restaurants={restaurants} produits={produits} onRefresh={fetchData} />;
      case "fiches":
        return <FichesModule restaurants={restaurants} fiches={fiches} produits={produits} onRefresh={fetchData} />;
      case "achats":
        return <ProduitsAchatsModule restaurants={restaurants} />;
      case "import":
        return <ImportModule restaurants={restaurants} onRefresh={fetchData} />;
      default:
        return <Dashboard stats={stats} restaurantStats={restaurantStats} loading={loading} restaurants={restaurants} onRefreshWithMonth={handleMonthFilterChange} />;
    }
  };

  return (
    <RestaurantContext.Provider value={{ restaurants }}>
      <div className="min-h-screen bg-background">
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: { background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }
          }}
        />
        
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          restaurants={restaurants}
        />

        <main 
          className={`min-h-screen p-6 md:p-8 ${collapsed ? 'ml-16' : 'ml-64'}`}
          style={{ transition: 'margin-left 0.3s ease' }}
        >
          {renderModule()}
        </main>
      </div>
    </RestaurantContext.Provider>
  );
}

export default ImportModule;
