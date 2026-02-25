import { useState, useEffect, useCallback, createContext, useContext } from "react";
import "@/App.css";
import axios from "axios";
import { 
  LayoutDashboard, Store, UtensilsCrossed, UploadCloud, 
  ChevronLeft, ChevronRight, Plus, Search, Filter, X, 
  Trash2, Edit, FileSpreadsheet, ChevronDown, ChevronUp,
  Building2, Package, FileText, TrendingUp, AlertCircle, Check
} from "lucide-react";
import { Toaster, toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Restaurant context for color theming
const RestaurantContext = createContext(null);

// Couleurs disponibles pour les restaurants
const RESTO_COLORS = [
  { name: "Orange", hex: "#f97316" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Rose", hex: "#ec4899" },
  { name: "Bleu", hex: "#3b82f6" },
  { name: "Emeraude", hex: "#10b981" },
  { name: "Ambre", hex: "#f59e0b" },
];

// ====================== UTILITIES ======================

// Devise : Franc Pacifique (XPF) - pas de décimales
const CURRENCY = "XPF";
const CURRENCY_SYMBOL = " F";

const fmt = (n, decimals = 0) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  }).format(n);
};

const fmtPrice = (n) => {
  // Format prix en XPF (sans décimales)
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(Math.round(n)) + CURRENCY_SYMBOL;
};

const fmtK = (n) => {
  if (n === null || n === undefined) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return fmt(n, 0);
};

const fmtPct = (n) => `${fmt(n, 1)}%`;

const getFoodCostColor = (pct) => {
  if (pct < 25) return "text-emerald-400";
  if (pct < 35) return "text-amber-400";
  return "text-red-400";
};

const getGaugeClass = (pct) => {
  if (pct < 25) return "gauge-green";
  if (pct < 35) return "gauge-orange";
  return "gauge-red";
};

// ====================== UI COMPONENTS ======================

const KPICard = ({ label, value, suffix = "", color = null, icon: Icon = null }) => (
  <div className="kpi-card animate-fade-in" data-testid={`kpi-${label.toLowerCase().replace(/\s/g, '-')}`}>
    <div className="flex items-center justify-between">
      <span className="kpi-label">{label}</span>
      {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`kpi-value ${color || ''}`} style={color?.startsWith('#') ? { color } : {}}>
        {value}
      </span>
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);

