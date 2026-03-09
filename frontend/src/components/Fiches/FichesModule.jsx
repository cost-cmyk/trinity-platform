import React, { useState, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Search, Filter, X, Edit, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { fmt, fmtPrice } from "@/utils/format";
import API from "@/utils/api";

const FichesModule = ({ restaurants, fiches, produits, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRestaurant, setFilterRestaurant] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  
  // États du formulaire
  const [form, setForm] = useState({
    nom: "", 
    restaurant_id: "", 
    type_fiche: "produit_fini", // produit_fini ou preparation_base
    famille: "",
    is_food: true, // true=Nourriture, false=Boisson
    nb_portions: "1", 
    prix_vente: "", 
    tva_pct: "5",  // NOUVEAU : % TVA par défaut 5%
    statut: "brouillon", 
    ingredients: [],
    linked_produit_ids: [], // Produits de la carte rattachés
    photo_url: null
  });
  
  // États pour l'ajout d'ingrédients
  const [ingredientTab, setIngredientTab] = useState("achat"); // "achat" ou "sous_fiche"
  const [achatsSearch, setAchatsSearch] = useState("");
  const [achatsResults, setAchatsResults] = useState([]);
  const [fichesSearch, setFichesSearch] = useState("");
  const [fichesResults, setFichesResults] = useState([]);
  const [produitsSearch, setProduitsSearch] = useState("");
  const [produitsResults, setProduitsResults] = useState([]);
  const [famillesDisponibles, setFamillesDisponibles] = useState([]);
  
  // État pour l'ingrédient en cours d'ajout
  const [newIngredient, setNewIngredient] = useState({
    nom: "", 
    quantite: "", 
    unite: "g", 
    prix_unitaire: "",
    type_ingredient: "achat",
    fournisseur: null,
    date_achat: null,
    quantite_base_achat: 1,
    unite_achat_originale: null
  });

  const unites = ["g", "kg", "L", "ml", "cl", "unité", "pièce"];
  const familles = ["Entrées", "Plats", "Desserts", "Boissons", "Préparations de base", "Sauces"];

  // Ref pour le timeout du debounce
  const searchTimeoutRef = React.useRef(null);

  // Fonction de debounce pour optimiser les recherches
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Fonction pour parser l'unité d'achat et extraire l'unité standard
  const parseUniteAchat = (uniteAchat) => {
    console.log("🔍 parseUniteAchat - Input:", uniteAchat);
    
    if (!uniteAchat) {
      console.log("❌ parseUniteAchat - Pas d'unité, retour défaut kg");
      return { unite: "kg", quantiteBase: 1 };
    }
    
    // Normaliser l'unité
    let uniteStr = uniteAchat.toString().toLowerCase().trim();
    console.log("📝 parseUniteAchat - Après normalisation:", uniteStr);
    
    // Retirer le "/" au début s'il existe (ex: "/kg" ou "/500g")
    if (uniteStr.startsWith('/')) {
      uniteStr = uniteStr.substring(1);
      console.log("✂️ parseUniteAchat - Après retrait du /:", uniteStr);
    }
    
    // Dictionnaire de normalisation des unités
    const uniteDict = {
      'kg': 'kg', 'g': 'g',
      'l': 'L', 'ml': 'ml', 'cl': 'cl',
      'unite': 'unité', 'piece': 'pièce', 'pce': 'pièce'
    };
    
    // Cas 1: Unité avec quantité (ex: "500g", "70cl", "1kg")
    const match = uniteStr.match(/^(\d+\.?\d*)\s*([a-zA-Z]+)$/);
    
    if (match) {
      const quantiteBase = parseFloat(match[1]);
      const uniteRaw = match[2].toLowerCase();
      const uniteNormalisee = uniteDict[uniteRaw] || uniteRaw;
      
      console.log("✅ parseUniteAchat - Cas quantité+unité:", {
        quantiteBase,
        uniteRaw,
        uniteNormalisee
      });
      
      return { unite: uniteNormalisee, quantiteBase };
    }
    
    // Cas 2: Unité simple (ex: "kg", "g", "l")
    const uniteNormalisee = uniteDict[uniteStr] || uniteStr;
    
    console.log("✅ parseUniteAchat - Cas unité simple:", {
      unite: uniteNormalisee,
      quantiteBase: 1
    });
    
    return { unite: uniteNormalisee, quantiteBase: 1 };
  };

  // Fonction de conversion d'unités vers grammes/ml
  const convertToBaseUnit = (quantite, unite) => {
    const conversions = {
      'kg': 1000, 'g': 1,
      'L': 1000, 'ml': 1, 'cl': 10,
      'unité': 1, 'pièce': 1
    };
    return quantite * (conversions[unite] || 1);
  };

  // Recherche d'achats pour autocomplétion
  const searchAchats = async (query) => {
    console.log("🔍 searchAchats appelé avec query:", query, "restaurant_id:", form.restaurant_id);
    
    if (!query || query.length < 2) {
      console.log("❌ Query trop courte");
      setAchatsResults([]);
      return;
    }
    
    if (!form.restaurant_id) {
      console.log("❌ Pas de restaurant sélectionné");
      setAchatsResults([]);
      return;
    }
    
    try {
      console.log("📡 Appel API achats...");
      const response = await axios.get(`${API}/achats?restaurant_id=${form.restaurant_id}`);
      console.log("✅ Réponse API:", response.data.length, "achats");
      
      const filtered = response.data
        .filter(a => a.produit && a.produit.toLowerCase().includes(query.toLowerCase()))
        .reduce((acc, achat) => {
          const existing = acc.find(item => item.produit === achat.produit && item.fournisseur === achat.fournisseur);
          if (!existing || new Date(achat.date_achat) > new Date(existing.date_achat)) {
            return [...acc.filter(item => !(item.produit === achat.produit && item.fournisseur === achat.fournisseur)), achat];
          }
          return acc;
        }, [])
        .slice(0, 10);
      
      console.log("✅ Résultats filtrés:", filtered.length);
      setAchatsResults(filtered);
      
    } catch (err) {
      console.error("❌ Erreur recherche achats:", err);
      setAchatsResults([]);
    }
  };

  // Recherche de sous-fiches pour autocomplétion
  const searchFiches = async (query) => {
    if (!query || query.length < 2 || !form.restaurant_id) {
      setFichesResults([]);
      return;
    }
    const filtered = fiches
      .filter(f => 
        f.restaurant_id === form.restaurant_id &&
        f.statut === "fait" &&
        f.id !== editingId &&
        f.nom.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10);
    setFichesResults(filtered);
  };

  // Recherche de produits carte pour rattachement
  const searchProduits = async (query) => {
    if (!query || query.length < 2 || !form.restaurant_id) {
      setProduitsResults([]);
      return;
    }
    const filtered = produits
      .filter(p => 
        p.restaurant_id === form.restaurant_id &&
        p.nom.toLowerCase().includes(query.toLowerCase()) &&
        !form.linked_produit_ids.includes(p.id)
      )
      .slice(0, 10);
    setProduitsResults(filtered);
  };

  // Charger les familles quand le restaurant change
  const loadFamilles = async (restaurantId) => {
    console.log("🏪 loadFamilles - Restaurant ID:", restaurantId);
    
    if (!restaurantId) {
      console.log("❌ loadFamilles - Pas de restaurant, familles par défaut");
      setFamillesDisponibles(["Entrées", "Plats", "Desserts", "Boissons", "Préparations de base", "Sauces"]);
      return;
    }
    
    try {
      console.log(`📡 loadFamilles - Appel API: ${API}/restaurants/${restaurantId}/familles`);
      const response = await axios.get(`${API}/restaurants/${restaurantId}/familles`);
      console.log("✅ loadFamilles - Réponse API:", response.data);
      console.log("✅ loadFamilles - Nombre de familles:", response.data.length);
      setFamillesDisponibles(response.data);
    } catch (err) {
      console.error("❌ loadFamilles - Erreur:", err);
      console.error("❌ loadFamilles - Détails:", err.response?.data);
      setFamillesDisponibles(["Entrées", "Plats", "Desserts", "Boissons", "Préparations de base", "Sauces"]);
    }
  };

  const filteredFiches = fiches.filter((f) => {
    if (search && !f.nom.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRestaurant && f.restaurant_id !== filterRestaurant) return false;
    if (filterStatut && f.statut !== filterStatut) return false;
    return true;
  });

  const resetForm = () => {
    setForm({
      nom: "", 
      restaurant_id: "", 
      type_fiche: "produit_fini", 
      famille: "",
      is_food: true,
      nb_portions: "1", 
      prix_vente: "", 
      statut: "brouillon", 
      ingredients: [],
      linked_produit_ids: [],
      photo_url: null
    });
    setNewIngredient({ 
      nom: "", 
      quantite: "", 
      unite: "g", 
      prix_unitaire: "", 
      type_ingredient: "achat", 
      fournisseur: null, 
      date_achat: null,
      quantite_base_achat: 1,
      unite_achat_originale: null
    });
    setEditingId(null);
    setShowForm(false);
    setIngredientTab("achat");
    setAchatsSearch("");
    setFichesSearch("");
    setProduitsSearch("");
    setAchatsResults([]);
    setFichesResults([]);
    setProduitsResults([]);
  };

  const handleEdit = (fiche) => {
    setForm({
      nom: fiche.nom,
      restaurant_id: fiche.restaurant_id,
      type_fiche: fiche.type_fiche || "produit_fini",
      famille: fiche.famille,
      is_food: fiche.is_food !== undefined ? fiche.is_food : true,
      nb_portions: fiche.nb_portions.toString(),
      prix_vente: fiche.prix_vente.toString(),
      statut: fiche.statut,
      ingredients: fiche.ingredients || [],
      linked_produit_ids: fiche.linked_produit_ids || [],
      photo_url: fiche.photo_url || null
    });
    setEditingId(fiche.id);
    setShowForm(true);
    if (fiche.restaurant_id) {
      loadFamilles(fiche.restaurant_id);
    }
  };

  // Charger les familles UNIQUEMENT quand le restaurant change (pas à chaque render)
  React.useEffect(() => {
    console.log("🔄 useEffect Familles - Déclenché, restaurant_id:", form.restaurant_id);
    console.log("🔄 useEffect Familles - famillesDisponibles actuelles:", famillesDisponibles);
    
    if (form.restaurant_id) {
      console.log("✅ useEffect Familles - Appel loadFamilles avec:", form.restaurant_id);
      loadFamilles(form.restaurant_id);
    } else {
      console.log("⚠️ useEffect Familles - Pas de restaurant, reset aux familles par défaut");
      setFamillesDisponibles(["Entrées", "Plats", "Desserts", "Boissons", "Préparations de base", "Sauces"]);
    }
  }, [form.restaurant_id]); // Uniquement quand restaurant_id change

  const addIngredient = () => {
    if (!newIngredient.nom || !newIngredient.quantite) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }
    
    console.log("➕ addIngredient - Données ingrédient:", {
      nom: newIngredient.nom,
      quantite: newIngredient.quantite,
      unite: newIngredient.unite,
      prix_unitaire: newIngredient.prix_unitaire,
      quantite_base_achat: newIngredient.quantite_base_achat,
      type_ingredient: newIngredient.type_ingredient
    });
    
    // Calculer le coût_ligne selon le type
    let cout_ligne = 0;
    if (newIngredient.type_ingredient === "achat") {
      if (!newIngredient.prix_unitaire) {
        toast.error("Prix unitaire requis pour un produit acheté");
        return;
      }
      
      // Calcul correct avec la quantité de base
      const qteDemandee = parseFloat(newIngredient.quantite);
      const prixUnitaire = parseFloat(newIngredient.prix_unitaire);
      const qteBase = newIngredient.quantite_base_achat || 1;
      
      console.log("💰 addIngredient - Calcul coût:", {
        qteDemandee,
        prixUnitaire,
        qteBase,
        formule: `(${qteDemandee} / ${qteBase}) * ${prixUnitaire}`
      });
      
      // Le prix est pour qteBase unités de l'unité sélectionnée
      cout_ligne = (qteDemandee / qteBase) * prixUnitaire;
      
      console.log("✅ addIngredient - Coût calculé:", cout_ligne, "F");
      
    } else {
      // Pour une sous-fiche, le cout_ligne est calculé au prorata
      const fiche = fiches.find(f => f.id === newIngredient.fiche_id);
      if (fiche && fiche.poids_total_g > 0) {
        const ratio = parseFloat(newIngredient.quantite) / fiche.poids_total_g;
        cout_ligne = fiche.cout_total * ratio;
        console.log("✅ addIngredient - Coût sous-fiche:", cout_ligne, "F");
      }
    }
    
    const ing = {
      ...newIngredient,
      quantite: parseFloat(newIngredient.quantite),
      prix_unitaire: parseFloat(newIngredient.prix_unitaire) || 0,
      cout_ligne
    };
    
    console.log("✅ addIngredient - Ingrédient final:", ing);
    
    setForm({ ...form, ingredients: [...form.ingredients, ing] });
    setNewIngredient({ 
      nom: "", 
      quantite: "", 
      unite: "g", 
      prix_unitaire: "", 
      type_ingredient: ingredientTab, 
      fournisseur: null, 
      date_achat: null,
      quantite_base_achat: 1,
      unite_achat_originale: null
    });
    setAchatsSearch("");
    setFichesSearch("");
    setAchatsResults([]);
    setFichesResults([]);
  };

  const removeIngredient = (idx) => {
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== idx) });
  };

  const calculateCosts = () => {
    const coutTotal = form.ingredients.reduce((sum, ing) => sum + (ing.cout_ligne || 0), 0);
    const nbPortions = parseInt(form.nb_portions) || 1;
    const prixVenteTTC = parseFloat(form.prix_vente) || 0;
    const tvaPct = parseFloat(form.tva_pct) || 0;
    
    // Calculer le prix HT à partir du TTC
    const prixVenteHT = tvaPct > 0 ? prixVenteTTC / (1 + tvaPct / 100) : prixVenteTTC;
    
    const coutPortion = coutTotal / nbPortions;
    
    // Food Cost calculé sur le prix HT
    const foodCost = prixVenteHT > 0 ? (coutPortion / prixVenteHT) * 100 : 0;
    
    // Calculer le poids total (uniquement pour les ingrédients avec unité de poids)
    // Exclure "unité" et "pièce" car ce ne sont pas des unités de poids
    const poidsTotal = form.ingredients.reduce((sum, ing) => {
      if (['g', 'kg', 'ml', 'L', 'cl'].includes(ing.unite)) {
        return sum + convertToBaseUnit(ing.quantite, ing.unite);
      }
      return sum;
    }, 0);
    
    // Pour les préparations de base, calculer le coût au kg ou au L
    const coutParKg = poidsTotal > 0 ? (coutTotal / poidsTotal) * 1000 : 0;
    
    return { coutTotal, coutPortion, foodCost, poidsTotal, coutParKg, prixVenteHT };
  };

  const handleSubmit = async () => {
    if (!form.nom || !form.restaurant_id) {
      toast.error("Nom et restaurant requis");
      return;
    }
    
    // Validation : rattachement carte obligatoire uniquement pour "produit_fini"
    if (form.type_fiche === "produit_fini" && form.linked_produit_ids.length === 0) {
      toast.error("Rattachement à au moins un produit de la carte obligatoire");
      return;
    }
    
    // Validation : prix de vente requis uniquement pour "produit_fini"
    if (form.type_fiche === "produit_fini" && (!form.prix_vente || parseFloat(form.prix_vente) <= 0)) {
      toast.error("Prix de vente requis pour un produit fini");
      return;
    }
    
    try {
      const costs = calculateCosts();
      const data = {
        ...form,
        nb_portions: parseInt(form.nb_portions) || 1,
        prix_vente: parseFloat(form.prix_vente) || 0,
        poids_total_g: costs.poidsTotal,
        ingredients: form.ingredients.map(ing => ({
          nom: ing.nom,
          quantite: parseFloat(ing.quantite),
          unite: ing.unite,
          prix_unitaire: parseFloat(ing.prix_unitaire) || 0,
          cout_ligne: ing.cout_ligne,
          type_ingredient: ing.type_ingredient,
          fiche_id: ing.fiche_id || null,
          fournisseur: ing.fournisseur || null,
          date_achat: ing.date_achat || null
        }))
      };
      if (editingId) {
        await axios.put(`${API}/fiches/${editingId}`, data);
        toast.success("Fiche mise à jour");
      } else {
        await axios.post(`${API}/fiches`, data);
        toast.success("Fiche créée");
      }
      resetForm();
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette fiche technique ?")) return;
    try {
      await axios.delete(`${API}/fiches/${id}`);
      toast.success("Fiche supprimée");
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    }
  };

  const getRestaurantById = (id) => restaurants.find(r => r.id === id);
  const costs = calculateCosts();

  return (
    <div className="space-y-6" data-testid="fiches-module">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fiches Techniques</h1>
          <p className="text-muted-foreground">{filteredFiches.length} fiche{filteredFiches.length > 1 ? 's' : ''}</p>
        </div>
        <Button icon={Plus} onClick={() => setShowForm(true)} data-testid="add-fiche-btn">
          Nouvelle Fiche
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une fiche..."
            className="trinity-input pl-10"
          />
        </div>
        <Select
          value={filterRestaurant}
          onChange={setFilterRestaurant}
          options={restaurants.map(r => ({ value: r.id, label: r.nom }))}
          placeholder="Tous les restaurants"
          className="min-w-[180px]"
        />
        <Select
          value={filterStatut}
          onChange={setFilterStatut}
          options={[{ value: "brouillon", label: "Brouillon" }, { value: "fait", label: "Fait" }]}
          placeholder="Tous statuts"
          className="min-w-[150px]"
        />
      </div>

      {/* Fiches List */}
      {filteredFiches.length > 0 ? (
        <div className="space-y-4">
          {filteredFiches.map((fiche) => {
            const resto = getRestaurantById(fiche.restaurant_id);
            const isExpanded = expandedId === fiche.id;
            return (
              <div key={fiche.id} className="trinity-card">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : fiche.id)}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-1 h-12 rounded-full" 
                      style={{ backgroundColor: resto?.couleur || '#666' }}
                    />
                    <div>
                      <h3 className="font-semibold">{fiche.nom}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{resto?.nom}</span>
                        <span>•</span>
                        <span>{fiche.famille || fiche.type_fiche}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`font-mono text-lg ${getFoodCostColor(fiche.food_cost_pct)}`}>
                        {fmtPct(fiche.food_cost_pct)}
                      </div>
                      <div className="text-xs text-muted-foreground">Food Cost</div>
                    </div>
                    <Pill type={fiche.statut === "fait" ? "success" : "warning"}>
                      {fiche.statut === "fait" ? "Fait" : "Brouillon"}
                    </Pill>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Prix de vente</span>
                        <div className="font-mono">{fmtPrice(fiche.prix_vente)}</div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Coût total</span>
                        <div className="font-mono">{fmtPrice(fiche.cout_total)}</div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Portions</span>
                        <div className="font-mono">{fiche.nb_portions}</div>
                      </div>
                    </div>

                    {fiche.ingredients && fiche.ingredients.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground uppercase">
                              <th className="text-left py-2">Ingrédient</th>
                              <th className="text-right py-2">Quantité</th>
                              <th className="text-right py-2">PU</th>
                              <th className="text-right py-2">Coût</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fiche.ingredients.map((ing, idx) => (
                              <tr key={idx} className="border-t border-border/50">
                                <td className="py-2">{ing.nom}</td>
                                <td className="text-right font-mono">{ing.quantite} {ing.unite}</td>
                                <td className="text-right font-mono">{fmtPrice(ing.prix_unitaire)}</td>
                                <td className="text-right font-mono">{fmtPrice(ing.cout_ligne)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <Button variant="secondary" icon={Edit} onClick={() => handleEdit(fiche)}>
                        Modifier
                      </Button>
                      <Button variant="ghost" className="text-destructive" icon={Trash2} onClick={() => handleDelete(fiche.id)}>
                        Supprimer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title={search || filterRestaurant || filterStatut ? "Aucun résultat" : "Aucune fiche technique"}
          description={search || filterRestaurant || filterStatut 
            ? "Essayez de modifier vos filtres"
            : "Créez vos fiches techniques pour calculer vos food costs"
          }
          action={!search && !filterRestaurant && !filterStatut && (
            <Button icon={Plus} onClick={() => setShowForm(true)}>
              Créer une fiche
            </Button>
          )}
        />
      )}

      {/* Form Modal */}
      <Modal 
        isOpen={showForm} 
        onClose={resetForm} 
        title={editingId ? "Modifier la fiche" : "Nouvelle fiche technique"}
        size="xl"
      >
        <div className="space-y-6">
          {/* Onglets Type de Fiche */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setForm({ ...form, type_fiche: "produit_fini" })}
              className={`px-4 py-2 font-medium transition ${
                form.type_fiche === "produit_fini"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🍽️ Produit fini
            </button>
            <button
              onClick={() => setForm({ ...form, type_fiche: "preparation_base" })}
              className={`px-4 py-2 font-medium transition ${
                form.type_fiche === "preparation_base"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🥖 Préparation de base
            </button>
          </div>

          {/* Informations Générales */}
          <div className="trinity-card">
            <h3 className="font-semibold mb-4">Informations générales</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Restaurant *"
                value={form.restaurant_id}
                onChange={(v) => {
                  console.log("===== ENTERING PARENT onChange =====");
                  console.log("🏪 Changement restaurant sélectionné:", v);
                  console.log("Current form state:", form);
                  setForm({ ...form, restaurant_id: v, famille: "" });
                  console.log("📞 Appel direct loadFamilles depuis onChange");
                  loadFamilles(v);
                  console.log("===== EXITING PARENT onChange =====");
                }}
                options={restaurants.map(r => ({ value: r.id, label: r.nom }))}
                placeholder="Sélectionner"
              />
              <Input
                label="Nom du plat/boisson *"
                value={form.nom}
                onChange={(v) => setForm({ ...form, nom: v })}
                placeholder="Ex: Burger Classic"
                data-testid="fiche-name-input"
              />
              
              {/* Prix de vente uniquement pour "Produit fini" */}
              {form.type_fiche === "produit_fini" && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Prix de vente TTC (F)"
                    type="number"
                    value={form.prix_vente}
                    onChange={(v) => setForm({ ...form, prix_vente: v })}
                    placeholder="0"
                  />
                  <Input
                    label="% TVA"
                    type="number"
                    value={form.tva_pct}
                    onChange={(v) => setForm({ ...form, tva_pct: v })}
                    placeholder="5"
                  />
                </div>
              )}
              
              {/* Toggle Nourriture/Boisson */}
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_food: true })}
                    className={`flex-1 px-4 py-2 rounded-lg border transition ${
                      form.is_food
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border hover:bg-secondary/80"
                    }`}
                  >
                    🍽️ Nourriture
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_food: false })}
                    className={`flex-1 px-4 py-2 rounded-lg border transition ${
                      !form.is_food
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border hover:bg-secondary/80"
                    }`}
                  >
                    🍷 Boisson
                  </button>
                </div>
              </div>

              <Select
                label="Famille"
                value={form.famille}
                onChange={(v) => {
                  console.log("👨‍👩‍👧‍👦 Sélection famille:", v);
                  setForm({ ...form, famille: v });
                }}
                options={(() => {
                  const opts = famillesDisponibles.length > 0 ? famillesDisponibles : familles;
                  console.log("👨‍👩‍👧‍👦 Options familles utilisées:", opts);
                  console.log("👨‍👩‍👧‍👦 famillesDisponibles.length:", famillesDisponibles.length);
                  return opts;
                })()}
                placeholder={form.restaurant_id ? "Sélectionner" : "Sélectionnez d'abord un restaurant"}
                disabled={!form.restaurant_id}
              />
              
              {/* Coûts calculés - Affichage selon le type de fiche */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {form.type_fiche === "produit_fini" 
                    ? (form.is_food ? "Food cost calculé" : "Bev cost calculé")
                    : "Coûts unitaires calculés"}
                </label>
                <div className="trinity-input bg-secondary/50 cursor-not-allowed text-sm">
                  <span className="text-muted-foreground">
                    {form.type_fiche === "produit_fini" ? (
                      // Pour produit fini : afficher Food cost % (calculé sur HT)
                      <>
                        {calculateCosts().coutPortion > 0 ? `Coût: ${fmtPrice(calculateCosts().coutPortion)} • ` : ""}
                        {calculateCosts().prixVenteHT > 0 ? `PV HT: ${fmtPrice(calculateCosts().prixVenteHT)} • ` : ""}
                        {calculateCosts().foodCost > 0 ? `${(form.is_food ? "Food" : "Bev")} Cost: ${fmtPct(calculateCosts().foodCost)}` : "—"}
                      </>
                    ) : (
                      // Pour préparation de base : afficher coût au kg ou L
                      <>
                        {calculateCosts().coutTotal > 0 ? `${fmtPrice(calculateCosts().coutTotal)} total • ` : ""}
                        {calculateCosts().coutParKg > 0 ? `${fmtPrice(calculateCosts().coutParKg)} F/kg` : "Automatique selon ingrédients et grammage"}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rattachement Carte (si produit_fini) */}
          {form.type_fiche === "produit_fini" && (
            <div className="trinity-card">
              <h3 className="font-semibold mb-2">Rattachement carte <span className="text-destructive">*</span></h3>
              <p className="text-xs text-muted-foreground mb-4">Rattacher au moins un produit de la carte</p>
              
              {form.linked_produit_ids.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.linked_produit_ids.map(prodId => {
                    const prod = produits.find(p => p.id === prodId);
                    return prod ? (
                      <div key={prodId} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                        <span>{prod.nom}</span>
                        <button 
                          type="button"
                          onClick={() => setForm({ ...form, linked_produit_ids: form.linked_produit_ids.filter(id => id !== prodId) })}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              
              <div className="relative">
                <input
                  type="text"
                  value={produitsSearch}
                  onChange={(e) => {
                    setProduitsSearch(e.target.value);
                    searchProduits(e.target.value);
                  }}
                  placeholder="Rechercher un produit de la carte..."
                  className="trinity-input"
                  disabled={!form.restaurant_id}
                />
                
                {produitsResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {produitsResults.map(prod => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, linked_produit_ids: [...form.linked_produit_ids, prod.id] });
                          setProduitsSearch("");
                          setProduitsResults([]);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-secondary transition flex items-center justify-between"
                      >
                        <span>{prod.nom}</span>
                        <span className="text-muted-foreground text-sm">{fmtPrice(prod.prix)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {form.linked_produit_ids.length === 0 && (
                <p className="text-xs text-amber-500 mt-2">⚠️ Rattachez au moins un produit carte pour enregistrer</p>
              )}
            </div>
          )}

          {/* Photo du plat (optionnel) */}
          <div className="trinity-card">
            <h3 className="font-semibold mb-2">Photo du plat <span className="text-muted-foreground text-sm font-normal">(optionnel)</span></h3>
            <input
              type="text"
              value={form.photo_url || ""}
              onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              placeholder="URL de la photo"
              className="trinity-input"
            />
          </div>

          {/* Ingrédients & Grammages */}
          <div className="trinity-card">
            <h3 className="font-semibold mb-4">Ingrédients & Grammages</h3>
            
            {/* Onglets Produit achat / Sous-fiche */}
            <div className="flex gap-2 border-b border-border mb-4">
              <button
                type="button"
                onClick={() => setIngredientTab("achat")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  ingredientTab === "achat"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📦 Produit (base achats)
              </button>
              <button
                type="button"
                onClick={() => setIngredientTab("sous_fiche")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  ingredientTab === "sous_fiche"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📋 Sous-fiche technique
              </button>
            </div>

            {/* Onglet : Produit (base achats) */}
            {ingredientTab === "achat" && (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={achatsSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log("📝 Input onChange:", value);
                      setAchatsSearch(value);
                      
                      // Clear previous timeout
                      if (searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current);
                      }
                      
                      // Set new timeout (debounce 400ms)
                      searchTimeoutRef.current = setTimeout(() => {
                        console.log("⏱️ Debounce terminé, appel searchAchats");
                        searchAchats(value);
                      }, 400);
                    }}
                    placeholder="Rechercher un produit..."
                    className="trinity-input"
                    disabled={!form.restaurant_id}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.restaurant_id ? "Dernier prix d'achat par fournisseur - cliquez pour sélectionner" : "Sélectionnez d'abord un restaurant"}
                  </p>
                  
                  {/* Debug: afficher le nombre de résultats */}
                  {achatsSearch.length >= 2 && (
                    <p className="text-xs text-amber-500 mt-1">
                      {achatsResults.length} résultat(s) trouvé(s)
                    </p>
                  )}
                  
                  {achatsResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {achatsResults.map((achat, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            console.log("🛒 Sélection achat - Produit brut:", achat.produit);
                            
                            // NOUVEAU : Extraire l'unité DU NOM du produit après le "/"
                            let nomProduit = achat.produit;
                            let uniteExtraite = achat.unite || "";
                            
                            // Si le nom contient "/", c'est que l'unité est dans le nom
                            if (achat.produit && achat.produit.includes('/')) {
                              const parts = achat.produit.split('/');
                              nomProduit = parts[0].trim(); // Ex: "AIL FILET"
                              uniteExtraite = '/' + parts[1].trim(); // Ex: "/500g"
                              console.log("📦 Extraction depuis nom:", {
                                nomProduit,
                                uniteExtraite
                              });
                            }
                            
                            console.log("🔍 Parsing unité:", uniteExtraite);
                            const { unite, quantiteBase } = parseUniteAchat(uniteExtraite);
                            
                            console.log("✅ Après parsing:", { unite, quantiteBase });
                            
                            const newIngData = {
                              nom: nomProduit, // Nom sans l'unité
                              quantite: "",
                              unite: unite,
                              prix_unitaire: achat.prix_unitaire.toString(),
                              type_ingredient: "achat",
                              fournisseur: achat.fournisseur,
                              date_achat: achat.date_achat,
                              quantite_base_achat: quantiteBase,
                              unite_achat_originale: uniteExtraite
                            };
                            
                            console.log("✅ newIngredient DATA à setter:", newIngData);
                            setNewIngredient(newIngData);
                            console.log("✅ setNewIngredient appelé");
                            
                            setAchatsSearch("");
                            setAchatsResults([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-secondary transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{achat.produit}</span>
                            <span className="text-primary font-mono text-sm">{fmtPrice(achat.prix_unitaire)} F/{achat.unite}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {achat.fournisseur} • {achat.date_achat ? new Date(achat.date_achat).toLocaleDateString() : "—"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {newIngredient.nom && newIngredient.type_ingredient === "achat" && (
                  <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{newIngredient.nom}</span>
                      <span className="text-xs text-muted-foreground">{newIngredient.fournisseur}</span>
                    </div>
                    
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <label className="block text-xs text-muted-foreground mb-1">Cond.</label>
                        <select
                          value={newIngredient.unite}
                          onChange={(e) => setNewIngredient({ ...newIngredient, unite: e.target.value })}
                          className="trinity-input text-sm"
                        >
                          {unites.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-muted-foreground mb-1">Qté</label>
                        <input
                          type="text"
                          value={newIngredient.quantite}
                          onChange={(e) => setNewIngredient({ ...newIngredient, quantite: e.target.value })}
                          placeholder="Ex: 80g"
                          className="trinity-input text-sm"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-xs text-muted-foreground mb-1">Coût portion (F)</label>
                        <div className="trinity-input text-sm bg-secondary/50 cursor-not-allowed font-mono">
                          {(() => {
                            console.log("💵 Preview - État newIngredient:", {
                              quantite: newIngredient.quantite,
                              prix_unitaire: newIngredient.prix_unitaire,
                              quantite_base_achat: newIngredient.quantite_base_achat,
                              condition: !!(newIngredient.quantite && newIngredient.prix_unitaire && newIngredient.quantite_base_achat)
                            });
                            
                            if (newIngredient.quantite && newIngredient.prix_unitaire && newIngredient.quantite_base_achat) {
                                const qteDemandee = parseFloat(newIngredient.quantite);
                                const prixUnitaire = parseFloat(newIngredient.prix_unitaire);
                                const qteBase = newIngredient.quantite_base_achat;
                                
                                console.log("💵 Preview Coût - Calcul:", {
                                  qteDemandee,
                                  prixUnitaire,
                                  qteBase,
                                  formule: `(${qteDemandee} / ${qteBase}) * ${prixUnitaire}`
                                });
                                
                                // Le prix est pour qteBase unités
                                // Ex: 310 F pour 500g → si on veut 500g, coût = 310 F
                                //                      → si on veut 250g, coût = 155 F
                                const coutCalcule = (qteDemandee / qteBase) * prixUnitaire;
                                
                                console.log("💵 Preview Coût - Résultat:", coutCalcule, "F");
                                
                                return Math.round(coutCalcule);
                            } else {
                              return "—";
                            }
                          })()}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">&nbsp;</label>
                        <Button variant="primary" onClick={addIngredient} className="w-full">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      PU: {fmtPrice(newIngredient.prix_unitaire)} F/{newIngredient.unite_achat_originale || newIngredient.unite}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Onglet : Sous-fiche technique */}
            {ingredientTab === "sous_fiche" && (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={fichesSearch}
                    onChange={(e) => {
                      setFichesSearch(e.target.value);
                      searchFiches(e.target.value);
                    }}
                    placeholder="Rechercher une fiche..."
                    className="trinity-input"
                    disabled={!form.restaurant_id}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.restaurant_id ? "Fiches existantes - le coût sera calculé au prorata du grammage demandé" : "Sélectionnez d'abord un restaurant"}
                  </p>
                  
                  {fichesResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {fichesResults.map(fiche => (
                        <button
                          key={fiche.id}
                          type="button"
                          onClick={() => {
                            setNewIngredient({
                              nom: fiche.nom,
                              quantite: "",
                              unite: "g",
                              prix_unitaire: "0",
                              type_ingredient: "sous_fiche",
                              fiche_id: fiche.id,
                              fournisseur: null,
                              date_achat: null
                            });
                            setFichesSearch("");
                            setFichesResults([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-secondary transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{fiche.nom}</span>
                            <span className="text-primary font-mono text-sm">{fmtPrice(fiche.prix_vente)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {getRestaurantById(fiche.restaurant_id)?.nom} • {fiche.famille} • {fiche.poids_total_g || 0}g • {fmtPct(fiche.food_cost_pct)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {newIngredient.nom && newIngredient.type_ingredient === "sous_fiche" && (
                  <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                    <div className="font-medium">{newIngredient.nom}</div>
                    
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <label className="block text-xs text-muted-foreground mb-1">Cond.</label>
                        <select
                          value={newIngredient.unite}
                          onChange={(e) => setNewIngredient({ ...newIngredient, unite: e.target.value })}
                          className="trinity-input text-sm"
                        >
                          {unites.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-muted-foreground mb-1">Quantité</label>
                        <input
                          type="text"
                          value={newIngredient.quantite}
                          onChange={(e) => setNewIngredient({ ...newIngredient, quantite: e.target.value })}
                          placeholder="Ex: 80g"
                          className="trinity-input text-sm"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-xs text-muted-foreground mb-1">Coût (F)</label>
                        <div className="trinity-input text-sm bg-secondary/50 cursor-not-allowed font-mono">
                          {(() => {
                            if (!newIngredient.quantite || !newIngredient.fiche_id) return "—";
                            const fiche = fiches.find(f => f.id === newIngredient.fiche_id);
                            if (!fiche || !fiche.poids_total_g) return "—";
                            const ratio = parseFloat(newIngredient.quantite) / fiche.poids_total_g;
                            return Math.round(fiche.cout_total * ratio);
                          })()}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">&nbsp;</label>
                        <Button variant="primary" onClick={addIngredient} className="w-full">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tableau des ingrédients ajoutés */}
            {form.ingredients.length > 0 ? (
              <div className="mt-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase border-b border-border">
                      <th className="text-left py-2">Ingrédient</th>
                      <th className="text-right py-2">Cond.</th>
                      <th className="text-right py-2">Quantité</th>
                      <th className="text-right py-2">Coût (F)</th>
                      <th className="text-right py-2">PU</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.ingredients.map((ing, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {ing.type_ingredient === "sous_fiche" ? "📋" : "📦"}
                            <span>{ing.nom}</span>
                          </div>
                          {ing.fournisseur && (
                            <div className="text-xs text-muted-foreground">{ing.fournisseur}</div>
                          )}
                        </td>
                        <td className="text-right font-mono">{ing.unite}</td>
                        <td className="text-right font-mono">{ing.quantite}</td>
                        <td className="text-right font-mono text-primary">{Math.round(ing.cout_ligne)}</td>
                        <td className="text-right font-mono text-xs text-muted-foreground">
                          {ing.prix_unitaire > 0 ? `${fmtPrice(ing.prix_unitaire)} F/${ing.unite}` : "—"}
                        </td>
                        <td className="text-right">
                          <button 
                            type="button"
                            onClick={() => removeIngredient(idx)} 
                            className="text-destructive hover:bg-destructive/20 p-1 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-primary">
                      <td colSpan="2" className="py-3">TOTAL</td>
                      <td className="text-right font-mono">{Math.round(costs.poidsTotal)}g</td>
                      <td className="text-right font-mono">{fmtPrice(costs.coutTotal)}</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="mt-6 text-center py-8 bg-secondary/30 rounded-lg">
                <Package className="w-12 h-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun ingrédient ajouté — utilisez le formulaire ci-dessus</p>
              </div>
            )}

            {/* Poids total de la fiche */}
            {form.ingredients.length > 0 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Poids total de la fiche</span>
                <span className="font-mono font-bold">{Math.round(costs.poidsTotal)} g</span>
              </div>
            )}
          </div>

          {/* Cost Preview */}
          {form.ingredients.length > 0 && (
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Coût Total</div>
                  <div className="font-mono text-lg">{fmtPrice(costs.coutTotal)}</div>
                </div>
                {form.type_fiche === "produit_fini" ? (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">Coût/Portion</div>
                      <div className="font-mono text-lg">{fmtPrice(costs.coutPortion)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Food Cost</div>
                      <div className={`font-mono text-lg ${getFoodCostColor(costs.foodCost)}`}>
                        {fmtPct(costs.foodCost)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">Coût /KG</div>
                      <div className="font-mono text-lg">{costs.coutParKg > 0 ? fmtPrice(costs.coutParKg) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Coût /L</div>
                      <div className="font-mono text-lg">{costs.coutParKg > 0 ? fmtPrice(costs.coutParKg) : "—"}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <Select
            label="Statut"
            value={form.statut}
            onChange={(v) => setForm({ ...form, statut: v })}
            options={[{ value: "brouillon", label: "Brouillon" }, { value: "fait", label: "Fait" }]}
          />

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={resetForm} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="flex-1" data-testid="save-fiche-btn">
              {editingId ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ====================== BUDGET VS RÉEL MODULE ======================

const BudgetVsReelModule = ({ restaurants }) => {
  const [loading, setLoading] = useState(false);
  const [vue, setVue] = useState("groupe"); // "groupe" ou "restaurant"
  const [periode, setPeriode] = useState("mensuel"); // "mensuel" ou "quotidien"
  const [moisSelectionne, setMoisSelectionne] = useState("2026-03"); // Default mars 2026
  const [restaurantSelectionne, setRestaurantSelectionne] = useState(null);
  const [data, setData] = useState(null);

  // Charger les données
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = "";
      
      if (vue === "groupe") {
        endpoint = `dashboard/budget-vs-reel/groupe/${periode}?mois=${moisSelectionne}`;
      } else {
        if (!restaurantSelectionne) return;
        endpoint = `dashboard/budget-vs-reel/restaurant/${restaurantSelectionne.id}/${periode}?mois=${moisSelectionne}`;
      }

      console.log("🔍 Budget API URL:", `${API}/${endpoint}`);
      const res = await axios.get(`${API}/${endpoint}`);
      setData(res.data);
    } catch (err) {
      console.error("Erreur chargement données budget:", err);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, [vue, periode, moisSelectionne, restaurantSelectionne]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format de prix
  const fmtPrice = (val) => {
    if (!val || val === 0) return "0 F";
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return `${(val / 1000000).toFixed(2)}M F`;
    } else if (absVal >= 1000) {
      return `${(val / 1000).toFixed(0)}k F`;
    }
    return `${Math.round(val)} F`;
  };

  // Composant KPI Card
  const KPICard = ({ label, value, subtext, color = "blue" }) => {
    const colorClasses = {
      blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      green: "bg-green-500/10 text-green-400 border-green-500/20",
      red: "bg-red-500/10 text-red-400 border-red-500/20",
      orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      purple: "bg-purple-500/10 text-purple-400 border-purple-500/20"
    };

    return (
      <div className={`p-4 rounded-lg border ${colorClasses[color] || colorClasses.blue}`}>
        <div className="text-xs uppercase tracking-wide opacity-70 mb-2">{label}</div>
        <div className="text-2xl font-bold">{fmtPrice(value)}</div>
        {subtext && <div className="text-sm mt-1 opacity-80">{subtext}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec titre et contrôles */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="w-8 h-8" />
          Budget vs Réel - {vue === "groupe" ? "GROUPE" : restaurantSelectionne?.nom || ""}
        </h1>

        {/* Sélecteur de mois */}
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={moisSelectionne}
            onChange={(e) => setMoisSelectionne(e.target.value)}
            className="px-4 py-2 rounded-lg bg-secondary border border-border text-foreground"
          />
        </div>
      </div>

      {/* Navigation Vue (Groupe / Restaurant) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVue("groupe")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            vue === "groupe"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Vue Groupe
        </button>
        <button
          onClick={() => setVue("restaurant")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            vue === "restaurant"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Vue Restaurant
        </button>

        {vue === "restaurant" && (
          <select
            value={restaurantSelectionne?.id || ""}
            onChange={(e) => {
              const resto = restaurants.find(r => r.id === e.target.value);
              setRestaurantSelectionne(resto);
            }}
            className="px-4 py-2 rounded-lg bg-secondary border border-border text-foreground"
          >
            <option value="">Sélectionner un restaurant</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.nom}</option>
            ))}
          </select>
        )}
      </div>

      {/* Toggle Mensuel / Quotidien */}
      <div className="flex items-center gap-2 bg-secondary p-1 rounded-lg w-fit">
        <button
          onClick={() => setPeriode("mensuel")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            periode === "mensuel"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          📊 Mensuel
        </button>
        <button
          onClick={() => setPeriode("quotidien")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            periode === "quotidien"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          📅 Quotidien
        </button>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Aucune donnée disponible</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="CA Budget"
              value={data.kpis?.ca_budget || 0}
              color="blue"
            />
            <KPICard
              label="CA Réel"
              value={data.kpis?.ca_reel || 0}
              color="purple"
            />
            <KPICard
              label="Écart CA"
              value={data.kpis?.ecart_ca || 0}
              subtext={`${(data.kpis?.ecart_ca_pct || 0).toFixed(1)}%`}
              color={data.kpis?.ecart_ca >= 0 ? "green" : "red"}
            />
            <KPICard
              label="Écart Food Cost"
              value={data.kpis?.ecart_food || 0}
              color={data.kpis?.ecart_food <= 0 ? "green" : "red"}
            />
          </div>

          {/* Tableau Mensuel */}
          {periode === "mensuel" && data.donnees_mensuelles && (
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-medium mb-4">
                📊 Budget vs Réel - {vue === "groupe" ? "Groupe" : (data.restaurant?.nom || restaurantSelectionne?.nom || "Restaurant")}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-2 px-4">Mois</th>
                      <th className="text-right py-2 px-4">CA Budget</th>
                      <th className="text-right py-2 px-4">CA Réel</th>
                      <th className="text-right py-2 px-4">Écart</th>
                      <th className="text-right py-2 px-4">Écart %</th>
                      <th className="text-center py-2 px-4">Atteinte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.donnees_mensuelles.map((m, idx) => (
                      <tr key={idx} className="border-b border-border/30">
                        <td className="py-2 px-4">{m.mois}</td>
                        <td className="text-right py-2 px-4 font-mono text-blue-400">{fmtPrice(m.ca_budget)}</td>
                        <td className="text-right py-2 px-4 font-mono text-purple-400">{fmtPrice(m.ca_reel)}</td>
                        <td className={`text-right py-2 px-4 font-mono ${m.ecart >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmtPrice(m.ecart)}
                        </td>
                        <td className={`text-right py-2 px-4 font-mono ${m.ecart_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(m.ecart_pct || 0).toFixed(1)}%
                        </td>
                        <td className="text-center py-2 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-secondary rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${m.atteinte_pct >= 100 ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(m.atteinte_pct || 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono">{(m.atteinte_pct || 0).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vue Quotidienne */}
          {periode === "quotidien" && data.stats && (
            <div className="space-y-6">
              {/* Stats additionnelles */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="p-4 rounded-lg bg-secondary border border-border">
                  <div className="text-xs uppercase opacity-70 mb-1">Budget Mois</div>
                  <div className="text-lg font-bold">{fmtPrice(data.stats.budget_mois)}</div>
                </div>
                <div className="p-4 rounded-lg bg-secondary border border-border">
                  <div className="text-xs uppercase opacity-70 mb-1">Budget/Jour</div>
                  <div className="text-lg font-bold">{fmtPrice(data.stats.budget_jour_moyen)}</div>
                </div>
                <div className="p-4 rounded-lg bg-secondary border border-border">
                  <div className="text-xs uppercase opacity-70 mb-1">Cumul J22</div>
                  <div className="text-lg font-bold text-cyan-400">{fmtPrice(data.stats.cumul_ca)}</div>
                </div>
                <div className="p-4 rounded-lg bg-secondary border border-border">
                  <div className="text-xs uppercase opacity-70 mb-1">Atteinte</div>
                  <div className="text-lg font-bold text-green-400">{(data.stats.atteinte_pct || 0).toFixed(1)}%</div>
                </div>
                <div className="p-4 rounded-lg bg-secondary border border-border">
                  <div className="text-xs uppercase opacity-70 mb-1">Reste</div>
                  <div className="text-lg font-bold text-orange-400">{fmtPrice(data.stats.reste)}</div>
                </div>
                <div className="p-4 rounded-lg bg-secondary border border-border">
                  <div className="text-xs uppercase opacity-70 mb-1">Obj/Jour Restant</div>
                  <div className="text-lg font-bold">{fmtPrice(data.stats.obj_jour_restant)}</div>
                </div>
              </div>

              {/* Calendrier quotidien */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-medium mb-4">📅 Calendrier Quotidien</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-2">Jour</th>
                        <th className="text-right py-2 px-2">CA Jour</th>
                        <th className="text-right py-2 px-2">Écart/j</th>
                        <th className="text-right py-2 px-2">Cumul</th>
                        <th className="text-right py-2 px-2">Écart Cum.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.donnees_quotidiennes?.map((j, idx) => (
                        <tr key={idx} className="border-b border-border/30">
                          <td className="py-1 px-2">{j.jour}</td>
                          <td className="text-right py-1 px-2 font-mono">{fmtPrice(j.ca_jour)}</td>
                          <td className={`text-right py-1 px-2 font-mono ${j.ecart_jour >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fmtPrice(j.ecart_jour)}
                          </td>
                          <td className="text-right py-1 px-2 font-mono text-cyan-400">{fmtPrice(j.cumul)}</td>
                          <td className={`text-right py-1 px-2 font-mono ${j.ecart_cumul >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fmtPrice(j.ecart_cumul)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Barre de progression */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Progression mois</span>
                    <span className="text-sm font-medium">
                      {(data.stats.atteinte_pct || 0).toFixed(1)}% atteint en {data.stats.jour_actuel}/{data.stats.nb_jours_mois} jours
                    </span>
                  </div>
                  <div className="bg-secondary rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${data.stats.en_avance ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(data.stats.atteinte_pct || 0, 100)}%` }}
                    />
                  </div>
                  <div className="text-right text-xs mt-1 text-green-400">
                    {data.stats.en_avance ? "✓ En avance" : "⚠ En retard"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ====================== IMPORT VENTES ======================


export default FichesModule;
