import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, X } from "lucide-react";
import { RESTO_COLORS } from "@/utils/colors";
import API from "@/utils/api";

const RestaurantsModule = ({ restaurants, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nom: "", code: "", type: "RESTAURANT", couleur: "#f97316", actif: true
  });

  const resetForm = () => {
    setForm({ nom: "", code: "", type: "RESTAURANT", couleur: "#f97316", actif: true });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (resto) => {
    setForm({
      nom: resto.nom,
      code: resto.code,
      type: resto.type,
      couleur: resto.couleur,
      actif: resto.actif
    });
    setEditingId(resto.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.nom || !form.code) {
      toast.error("Nom et code requis");
      return;
    }
    try {
      if (editingId) {
        await axios.put(`${API}/restaurants/${editingId}`, form);
        toast.success("Restaurant mis à jour");
      } else {
        await axios.post(`${API}/restaurants`, form);
        toast.success("Restaurant créé");
      }
      resetForm();
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce restaurant ?")) return;
    try {
      await axios.delete(`${API}/restaurants/${id}`);
      toast.success("Restaurant supprimé");
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6" data-testid="restaurants-module">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Restaurants</h1>
          <p className="text-muted-foreground">Gérez vos établissements</p>
        </div>
        <Button icon={Plus} onClick={() => setShowForm(true)} data-testid="add-restaurant-btn">
          Nouveau Restaurant
        </Button>
      </div>

      {restaurants.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((resto) => (
            <div 
              key={resto.id} 
              className="trinity-card group"
              style={{ borderLeftWidth: '4px', borderLeftColor: resto.couleur }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{resto.nom}</h3>
                  <span className="text-sm text-muted-foreground">{resto.code}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <button 
                    onClick={() => handleEdit(resto)}
                    className="p-1 hover:bg-accent rounded"
                    data-testid={`edit-restaurant-${resto.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(resto.id)}
                    className="p-1 hover:bg-destructive/20 rounded text-destructive"
                    data-testid={`delete-restaurant-${resto.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pill type={resto.actif ? "success" : "warning"}>
                  {resto.actif ? "Actif" : "Inactif"}
                </Pill>
                <span className="text-xs text-muted-foreground">{resto.type}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="Aucun restaurant"
          description="Créez votre premier restaurant pour commencer"
          action={
            <Button icon={Plus} onClick={() => setShowForm(true)}>
              Créer un restaurant
            </Button>
          }
        />
      )}

      {/* Form Modal */}
      <Modal 
        isOpen={showForm} 
        onClose={resetForm} 
        title={editingId ? "Modifier le restaurant" : "Nouveau restaurant"}
      >
        <div className="space-y-4">
          <Input
            label="Nom du restaurant"
            value={form.nom}
            onChange={(v) => setForm({ ...form, nom: v })}
            placeholder="Ex: Le Bistrot"
            data-testid="restaurant-name-input"
          />
          <Input
            label="Code"
            value={form.code}
            onChange={(v) => setForm({ ...form, code: v.toUpperCase() })}
            placeholder="Ex: BISTROT"
            data-testid="restaurant-code-input"
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v })}
            options={["RESTAURANT", "BAR", "PRODUCTION"]}
          />
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {RESTO_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setForm({ ...form, couleur: c.hex })}
                  className={`w-8 h-8 rounded-full border-2 ${form.couleur === c.hex ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.actif}
              onChange={(e) => setForm({ ...form, actif: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm">Restaurant actif</label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={resetForm} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="flex-1" data-testid="save-restaurant-btn">
              {editingId ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ====================== CARTE & PRODUITS ======================

const CarteModule = ({ restaurants, produits, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRestaurant, setFilterRestaurant] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("");
  const [form, setForm] = useState({
    nom: "", restaurant_id: "", categorie: "", prix_vente: "", 
    is_food: true, description: "", touches_psw: ""
  });

  // Extraire les catégories uniques des produits (tenant compte du filtre restaurant)
  const getUniqueCategories = () => {
    let produitsToConsider = produits;
    
    // Si un restaurant est sélectionné, ne considérer que ses produits
    if (filterRestaurant) {
      produitsToConsider = produits.filter(p => p.restaurant_id === filterRestaurant);
    }
    
    // Extraire toutes les catégories uniques
    const uniqueCategories = [...new Set(
      produitsToConsider
        .map(p => p.categorie)
        .filter(c => c && c.trim() !== '') // Filtrer les catégories vides
    )].sort(); // Trier par ordre alphabétique
    
    return uniqueCategories.map(cat => ({ value: cat, label: cat }));
  };

  const categories = getUniqueCategories();

  // Réinitialiser le filtre de catégorie quand on change de restaurant
  // car les catégories disponibles peuvent changer
  React.useEffect(() => {
    if (filterRestaurant && filterCategorie) {
      // Vérifier si la catégorie sélectionnée existe toujours pour ce restaurant
      const categoriesDisponibles = categories.map(c => c.value);
      if (!categoriesDisponibles.includes(filterCategorie)) {
        setFilterCategorie(""); // Réinitialiser si la catégorie n'existe plus
      }
    }
  }, [filterRestaurant]);

  const filteredProduits = produits.filter((p) => {
    if (search && !p.nom.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRestaurant && p.restaurant_id !== filterRestaurant) return false;
    if (filterCategorie && p.categorie !== filterCategorie) return false;
    return true;
  });

  const resetForm = () => {
    setForm({ nom: "", restaurant_id: "", categorie: "", prix_vente: "", is_food: true, description: "", touches_psw: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (prod) => {
    setForm({
      nom: prod.nom,
      restaurant_id: prod.restaurant_id,
      categorie: prod.categorie,
      prix_vente: prod.prix_vente.toString(),
      is_food: prod.is_food,
      description: prod.description || "",
      touches_psw: prod.touches_psw || ""
    });
    setEditingId(prod.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.nom || !form.restaurant_id || !form.categorie || !form.prix_vente) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    try {
      const data = { ...form, prix_vente: parseFloat(form.prix_vente) };
      if (editingId) {
        await axios.put(`${API}/produits/${editingId}`, data);
        toast.success("Produit mis à jour");
      } else {
        await axios.post(`${API}/produits`, data);
        toast.success("Produit créé");
      }
      resetForm();
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    try {
      await axios.delete(`${API}/produits/${id}`);
      toast.success("Produit supprimé");
      onRefresh();
    } catch (err) {
      toast.error("Erreur: " + (err.response?.data?.detail || err.message));
    }
  };

  const getRestaurantById = (id) => restaurants.find(r => r.id === id);

  return (
    <div className="space-y-6" data-testid="carte-module">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Carte & Produits</h1>
          <p className="text-muted-foreground">{filteredProduits.length} produit{filteredProduits.length > 1 ? 's' : ''}</p>
        </div>
        <Button icon={Plus} onClick={() => setShowForm(true)} data-testid="add-produit-btn">
          Nouveau Produit
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
            placeholder="Rechercher un produit..."
            className="trinity-input pl-10"
            data-testid="search-produit"
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
          value={filterCategorie}
          onChange={setFilterCategorie}
          options={categories}
          placeholder="Toutes catégories"
          className="min-w-[180px]"
        />
      </div>

      {/* Products List */}
      {filteredProduits.length > 0 ? (
        <div className="trinity-card overflow-hidden p-0">
          <table className="trinity-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Restaurant</th>
                <th>Catégorie</th>
                <th>Type</th>
                <th className="text-right">Prix TTC</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProduits.map((prod) => {
                const resto = getRestaurantById(prod.restaurant_id);
                return (
                  <tr key={prod.id}>
                    <td>
                      <span className="font-medium">{prod.nom}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: resto?.couleur || '#666' }}
                        />
                        <span className="text-muted-foreground text-sm">{resto?.nom || '—'}</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground">{prod.categorie}</td>
                    <td>
                      <Pill type={prod.is_food ? "food" : "drink"}>
                        {prod.is_food ? "Nourriture" : "Boisson"}
                      </Pill>
                    </td>
                    <td className="text-right font-mono">{fmtPrice(prod.prix_vente)}</td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button 
                          onClick={() => handleEdit(prod)}
                          className="p-1 hover:bg-accent rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(prod.id)}
                          className="p-1 hover:bg-destructive/20 rounded text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={UtensilsCrossed}
          title={search || filterRestaurant || filterCategorie ? "Aucun résultat" : "Aucun produit"}
          description={search || filterRestaurant || filterCategorie 
            ? "Essayez de modifier vos filtres"
            : "Ajoutez vos premiers produits à la carte"
          }
          action={!search && !filterRestaurant && !filterCategorie && (
            <Button icon={Plus} onClick={() => setShowForm(true)}>
              Ajouter un produit
            </Button>
          )}
        />
      )}

      {/* Form Modal */}
      <Modal 
        isOpen={showForm} 
        onClose={resetForm} 
        title={editingId ? "Modifier le produit" : "Nouveau produit"}
      >
        <div className="space-y-4">
          <Input
            label="Nom du produit *"
            value={form.nom}
            onChange={(v) => setForm({ ...form, nom: v })}
            placeholder="Ex: Burger Classic"
            data-testid="produit-name-input"
          />
          <Select
            label="Restaurant *"
            value={form.restaurant_id}
            onChange={(v) => setForm({ ...form, restaurant_id: v })}
            options={restaurants.map(r => ({ value: r.id, label: r.nom }))}
            placeholder="Sélectionner un restaurant"
          />
          <Select
            label="Catégorie *"
            value={form.categorie}
            onChange={(v) => setForm({ ...form, categorie: v })}
            options={categories}
            placeholder="Sélectionner une catégorie"
          />
          <Input
            label="Prix de vente TTC (XPF) *"
            type="number"
            value={form.prix_vente}
            onChange={(v) => setForm({ ...form, prix_vente: v })}
            placeholder="Ex: 12.50"
            data-testid="produit-price-input"
          />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={form.is_food}
                onChange={() => setForm({ ...form, is_food: true })}
              />
              <span className="text-sm">Nourriture</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!form.is_food}
                onChange={() => setForm({ ...form, is_food: false })}
              />
              <span className="text-sm">Boisson</span>
            </label>
          </div>
          <Input
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Description du produit (optionnel)"
          />
          <Input
            label="Touches PSW"
            value={form.touches_psw}
            onChange={(v) => setForm({ ...form, touches_psw: v })}
            placeholder="Touches caisse (optionnel)"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={resetForm} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="flex-1" data-testid="save-produit-btn">
              {editingId ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ====================== FICHES TECHNIQUES ======================


// ====================== PRODUITS ACHATS ======================

const ProduitsAchatsModule = ({ restaurants }) => {
  const [achats, setAchats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFournisseur, setSelectedFournisseur] = useState("all");
  const [sortBy, setSortBy] = useState("name"); // name, price, hausse, fournisseur
  const [expandedProduct, setExpandedProduct] = useState(null);

  useEffect(() => {
    loadAchats();
  }, [selectedRestaurant]);

  const loadAchats = async () => {
    setLoading(true);
    try {
      const query = selectedRestaurant ? `?restaurant_id=${selectedRestaurant}` : '';
      const response = await axios.get(`${API}/achats${query}`);
      setAchats(response.data);
    } catch (err) {
      console.error('Erreur chargement achats:', err);
      toast.error("Erreur de chargement des achats");
    } finally {
      setLoading(false);
    }
  };

  // Grouper les achats par produit avec historique
  const produitsGroupes = useMemo(() => {
    const grouped = {};
    
    achats.forEach(achat => {
      const key = achat.produit;
      if (!grouped[key]) {
        grouped[key] = {
          produit: achat.produit,
          fournisseur: achat.fournisseur,
          categorie: achat.categorie || "Autres",
          historique: [],
          dernierPrix: 0,
          prixMoyen: 0,
          evolution: 0,
          nbCommandes: 0,
          multiF: false
        };
      }
      
      grouped[key].historique.push({
        date: achat.date_achat,
        prix: achat.prix_unitaire,
        quantite: achat.quantite,
        total: achat.total,
        fournisseur: achat.fournisseur
      });
    });

    // Calculer les stats pour chaque produit
    Object.values(grouped).forEach(p => {
      p.historique.sort((a, b) => new Date(b.date) - new Date(a.date));
      p.dernierPrix = p.historique[0]?.prix || 0;
      p.prixMoyen = p.historique.reduce((sum, h) => sum + h.prix, 0) / p.historique.length;
      p.nbCommandes = p.historique.length;
      
      // Calculer l'évolution (dernier vs avant-dernier)
      if (p.historique.length >= 2) {
        const dernier = p.historique[0].prix;
        const avantDernier = p.historique[1].prix;
        p.evolution = ((dernier - avantDernier) / avantDernier * 100);
      }
      
      // Vérifier multi-fournisseur
      const fournisseurs = [...new Set(p.historique.map(h => h.fournisseur))];
      p.multiF = fournisseurs.length > 1;
    });

    return Object.values(grouped);
  }, [achats]);

  // Filtres
  const produitsFiltres = useMemo(() => {
    let filtered = produitsGroupes;

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.produit.toLowerCase().includes(query) ||
        p.fournisseur.toLowerCase().includes(query) ||
        p.categorie.toLowerCase().includes(query)
      );
    }

    // Filtre par fournisseur
    if (selectedFournisseur !== "all") {
      filtered = filtered.filter(p => p.fournisseur === selectedFournisseur);
    }

    // Tri
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price":
          return b.dernierPrix - a.dernierPrix;
        case "hausse":
          return b.evolution - a.evolution;
        case "fournisseur":
          return a.fournisseur.localeCompare(b.fournisseur);
        default:
          return a.produit.localeCompare(b.produit);
      }
    });

    return filtered;
  }, [produitsGroupes, searchQuery, selectedFournisseur, sortBy]);

  // KPIs
  const stats = useMemo(() => {
    const fournisseurs = [...new Set(achats.map(a => a.fournisseur))];
    const categories = [...new Set(produitsGroupes.map(p => p.categorie))];
    const avecHausse = produitsGroupes.filter(p => p.evolution > 0).length;
    const multiF = produitsGroupes.filter(p => p.multiF).length;

    return {
      nbProduits: produitsGroupes.length,
      nbFournisseurs: fournisseurs.length,
      nbCategories: categories.length,
      avecHausse,
      multiF,
      fournisseurs
    };
  }, [achats, produitsGroupes]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold mb-1">Produits achats</h1>
        <p className="text-xs text-muted-foreground">
          Listing produits · Fournisseurs · Historique prix
        </p>
      </div>

      {/* Si aucune donnée, afficher un message d'accueil */}
      {achats.length === 0 && !loading ? (
        <div className="trinity-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-primary opacity-50" />
            <h3 className="text-xl font-bold mb-2">Aucune donnée d'achats</h3>
            <p className="text-muted-foreground mb-6">
              Importez un fichier d'achats pour commencer à suivre vos produits et fournisseurs.
            </p>
            <button
              onClick={() => window.scrollTo(0, 0)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              ➜ Aller à Import Données
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="trinity-card" style={{ borderLeft: '3px solid #3b82f6' }}>
              <div className="text-xs text-muted-foreground uppercase mb-1">Produits</div>
              <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>{stats.nbProduits}</div>
              <div className="text-xs text-muted-foreground mt-1">Au 30</div>
            </div>

            <div className="trinity-card" style={{ borderLeft: '3px solid #f97316' }}>
              <div className="text-xs text-muted-foreground uppercase mb-1">Fournisseurs</div>
              <div className="text-3xl font-bold" style={{ color: '#f97316' }}>{stats.nbFournisseurs}</div>
            </div>

            <div className="trinity-card" style={{ borderLeft: '3px solid #3b82f6' }}>
              <div className="text-xs text-muted-foreground uppercase mb-1">Catégories</div>
              <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>{stats.nbCategories}</div>
            </div>

            <div className="trinity-card" style={{ borderLeft: '3px solid #f87171' }}>
              <div className="text-xs text-muted-foreground uppercase mb-1">Avec Hausse</div>
              <div className="text-3xl font-bold" style={{ color: '#f87171' }}>{stats.avecHausse}</div>
              <div className="text-xs text-muted-foreground mt-1">&gt;0%</div>
            </div>

            <div className="trinity-card" style={{ borderLeft: '3px solid #f97316' }}>
              <div className="text-xs text-muted-foreground uppercase mb-1">Multi-Fourn.</div>
              <div className="text-3xl font-bold" style={{ color: '#f97316' }}>{stats.multiF}</div>
            </div>
          </div>

      {/* Filtres Restaurant */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedRestaurant(null)}
          className={`px-3 py-1.5 text-xs rounded-full transition ${
            !selectedRestaurant 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          Tous restaurants
        </button>
        {restaurants.filter(r => r.actif).slice(0, 8).map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedRestaurant(r.id)}
            className={`px-3 py-1.5 text-xs rounded-full transition ${
              selectedRestaurant === r.id
                ? 'text-white'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
            style={selectedRestaurant === r.id ? { backgroundColor: r.couleur } : {}}
          >
            {r.nom}
          </button>
        ))}
      </div>

      {/* Barre de recherche et filtres */}
      <div className="trinity-card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Rechercher produit, fournisseur, catégorie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full trinity-input"
            />
          </div>
          
          <select
            value={selectedFournisseur}
            onChange={(e) => setSelectedFournisseur(e.target.value)}
            className="trinity-input md:w-48"
          >
            <option value="all">Tous fournisseurs</option>
            {stats.fournisseurs.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <div className="flex gap-2">
            {['A-Z', 'Prix +', 'Hausse +', 'Fourn.'].map((label, idx) => {
              const values = ['name', 'price', 'hausse', 'fournisseur'];
              return (
                <button
                  key={label}
                  onClick={() => setSortBy(values[idx])}
                  className={`px-3 py-1.5 text-xs rounded transition ${
                    sortBy === values[idx]
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tableau des produits */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : produitsFiltres.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucun produit trouvé. Importez des achats pour commencer.
        </div>
      ) : (
        <div className="trinity-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Produit</th>
                  <th className="text-left py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Fournisseur</th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Dernier Prix</th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Test ?</th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Evolution</th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Cmdes</th>
                  <th className="text-left py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Catégorie</th>
                </tr>
              </thead>
              <tbody>
                {produitsFiltres.map((p, idx) => (
                  <React.Fragment key={idx}>
                    <tr 
                      className="border-b border-border/50 hover:bg-accent/30 cursor-pointer transition"
                      onClick={() => setExpandedProduct(expandedProduct === idx ? null : idx)}
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.produit}</span>
                          {p.evolution > 5 && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded">
                              Hausse
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm" style={{ color: '#2dd4bf' }}>{p.fournisseur}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm font-mono font-bold" style={{ color: '#fbbf24' }}>
                          {fmtPrice(p.dernierPrix)} F
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-xs text-muted-foreground">
                          {p.prixMoyen.toFixed(0)} F
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {p.evolution !== 0 && (
                          <span 
                            className="text-sm font-mono font-bold"
                            style={{ color: p.evolution > 0 ? '#f87171' : '#34d399' }}
                          >
                            {p.evolution > 0 ? '+' : ''}{p.evolution.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-sm">{p.nbCommandes}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-xs text-muted-foreground">{p.categorie}</span>
                      </td>
                    </tr>
                    
                    {/* Historique expandable */}
                    {expandedProduct === idx && (
                      <tr>
                        <td colSpan="7" className="p-4 bg-secondary/30">
                          <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              📊 Historique des commandes — {p.produit}
                            </div>
                            
                            <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                              {p.historique.slice(0, 8).map((h, hidx) => (
                                <div key={hidx} className="flex justify-between py-1 px-2 bg-background/50 rounded">
                                  <span className="text-muted-foreground">{h.date}</span>
                                  <span className="font-mono">{fmtPrice(h.prix)} F</span>
                                  <span className="text-muted-foreground">{h.quantite} {h.unite || 'unité'}</span>
                                </div>
                              ))}
                            </div>
                            
                            <div className="flex gap-4 text-xs">
                              <span>Total commandes: <strong>{p.nbCommandes}</strong></span>
                              <span>Montant total: <strong>{fmtPrice(p.historique.reduce((s, h) => s + h.total, 0))} F</strong></span>
                              <span>PU moyen: <strong>{fmtPrice(p.prixMoyen)} F</strong></span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};


export default RestaurantsModule;