const Gauge = ({ value, max = 100, label = "" }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1" data-testid="gauge">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono ${getFoodCostColor(value)}`}>{fmtPct(value)}</span>
      </div>
      <div className="gauge-container">
        <div className={`gauge-fill ${getGaugeClass(value)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Pill = ({ type, children }) => (
  <span className={`pill pill-${type}`} data-testid="pill">{children}</span>
);

const ProgressBar = ({ value, max, color = "#f97316" }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
};

const Button = ({ children, variant = "primary", onClick, disabled = false, className = "", icon: Icon = null, ...props }) => (
  <button 
    className={`trinity-btn trinity-btn-${variant} ${className}`}
    onClick={onClick}
    disabled={disabled}
    {...props}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {children}
  </button>
);

const Input = ({ label, value, onChange, type = "text", placeholder = "", className = "", ...props }) => (
  <div className={`space-y-1 ${className}`}>
    {label && <label className="text-sm text-muted-foreground">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="trinity-input"
      {...props}
    />
  </div>
);

const Select = ({ label, value, onChange, options, placeholder = "Sélectionner...", className = "" }) => (
  <div className={`space-y-1 ${className}`}>
    {label && <label className="text-sm text-muted-foreground">{label}</label>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="trinity-input"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value || opt} value={opt.value || opt}>
          {opt.label || opt}
        </option>
      ))}
    </select>
  </div>
);

const EmptyState = ({ icon: Icon = Package, title, description, action = null }) => (
  <div className="empty-state" data-testid="empty-state">
    <Icon className="empty-state-icon" />
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-text">{description}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="modal">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto animate-fade-in">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// ====================== SIDEBAR ======================

const Sidebar = ({ collapsed, setCollapsed, activeModule, setActiveModule, restaurants }) => {
  const modules = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, pole: "GROUPE" },
    { id: "restaurants", label: "Restaurants", icon: Building2, pole: "RESTAURANTS" },
    { id: "carte", label: "Carte & Produits", icon: UtensilsCrossed, pole: "MENU" },
    { id: "fiches", label: "Fiches Techniques", icon: FileText, pole: "MENU" },
    { id: "import", label: "Import Ventes", icon: UploadCloud, pole: "OUTILS" },
  ];

  const poles = [...new Set(modules.map(m => m.pole))];

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`} data-testid="sidebar">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!collapsed && <h1 className="text-xl font-bold tracking-tight">Trinity</h1>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-accent rounded-md"
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {poles.map((pole) => (
          <div key={pole} className="mb-4">
            {!collapsed && (
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {pole}
              </div>
            )}
            {modules.filter(m => m.pole === pole).map((mod) => (
              <div
                key={mod.id}
                className={`nav-item ${activeModule === mod.id ? 'active' : ''}`}
                onClick={() => setActiveModule(mod.id)}
                data-testid={`nav-${mod.id}`}
              >
                <mod.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{mod.label}</span>}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer stats */}
      {!collapsed && (
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {restaurants.length} restaurant{restaurants.length > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </aside>
  );
};

// ====================== DASHBOARD ======================

const Dashboard = ({ stats, restaurantStats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="kpi-card animate-pulse-soft">
            <div className="h-4 bg-muted rounded w-24 mb-2" />
            <div className="h-8 bg-muted rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre groupe</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          label="Chiffre d'Affaires" 
          value={fmtK(stats.ca_total)} 
          suffix="F" 
          icon={TrendingUp}
        />
        <KPICard 
          label="Restaurants" 
          value={stats.restaurants_count} 
          icon={Building2}
        />
        <KPICard 
          label="Produits Carte" 
          value={stats.produits_count} 
          icon={Package}
        />
        <KPICard 
          label="Fiches Techniques" 
          value={stats.fiches_count} 
          icon={FileText}
        />
      </div>

      {/* Food Cost Gauge */}
      {stats.avg_food_cost > 0 && (
        <div className="trinity-card max-w-md">
          <h3 className="text-sm font-medium mb-3">Food Cost Moyen</h3>
          <Gauge value={stats.avg_food_cost} label="Food Cost %" />
        </div>
      )}

      {/* Restaurants Stats */}
      {restaurantStats.length > 0 ? (
        <div className="trinity-card">
          <h3 className="text-lg font-semibold mb-4">Performance par Restaurant</h3>
          <div className="overflow-x-auto">
            <table className="trinity-table">
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Type</th>
                  <th className="text-right">CA Total</th>
                  <th className="text-right">Ventes</th>
                  <th className="text-right">Produits</th>
                  <th className="text-right">Fiches</th>
                </tr>
              </thead>
              <tbody>
                {restaurantStats.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: r.couleur }}
                        />
                        <span className="font-medium">{r.nom}</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground">{r.type}</td>
                    <td className="text-right font-mono">{fmtPrice(r.ca_total)}</td>
                    <td className="text-right font-mono">{fmt(r.nb_ventes)}</td>
                    <td className="text-right font-mono">{r.produits_count}</td>
                    <td className="text-right font-mono">{r.fiches_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="Aucun restaurant"
          description="Commencez par créer votre premier restaurant pour voir les statistiques"
        />
      )}

      {/* Top Ventes */}
      {stats.top_ventes && stats.top_ventes.length > 0 && (
        <div className="trinity-card">
          <h3 className="text-lg font-semibold mb-4">Top 10 Ventes</h3>
          <div className="space-y-3">
            {stats.top_ventes.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="w-6 text-sm font-mono text-muted-foreground">{idx + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.nom}</span>
                    <Pill type={item.is_food ? "food" : "drink"}>
                      {item.is_food ? "N" : "B"}
                    </Pill>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-muted-foreground">{item.quantite} vendus</span>
                    <span className="text-xs font-mono">{fmt(item.ca, 2)} €</span>
                  </div>
                </div>
                <ProgressBar value={item.quantite} max={stats.top_ventes[0]?.quantite || 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ====================== RESTAURANTS ======================

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

  const categories = ["Entrées", "Plats", "Desserts", "Boissons chaudes", "Boissons froides", "Alcools", "Apéritifs", "Menus"];

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
                    <td className="text-right font-mono">{fmt(prod.prix_vente, 2)} €</td>
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
            label="Prix de vente TTC (€) *"
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

const FichesModule = ({ restaurants, fiches, produits, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRestaurant, setFilterRestaurant] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    nom: "", restaurant_id: "", type_fiche: "standard", famille: "",
    nb_portions: "1", prix_vente: "", statut: "brouillon", ingredients: []
  });
  const [newIngredient, setNewIngredient] = useState({
    nom: "", quantite: "", unite: "g", prix_unitaire: ""
  });

  const unites = ["g", "kg", "L", "ml", "cl", "unité", "pièce"];
  const familles = ["Entrées", "Plats", "Desserts", "Boissons", "Préparations de base", "Sauces"];

  const filteredFiches = fiches.filter((f) => {
    if (search && !f.nom.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRestaurant && f.restaurant_id !== filterRestaurant) return false;
    if (filterStatut && f.statut !== filterStatut) return false;
    return true;
  });

  const resetForm = () => {
    setForm({
      nom: "", restaurant_id: "", type_fiche: "standard", famille: "",
      nb_portions: "1", prix_vente: "", statut: "brouillon", ingredients: []
    });
    setNewIngredient({ nom: "", quantite: "", unite: "g", prix_unitaire: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (fiche) => {
    setForm({
      nom: fiche.nom,
      restaurant_id: fiche.restaurant_id,
      type_fiche: fiche.type_fiche,
      famille: fiche.famille,
      nb_portions: fiche.nb_portions.toString(),
      prix_vente: fiche.prix_vente.toString(),
      statut: fiche.statut,
      ingredients: fiche.ingredients || []
    });
    setEditingId(fiche.id);
    setShowForm(true);
  };

  const addIngredient = () => {
    if (!newIngredient.nom || !newIngredient.quantite || !newIngredient.prix_unitaire) {
      toast.error("Veuillez remplir tous les champs de l'ingrédient");
      return;
    }
    const ing = {
      ...newIngredient,
      quantite: parseFloat(newIngredient.quantite),
      prix_unitaire: parseFloat(newIngredient.prix_unitaire),
      cout_ligne: parseFloat(newIngredient.quantite) * parseFloat(newIngredient.prix_unitaire)
    };
    setForm({ ...form, ingredients: [...form.ingredients, ing] });
    setNewIngredient({ nom: "", quantite: "", unite: "g", prix_unitaire: "" });
  };

  const removeIngredient = (idx) => {
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== idx) });
  };

  const calculateCosts = () => {
    const coutTotal = form.ingredients.reduce((sum, ing) => sum + (ing.cout_ligne || ing.quantite * ing.prix_unitaire), 0);
    const nbPortions = parseInt(form.nb_portions) || 1;
    const prixVente = parseFloat(form.prix_vente) || 0;
    const coutPortion = coutTotal / nbPortions;
    const foodCost = prixVente > 0 ? (coutPortion / prixVente) * 100 : 0;
    return { coutTotal, coutPortion, foodCost };
  };

  const handleSubmit = async () => {
    if (!form.nom || !form.restaurant_id) {
      toast.error("Nom et restaurant requis");
      return;
    }
    try {
      const data = {
        ...form,
        nb_portions: parseInt(form.nb_portions) || 1,
        prix_vente: parseFloat(form.prix_vente) || 0,
        ingredients: form.ingredients.map(ing => ({
          nom: ing.nom,
          quantite: parseFloat(ing.quantite),
          unite: ing.unite,
          prix_unitaire: parseFloat(ing.prix_unitaire)
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
                        <div className="font-mono">{fmt(fiche.prix_vente, 2)} €</div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Coût total</span>
                        <div className="font-mono">{fmt(fiche.cout_total, 2)} €</div>
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
                                <td className="text-right font-mono">{fmt(ing.prix_unitaire, 3)} €</td>
                                <td className="text-right font-mono">{fmt(ing.cout_ligne, 2)} €</td>
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
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom de la fiche *"
              value={form.nom}
              onChange={(v) => setForm({ ...form, nom: v })}
              placeholder="Ex: Burger Classic"
              className="col-span-2"
              data-testid="fiche-name-input"
            />
            <Select
              label="Restaurant *"
              value={form.restaurant_id}
              onChange={(v) => setForm({ ...form, restaurant_id: v })}
              options={restaurants.map(r => ({ value: r.id, label: r.nom }))}
              placeholder="Sélectionner"
            />
            <Select
              label="Famille"
              value={form.famille}
              onChange={(v) => setForm({ ...form, famille: v })}
              options={familles}
              placeholder="Sélectionner"
            />
            <Input
              label="Prix de vente (€)"
              type="number"
              value={form.prix_vente}
              onChange={(v) => setForm({ ...form, prix_vente: v })}
              placeholder="Ex: 12.50"
            />
            <Input
              label="Nb portions"
              type="number"
              value={form.nb_portions}
              onChange={(v) => setForm({ ...form, nb_portions: v })}
              placeholder="1"
            />
          </div>

          {/* Ingredients */}
          <div className="border border-border rounded-lg p-4">
            <h4 className="font-medium mb-3">Ingrédients</h4>
            
            {form.ingredients.length > 0 && (
              <div className="space-y-2 mb-4">
                {form.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-secondary/50 rounded p-2">
                    <span className="flex-1">{ing.nom}</span>
                    <span className="font-mono">{ing.quantite} {ing.unite}</span>
                    <span className="font-mono text-muted-foreground">{fmt(ing.cout_ligne, 2)} €</span>
                    <button onClick={() => removeIngredient(idx)} className="text-destructive hover:bg-destructive/20 p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                value={newIngredient.nom}
                onChange={(e) => setNewIngredient({ ...newIngredient, nom: e.target.value })}
                placeholder="Ingrédient"
                className="trinity-input col-span-4"
              />
              <input
                type="number"
                value={newIngredient.quantite}
                onChange={(e) => setNewIngredient({ ...newIngredient, quantite: e.target.value })}
                placeholder="Qté"
                className="trinity-input col-span-2"
              />
              <select
                value={newIngredient.unite}
                onChange={(e) => setNewIngredient({ ...newIngredient, unite: e.target.value })}
                className="trinity-input col-span-2"
              >
                {unites.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input
                type="number"
                value={newIngredient.prix_unitaire}
                onChange={(e) => setNewIngredient({ ...newIngredient, prix_unitaire: e.target.value })}
                placeholder="PU €"
                className="trinity-input col-span-2"
                step="0.001"
              />
              <Button variant="secondary" onClick={addIngredient} className="col-span-2">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Cost Preview */}
          {form.ingredients.length > 0 && (
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Coût Total</div>
                  <div className="font-mono text-lg">{fmt(costs.coutTotal, 2)} €</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Coût/Portion</div>
                  <div className="font-mono text-lg">{fmt(costs.coutPortion, 2)} €</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Food Cost</div>
                  <div className={`font-mono text-lg ${getFoodCostColor(costs.foodCost)}`}>
                    {fmtPct(costs.foodCost)}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Gauge value={costs.foodCost} label="" />
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

// ====================== IMPORT VENTES ======================

const ImportModule = ({ restaurants, onRefresh }) => {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [imports, setImports] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Charger l'historique des imports
  useEffect(() => {
    const loadImports = async () => {
      try {
        const res = await axios.get(`${API}/imports`);
        setImports(res.data);
      } catch (err) {
        console.error("Erreur chargement imports:", err);
      }
    };
    loadImports();
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer?.files || e.target.files || []);
    processFiles(droppedFiles);
  };

  const processFiles = (newFiles) => {
    const processed = newFiles.map((file) => {
      const name = file.name.toLowerCase();
      let detectedRestaurant = null;
      let detectedDate = null;

      // Détection du restaurant
      for (const resto of restaurants) {
        if (name.includes(resto.code.toLowerCase()) || name.includes(resto.nom.toLowerCase())) {
          detectedRestaurant = resto;
          break;
        }
      }

      // Détection de la date (YYYYMMDD)
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
        status: "pending",
        error: null,
        result: null
      };
    });

    setFiles([...files, ...processed]);
  };

  const updateFile = (idx, updates) => {
    setFiles(files.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const removeFile = (idx) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const uploadFiles = async () => {
    setImporting(true);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status !== "pending") continue;
      
      updateFile(i, { status: "processing" });
      
      if (!f.restaurant) {
        updateFile(i, { status: "error", error: "Sélectionnez un restaurant" });
        continue;
      }

      try {
        // Créer FormData pour l'upload
        const formData = new FormData();
        formData.append('file', f.file);
        formData.append('restaurant_id', f.restaurant.id);
        formData.append('date_vente', f.date);

        const response = await axios.post(`${API}/imports/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        updateFile(i, { 
          status: "success", 
          result: response.data 
        });
        
        toast.success(`${response.data.nb_lignes} ventes importées - CA: ${fmt(response.data.ca_total, 2)} €`);
        
      } catch (err) {
        const errorMsg = err.response?.data?.detail || err.message;
        updateFile(i, { status: "error", error: errorMsg });
        toast.error(`Erreur: ${errorMsg}`);
      }
    }

    setImporting(false);
    onRefresh();
    
    // Recharger l'historique
    try {
      const res = await axios.get(`${API}/imports`);
      setImports(res.data);
    } catch (err) {}
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

  const pendingCount = files.filter(f => f.status === "pending").length;
  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;

  const getRestaurantById = (id) => restaurants.find(r => r.id === id);

  return (
    <div className="space-y-6" data-testid="import-module">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Import des Ventes</h1>
          <p className="text-muted-foreground">Importez vos fichiers de ventes PSW (.xls, .xlsx)</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => setShowHistory(!showHistory)}
          data-testid="toggle-history-btn"
        >
          {showHistory ? "Nouvel import" : `Historique (${imports.length})`}
        </Button>
      </div>

      {showHistory ? (
        /* Historique des imports */
        <div className="space-y-4">
          {imports.length > 0 ? (
            imports.map((imp) => {
              const resto = getRestaurantById(imp.restaurant_id);
              return (
                <div key={imp.id} className="trinity-card flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-1 h-12 rounded-full" 
                      style={{ backgroundColor: resto?.couleur || '#666' }}
                    />
                    <div>
                      <div className="font-medium">{imp.nom_fichier}</div>
                      <div className="text-sm text-muted-foreground">
                        {resto?.nom} • {new Date(imp.date_import).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono text-lg">{imp.nb_lignes}</div>
                      <div className="text-xs text-muted-foreground">lignes</div>
                    </div>
                    <Pill type={imp.statut === "importé" ? "success" : "warning"}>
                      {imp.statut}
                    </Pill>
                    <button 
                      onClick={() => deleteImport(imp.id)}
                      className="p-2 hover:bg-destructive/20 rounded text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={FileSpreadsheet}
              title="Aucun import"
              description="Vos imports apparaîtront ici"
            />
          )}
        </div>
      ) : (
        /* Zone d'import */
        <>
          <div
            className={`drop-zone ${dragOver ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
            data-testid="drop-zone"
          >
            <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Glissez vos fichiers ici</p>
            <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
            <p className="text-xs text-muted-foreground mt-2">Format: .xls ou .xlsx (export PSW)</p>
            <input
              id="file-input"
              type="file"
              accept=".xls,.xlsx"
              multiple
              onChange={handleDrop}
              className="hidden"
            />
          </div>

          {/* Liste des fichiers */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm">
                  <span>{pendingCount} en attente</span>
                  {successCount > 0 && <span className="text-emerald-400">{successCount} importés</span>}
                  {errorCount > 0 && <span className="text-red-400">{errorCount} erreurs</span>}
                </div>
                {pendingCount > 0 && (
                  <Button onClick={uploadFiles} disabled={importing} data-testid="import-btn">
                    {importing ? "Import en cours..." : `Importer ${pendingCount} fichier${pendingCount > 1 ? 's' : ''}`}
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {files.map((f, idx) => (
                  <div 
                    key={idx} 
                    className={`trinity-card flex items-center gap-4 ${f.status === 'error' ? 'border-red-500/50' : f.status === 'success' ? 'border-emerald-500/50' : ''}`}
                  >
                    <FileSpreadsheet className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{f.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(f.size / 1024).toFixed(1)} KB
                        {f.result && (
                          <span className="ml-2 text-emerald-400">
                            • {f.result.nb_lignes} ventes • {fmt(f.result.ca_total, 2)} €
                          </span>
                        )}
                      </div>
                    </div>

                    <Select
                      value={f.restaurant?.id || ""}
                      onChange={(v) => updateFile(idx, { restaurant: restaurants.find(r => r.id === v) })}
                      options={restaurants.map(r => ({ value: r.id, label: r.nom }))}
                      placeholder="Restaurant *"
                      className="w-44"
                    />

                    <Input
                      type="date"
                      value={f.date || ""}
                      onChange={(v) => updateFile(idx, { date: v })}
                      className="w-40"
                    />

                    <div className="flex items-center gap-2 min-w-[100px]">
                      {f.status === "pending" && (
                        <span className="text-xs text-muted-foreground">En attente</span>
                      )}
                      {f.status === "processing" && (
                        <span className="text-xs text-amber-400 animate-pulse">Import...</span>
                      )}
                      {f.status === "success" && (
                        <Check className="w-5 h-5 text-emerald-400" />
                      )}
                      {f.status === "error" && (
                        <div className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-xs truncate max-w-[80px]" title={f.error}>{f.error}</span>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => removeFile(idx)}
                      className="p-1 hover:bg-destructive/20 rounded text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {files.length > 0 && (
                <Button 
                  variant="ghost" 
                  onClick={() => setFiles([])}
                  className="text-muted-foreground"
                >
                  Effacer tout
                </Button>
              )}
            </div>
          )}

          {/* Aide format fichier */}
          <div className="trinity-card bg-secondary/30">
            <h4 className="font-medium mb-2">Format de fichier attendu</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Exportez vos ventes depuis PSW au format .xls ou .xlsx. Le système détecte automatiquement les colonnes :
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>Colonnes reconnues :</strong> Désignation, Quantité, PU TTC, CA TTC, Remise, Famille</p>
              <p>• <strong>Nommage recommandé :</strong> <code className="bg-background px-1 rounded">NOM_RESTAURANT_ventes_du_YYYYMMDD.xls</code></p>
              <p>• <strong>Remises négatives :</strong> Automatiquement exclues (bug PSW connu)</p>
            </div>
          </div>
        </>
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [restosRes, produitsRes, fichesRes, statsRes, restoStatsRes] = await Promise.all([
        axios.get(`${API}/restaurants`),
        axios.get(`${API}/produits`),
        axios.get(`${API}/fiches`),
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/dashboard/restaurants-stats`)
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <Dashboard stats={stats} restaurantStats={restaurantStats} loading={loading} />;
      case "restaurants":
        return <RestaurantsModule restaurants={restaurants} onRefresh={fetchData} />;
      case "carte":
        return <CarteModule restaurants={restaurants} produits={produits} onRefresh={fetchData} />;
      case "fiches":
        return <FichesModule restaurants={restaurants} fiches={fiches} produits={produits} onRefresh={fetchData} />;
      case "import":
        return <ImportModule restaurants={restaurants} onRefresh={fetchData} />;
      default:
        return <Dashboard stats={stats} restaurantStats={restaurantStats} loading={loading} />;
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

export default App;
