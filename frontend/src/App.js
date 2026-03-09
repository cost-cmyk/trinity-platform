import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import "@/App.css";
import axios from "axios";
import { 
  LayoutDashboard, Store, UtensilsCrossed, UploadCloud, 
  ChevronLeft, ChevronRight, Plus, Search, Filter, X, 
  Trash2, Edit, FileSpreadsheet, ChevronDown, ChevronUp,
  Building2, Package, FileText, TrendingUp, AlertCircle, Check, Info
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
  // Afficher tous les chiffres sans abréviation
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(Math.round(n));
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

// Composant Coût Théorique
const CoutTheoriqueSection = ({ restaurantId, date, caFood, caDrink }) => {
  const [coutData, setCoutData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCoutTheorique = async () => {
      setLoading(true);
      try {
        const url = date 
          ? `${API}/dashboard/restaurant/${restaurantId}/cout-theorique?date=${date}`
          : `${API}/dashboard/restaurant/${restaurantId}/cout-theorique`;
        
        const response = await axios.get(url);
        setCoutData(response.data);
      } catch (err) {
        console.error('Erreur chargement coût théorique:', err);
      } finally {
        setLoading(false);
      }
    };

    if (restaurantId) {
      loadCoutTheorique();
    }
  }, [restaurantId, date]);

  if (loading) {
    return (
      <div className="trinity-card">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Coût Théorique - Fiche Technique
        </div>
        <div className="text-center py-4 text-sm text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!coutData || coutData.ca_total === 0) {
    return (
      <div className="trinity-card">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Coût Théorique - Fiche Technique
        </div>
        <div className="text-center py-4 text-sm text-muted-foreground">
          Aucune donnée disponible. Créez des fiches techniques pour vos produits.
        </div>
      </div>
    );
  }

  return (
    <div className="trinity-card">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
        Coût Théorique - Fiche Technique
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Food Cost Nourriture */}
        <div className="trinity-card bg-secondary/30" style={{ borderLeft: '3px solid #34d399' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#34d399]">● FOOD COST NOURRITURE</span>
          </div>
          <div className="text-3xl font-bold mb-1" style={{ fontFamily: "'DM Mono', monospace", color: '#34d399' }}>
            {coutData.food_cost_pct.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
            <div>CA: {fmtPrice(coutData.ca_food)} F</div>
            <div>Coût: {fmtPrice(coutData.cout_food)} F</div>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div className="h-full bg-[#34d399]" style={{ width: `${Math.min(coutData.food_cost_pct, 100)}%` }} />
          </div>
        </div>

        {/* Beverage Cost Boisson */}
        <div className="trinity-card bg-secondary/30" style={{ borderLeft: '3px solid #2dd4bf' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#2dd4bf]">● BEVERAGE COST BOISSON</span>
          </div>
          <div className="text-3xl font-bold mb-1" style={{ fontFamily: "'DM Mono', monospace", color: '#2dd4bf' }}>
            {coutData.beverage_cost_pct.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
            <div>CA: {fmtPrice(coutData.ca_drink)} F</div>
            <div>Coût: {fmtPrice(coutData.cout_drink)} F</div>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div className="h-full bg-[#2dd4bf]" style={{ width: `${Math.min(coutData.beverage_cost_pct, 100)}%` }} />
          </div>
        </div>

        {/* Coût Global Matière */}
        <div className="trinity-card bg-secondary/30" style={{ borderLeft: '3px solid #34d399' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#34d399]">● COÛT GLOBAL MATIÈRE</span>
          </div>
          <div className="text-3xl font-bold mb-1" style={{ fontFamily: "'DM Mono', monospace", color: '#34d399' }}>
            {coutData.cout_global_pct.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
            <div>CA: {fmtPrice(coutData.ca_total)} F</div>
            <div>Coût: {fmtPrice(coutData.cout_total)} F</div>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div className="h-full bg-[#34d399]" style={{ width: `${Math.min(coutData.cout_global_pct, 100)}%` }} />
          </div>
        </div>
      </div>
      
      {coutData.couverture_pct < 100 && (
        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-200">
          💡 Couverture: {coutData.couverture_pct.toFixed(0)}% des ventes ont une fiche technique. 
          Créez plus de fiches pour un calcul précis.
        </div>
      )}
    </div>
  );
};


const Select = ({ label, value, onChange, options, placeholder = "Sélectionner...", className = "", disabled = false }) => {
  const handleChange = (e) => {
    const newValue = e.target.value;
    console.log("🔄 Select handleChange déclenché, valeur:", newValue);
    console.log("🔍 onChange exists?", !!onChange);
    console.log("🔍 onChange type:", typeof onChange);
    if (onChange) {
      console.log("🚀 About to call onChange with:", newValue);
      onChange(newValue);
      console.log("✅ onChange called successfully");
    } else {
      console.log("❌ onChange is falsy!");
    }
  };
  
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="text-sm text-muted-foreground">{label}</label>}
      <select
        value={value}
        onChange={handleChange}
        className="trinity-input"
        disabled={disabled}
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
};

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
    { id: "achats", label: "Produits achats", icon: Package, pole: "ACHATS" },
    { id: "budget-vs-reel", label: "Budget vs Réel", icon: TrendingUp, pole: "GROUPE" },
    { id: "import", label: "Import Données", icon: UploadCloud, pole: "OUTILS" },
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

const Dashboard = ({ stats, restaurantStats, loading, restaurants, onRefreshWithMonth }) => {
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restoDashboard, setRestoDashboard] = useState(null);
  const [restoLoading, setRestoLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null); // Filtre de mois pour vue groupe

  // Charger le dashboard d'un restaurant sélectionné
  const loadRestaurantDashboard = useCallback(async (restoId, date = null) => {
    if (!restoId) {
      setRestoDashboard(null);
      return;
    }
    
    setRestoLoading(true);
    try {
      const url = date 
        ? `${API}/dashboard/restaurant/${restoId}?date=${date}`
        : `${API}/dashboard/restaurant/${restoId}`;
      const res = await axios.get(url);
      setRestoDashboard(res.data);
      if (!date && res.data.dates_disponibles?.length > 0) {
        setSelectedDate(res.data.dates_disponibles[0]);
      }
    } catch (err) {
      toast.error("Erreur chargement données restaurant");
      setRestoDashboard(null);
    } finally {
      setRestoLoading(false);
    }
  }, []);

  const handleSelectRestaurant = (resto) => {
    setSelectedRestaurant(resto);
    setSelectedDate(null);
    loadRestaurantDashboard(resto?.id);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    if (selectedRestaurant) {
      loadRestaurantDashboard(selectedRestaurant.id, date);
    }
  };

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

  // Vue Dashboard Restaurant Sélectionné
  if (selectedRestaurant && restoDashboard) {
    const kpis = restoDashboard.kpis;
    const pctFood = kpis.ca_total > 0 ? (kpis.ca_food / kpis.ca_total * 100) : 0;
    const pctDrink = kpis.ca_total > 0 ? (kpis.ca_drink / kpis.ca_total * 100) : 0;
    
    return (
      <div className="space-y-4" data-testid="restaurant-dashboard">
        {/* Header avec retour */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleSelectRestaurant(null)}
              className="p-2 hover:bg-accent rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedRestaurant.type === 'PRODUCTION' ? '🏭' : '🍽️'}</span>
              <h1 className="text-2xl font-bold" style={{ color: selectedRestaurant.couleur }}>
                {selectedRestaurant.nom}
              </h1>
            </div>
          </div>
          
          {/* Sélecteur de date */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Date :</span>
            <select
              value={selectedDate || ""}
              onChange={(e) => handleDateChange(e.target.value || null)}
              className="trinity-input w-auto"
            >
              <option value="">Toutes les dates</option>
              {restoDashboard.dates_disponibles?.map(d => (
                <option key={d} value={d}>{new Date(d).toLocaleDateString('fr-FR')}</option>
              ))}
            </select>
          </div>
        </div>

        {restoLoading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : (
          <>
            {/* === 1. KPIs EN HAUT === */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="trinity-card" style={{ borderLeft: `3px solid ${selectedRestaurant.couleur}` }}>
                <div className="text-xs text-muted-foreground uppercase mb-1">CA Total</div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: selectedRestaurant.couleur }}>
                  {fmtK(kpis.ca_total)} F
                </div>
                <div className="text-xs text-muted-foreground mt-1">{kpis.total_quantite} articles</div>
              </div>
              
              <div className="trinity-card" style={{ borderLeft: '3px solid #34d399' }}>
                <div className="text-xs text-muted-foreground uppercase mb-1">Nourriture</div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: '#34d399' }}>
                  {fmtK(kpis.ca_food)} F
                </div>
                <div className="text-xs text-muted-foreground mt-1">{kpis.ca_total > 0 ? Math.round(pctFood) : 0}%</div>
              </div>
              
              <div className="trinity-card" style={{ borderLeft: '3px solid #fbbf24' }}>
                <div className="text-xs text-muted-foreground uppercase mb-1">Boisson</div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: '#fbbf24' }}>
                  {fmtK(kpis.ca_drink)} F
                </div>
                <div className="text-xs text-muted-foreground mt-1">{kpis.ca_total > 0 ? Math.round(pctDrink) : 0}%</div>
              </div>
              
              <div className="trinity-card" style={{ borderLeft: '3px solid #f472b6' }}>
                <div className="text-xs text-muted-foreground uppercase mb-1">Remises</div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: '#f472b6' }}>
                  {fmtK(kpis.total_remise)} F
                </div>
                <div className="text-xs text-muted-foreground mt-1">{kpis.nb_lignes} lignes</div>
              </div>
            </div>

            {/* === 2. BARRE DE SYNTHÈSE === */}
            <div className="trinity-card" style={{ borderLeft: `3px solid ${selectedRestaurant.couleur}` }}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{selectedRestaurant.type === 'PRODUCTION' ? '🏭' : '🍽️'}</span>
                  <span className="font-bold text-sm" style={{ color: selectedRestaurant.couleur }}>
                    {selectedRestaurant.nom}
                  </span>
                </div>
                <span className="text-xl font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {fmtK(kpis.ca_total)} F
                </span>
              </div>
              
              {kpis.ca_total > 0 && (
                <>
                  <div className="h-2.5 bg-background rounded-full overflow-hidden flex mb-2">
                    <div className="bg-[#34d399]" style={{ width: `${pctFood}%` }} />
                    <div className="bg-[#fbbf24]" style={{ width: `${pctDrink}%` }} />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="text-[#34d399]">● Nourriture {fmtK(kpis.ca_food)} F</span>
                    <span className="text-[#fbbf24]">● Boisson {fmtK(kpis.ca_drink)} F</span>
                  </div>
                </>
              )}
            </div>

            {/* === 3. PAR FAMILLE === */}
            {restoDashboard.by_category?.length > 0 && (
              <div className="trinity-card">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                  Par Famille
                </div>
                <div className="space-y-3">
                  {restoDashboard.by_category.slice(0, 8).map((cat, idx) => {
                    const colors = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#8b5cf6', '#2dd4bf', '#f97316', '#f472b6'];
                    const color = colors[idx % colors.length];
                    const pctCat = kpis.ca_total > 0 ? (cat.ca / kpis.ca_total * 100) : 0;
                    
                    return (
                      <div key={idx}>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <span style={{ color }}>{cat.categorie || 'Sans catégorie'}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary">
                              {cat.is_food ? 'N' : 'B'}
                            </span>
                          </div>
                          <span className="font-mono text-muted-foreground">
                            {fmtPrice(cat.ca)} · {pctCat.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-background rounded-full overflow-hidden">
                          <div className="h-full transition-all" style={{ width: `${pctCat}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === 4. MENU ENGINEERING (Titre séparateur) === */}
            <div className="flex items-center gap-2 my-4">
              <div className="h-0.5 w-8 rounded" style={{ backgroundColor: selectedRestaurant.couleur }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: selectedRestaurant.couleur }}>
                Menu Engineering
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* === 5. COÛT THÉORIQUE - FICHE TECHNIQUE === */}
            <CoutTheoriqueSection 
              restaurantId={selectedRestaurant.id} 
              date={selectedDate}
              caFood={kpis.ca_food}
              caDrink={kpis.ca_drink}
            />

            {/* === 6. TOP 10 === */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                Top 10 du Jour
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({selectedDate ? new Date(selectedDate).toLocaleDateString('fr-FR') : 'Toutes dates'})
                </span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top 10 Global */}
                <div className="trinity-card">
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">
                    📊 Top 10 du Jour - Global
                  </div>
                  {restoDashboard.top_jour?.food?.length > 0 || restoDashboard.top_jour?.drink?.length > 0 ? (
                    <div className="space-y-2">
                      {[...(restoDashboard.top_jour.food || []), ...(restoDashboard.top_jour.drink || [])]
                        .sort((a, b) => b.ca - a.ca)
                        .slice(0, 10)
                        .map((item, idx) => {
                          const maxCa = Math.max(...[...(restoDashboard.top_jour.food || []), ...(restoDashboard.top_jour.drink || [])].map(i => i.ca));
                          const pct = (item.ca / maxCa * 100);
                          
                          return (
                            <div key={idx}>
                              <div className="flex justify-between items-center text-xs mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-muted-foreground font-mono">{idx + 1}</span>
                                  <span className="truncate">{item.nom}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">{item.quantite}</span>
                                  <span className="font-mono font-bold text-blue-400">{fmtPrice(item.ca)}</span>
                                </div>
                              </div>
                              <div className="h-1 bg-background rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune vente</p>
                  )}
                </div>

                {/* Top 10 Nourriture */}
                <div className="trinity-card">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#34d399] mb-3">
                    🍽️ Top 10 du Jour - Nourritures
                  </div>
                  {restoDashboard.top_jour?.food?.length > 0 ? (
                    <div className="space-y-2">
                      {restoDashboard.top_jour.food.slice(0, 10).map((item, idx) => {
                        const maxCa = Math.max(...restoDashboard.top_jour.food.map(i => i.ca));
                        const pct = (item.ca / maxCa * 100);
                        
                        return (
                          <div key={idx}>
                            <div className="flex justify-between items-center text-xs mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-5 text-muted-foreground font-mono">{idx + 1}</span>
                                <span className="truncate">{item.nom}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{item.quantite}</span>
                                <span className="font-mono font-bold text-[#34d399]">{fmtPrice(item.ca)}</span>
                              </div>
                            </div>
                            <div className="h-1 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-[#34d399]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune vente</p>
                  )}
                </div>

                {/* Top 10 Boissons */}
                <div className="trinity-card">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#06b6d4] mb-3">
                    🍷 Top 10 du Jour - Boissons
                  </div>
                  {restoDashboard.top_jour?.drink?.length > 0 ? (
                    <div className="space-y-2">
                      {restoDashboard.top_jour.drink.slice(0, 10).map((item, idx) => {
                        const maxCa = Math.max(...restoDashboard.top_jour.drink.map(i => i.ca));
                        const pct = (item.ca / maxCa * 100);
                        
                        return (
                          <div key={idx}>
                            <div className="flex justify-between items-center text-xs mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-5 text-muted-foreground font-mono">{idx + 1}</span>
                                <span className="truncate">{item.nom}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{item.quantite}</span>
                                <span className="font-mono font-bold text-[#06b6d4]">{fmtPrice(item.ca)}</span>
                              </div>
                            </div>
                            <div className="h-1 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-[#06b6d4]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune vente de boissons</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top 10 du Mois */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                Top 10 Cumul du Mois
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({restoDashboard.mois_courant ? restoDashboard.mois_courant : 'Tout'})
                </span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top 10 Global Mois */}
                <div className="trinity-card">
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3">
                    📊 Top 10 du Mois - Global
                  </div>
                  {restoDashboard.top_mois?.food?.length > 0 || restoDashboard.top_mois?.drink?.length > 0 ? (
                    <div className="space-y-2">
                      {[...(restoDashboard.top_mois.food || []), ...(restoDashboard.top_mois.drink || [])]
                        .sort((a, b) => b.ca - a.ca)
                        .slice(0, 10)
                        .map((item, idx) => {
                          const maxCa = Math.max(...[...(restoDashboard.top_mois.food || []), ...(restoDashboard.top_mois.drink || [])].map(i => i.ca));
                          const pct = (item.ca / maxCa * 100);
                          
                          return (
                            <div key={idx}>
                              <div className="flex justify-between items-center text-xs mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-muted-foreground font-mono">{idx + 1}</span>
                                  <span className="truncate">{item.nom}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">{item.quantite}</span>
                                  <span className="font-mono font-bold text-purple-400">{fmtPrice(item.ca)}</span>
                                </div>
                              </div>
                              <div className="h-1 bg-background rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune vente</p>
                  )}
                </div>

                {/* Top 10 Nourriture Mois */}
                <div className="trinity-card">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#34d399] mb-3">
                    🍽️ Top 10 du Mois - Nourritures
                  </div>
                  {restoDashboard.top_mois?.food?.length > 0 ? (
                    <div className="space-y-2">
                      {restoDashboard.top_mois.food.slice(0, 10).map((item, idx) => {
                        const maxCa = Math.max(...restoDashboard.top_mois.food.map(i => i.ca));
                        const pct = (item.ca / maxCa * 100);
                        
                        return (
                          <div key={idx}>
                            <div className="flex justify-between items-center text-xs mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-5 text-muted-foreground font-mono">{idx + 1}</span>
                                <span className="truncate">{item.nom}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{item.quantite}</span>
                                <span className="font-mono font-bold text-[#34d399]">{fmtPrice(item.ca)}</span>
                              </div>
                            </div>
                            <div className="h-1 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-[#34d399]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune vente</p>
                  )}
                </div>

                {/* Top 10 Boissons Mois */}
                <div className="trinity-card">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#06b6d4] mb-3">
                    🍷 Top 10 du Mois - Boissons
                  </div>
                  {restoDashboard.top_mois?.drink?.length > 0 ? (
                    <div className="space-y-2">
                      {restoDashboard.top_mois.drink.slice(0, 10).map((item, idx) => {
                        const maxCa = Math.max(...restoDashboard.top_mois.drink.map(i => i.ca));
                        const pct = (item.ca / maxCa * 100);
                        
                        return (
                          <div key={idx}>
                            <div className="flex justify-between items-center text-xs mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-5 text-muted-foreground font-mono">{idx + 1}</span>
                                <span className="truncate">{item.nom}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{item.quantite}</span>
                                <span className="font-mono font-bold text-[#06b6d4]">{fmtPrice(item.ca)}</span>
                              </div>
                            </div>
                            <div className="h-1 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-[#06b6d4]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune vente de boissons</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Calculer le mois actuel basé sur les données
  const getCurrentMonth = () => {
    if (restaurantStats.length > 0 && restaurantStats[0].derniere_date) {
      return restaurantStats[0].derniere_date.substring(0, 7); // Format: YYYY-MM
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatMonthYear = (monthStr) => {
    // monthStr format: "2026-03" -> "Mars 2026"
    if (!monthStr) return "...";
    const [year, month] = monthStr.split('-');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const currentMonth = getCurrentMonth();

  // Vue Dashboard Groupe (par défaut)
  return (
    <div className="space-y-4" data-testid="dashboard">
      {/* Header avec sélecteur de mois */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Vue Consolidée</h1>
          <p className="text-xs text-muted-foreground">
            Structure & flux d'activités - {selectedMonth ? formatMonthYear(selectedMonth) : formatMonthYear(currentMonth)}
          </p>
        </div>
        
        {/* Sélecteur de mois */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Filtrer par mois :</label>
          <Input
            type="month"
            value={selectedMonth || currentMonth}
            onChange={(v) => {
              setSelectedMonth(v);
              // Recharger les données avec le nouveau mois
              if (onRefreshWithMonth) {
                onRefreshWithMonth(v);
              }
            }}
            className="w-44"
          />
          {selectedMonth && (
            <button
              onClick={() => {
                setSelectedMonth(null);
                if (onRefreshWithMonth) {
                  onRefreshWithMonth(null);
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
              title="Réinitialiser le filtre"
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* === 1. KPIs GROUPE EN HAUT === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="trinity-card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            CA Groupe (Jour)
          </div>
          <div className="text-3xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: '#3b82f6' }}>
            {fmtK(stats.ca_total)} F
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {selectedMonth ? formatMonthYear(selectedMonth) : (restaurantStats[0]?.derniere_date || new Date().toLocaleDateString('fr-FR'))}
          </div>
        </div>

        <div className="trinity-card" style={{ borderLeft: '3px solid #f97316' }}>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Coût Production Total
          </div>
          <div className="text-3xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: '#f97316' }}>
            {fmtK(stats.cout_production_total || 0)} F
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Basé sur fiches techniques
          </div>
        </div>

        <div className="trinity-card" style={{ borderLeft: '3px solid #f472b6' }}>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Masse Salariale
          </div>
          <div className="text-3xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: '#f472b6' }}>
            {fmtK(stats.masse_salariale || 0)} F
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.nombre_employes || 0} employés | {selectedMonth ? formatMonthYear(selectedMonth) : formatMonthYear(currentMonth)}
          </div>
        </div>
      </div>

      {/* === 2. POINTS CLÉS - GROUPE TRINITY === */}
      <div className="trinity-card" style={{ borderLeft: '3px solid #3b82f6' }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#3b82f6]">
            📊 Points Clés – Groupe Trinity
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Coût Nourriture */}
          <div className="trinity-card bg-secondary/30" style={{ borderLeft: '2px solid #34d399' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#34d399]">$ COÛT NOURRITURE</span>
            </div>
            <div className="text-3xl font-bold mb-2" style={{ fontFamily: "'DM Mono', monospace", color: '#34d399' }}>
              {fmtK(stats.cout_food_total || 0)} F
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-[#34d399]" style={{ width: `${stats.avg_food_cost || 0}%` }} />
            </div>
          </div>

          {/* Coût Boisson */}
          <div className="trinity-card bg-secondary/30" style={{ borderLeft: '2px solid #2dd4bf' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#2dd4bf]">$ COÛT BOISSON</span>
            </div>
            <div className="text-3xl font-bold mb-2" style={{ fontFamily: "'DM Mono', monospace", color: '#2dd4bf' }}>
              {fmtK(stats.cout_bev_total || 0)} F
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-[#2dd4bf]" style={{ width: `${stats.avg_bev_cost || 0}%` }} />
            </div>
          </div>

          {/* Coût Matière Global */}
          <div className="trinity-card bg-secondary/30" style={{ borderLeft: '2px solid #fbbf24' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#fbbf24]">€ COÛT MATIÈRE GLOBAL</span>
            </div>
            <div className="text-3xl font-bold mb-2" style={{ fontFamily: "'DM Mono', monospace", color: '#fbbf24' }}>
              0.0%
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-[#fbbf24]" style={{ width: '0%' }} />
            </div>
          </div>

          {/* Masse Salariale / CA */}
          <div className="trinity-card bg-secondary/30" style={{ borderLeft: '2px solid #f87171' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#f87171]">🔥 MASSE SALARIALE / CA</span>
            </div>
            <div className="text-3xl font-bold mb-2" style={{ fontFamily: "'DM Mono', monospace", color: '#f87171' }}>
              0.0%
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-[#f87171]" style={{ width: '0%' }} />
            </div>
          </div>
        </div>

        {/* === 3. DÉCOMPOSITION DU CA MENSUEL === */}
        <div className="mt-6">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Décomposition du CA mensuel estimé — {fmtK(stats.ca_total)} F
          </div>
          <div className="h-8 rounded-full overflow-hidden flex">
            <div className="flex items-center justify-center" style={{ width: '0%', backgroundColor: '#f97316' }}>
              <span className="text-[10px] font-bold">Matière 0%</span>
            </div>
            <div className="flex items-center justify-center" style={{ width: '0%', backgroundColor: '#f472b6' }}>
              <span className="text-[10px] font-bold">MS 0%</span>
            </div>
            <div className="flex items-center justify-center flex-1" style={{ backgroundColor: '#34d399' }}>
              <span className="text-[10px] font-bold">Marge 100%</span>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <span className="text-[#f97316]">● Matière 0 F</span>
            <span className="text-[#f472b6]">● MS 0 F</span>
            <span className="text-[#34d399]">● Marge 0 F</span>
          </div>
        </div>
      </div>

      {/* === 4. DÉTAIL PAR RESTAURANT === */}
      {restaurantStats.length > 0 ? (
        <div className="trinity-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3b82f6]">
              📋 Détail par Restaurant
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Restaurant
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    CA Jour
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    % Food Cost
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    % Bev. Cost
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    % Matière
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Masse Sal.
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    % MS/CA
                  </th>
                </tr>
              </thead>
              <tbody>
                {restaurantStats.map((r, idx) => {
                  // Utiliser les vraies données du backend au lieu de valeurs simulées
                  const foodCost = r.food_cost_pct || 0;
                  const bevCost = r.bev_cost_pct || 0;
                  const matiere = r.matiere_cost_pct || 0;
                  const masseSal = r.masse_salariale || 0;
                  const msCa = r.ca_total > 0 ? (masseSal / r.ca_total * 100) : 0;
                  const nombreSalaries = r.nombre_salaries || 0;
                  
                  return (
                    <tr 
                      key={r.id}
                      className="border-b border-border/50 hover:bg-accent/30 cursor-pointer transition"
                      onClick={() => handleSelectRestaurant(restaurants.find(resto => resto.id === r.id))}
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: r.couleur }}
                          />
                          <span className="text-sm font-medium">{r.nom}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{r.type}</div>
                      </td>
                      
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm font-mono font-bold">{fmtPrice(r.ca_total)} F</span>
                      </td>
                      
                      <td className="py-3 px-2">
                        {r.ca_total > 0 && foodCost > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-mono font-bold text-[#34d399]">
                              {foodCost.toFixed(1)}%
                            </span>
                            <div className="w-20 h-1 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-[#34d399]" style={{ width: `${Math.min(foodCost, 100)}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">0.0%</span>
                        )}
                      </td>
                      
                      <td className="py-3 px-2">
                        {r.ca_total > 0 && bevCost > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-mono font-bold text-[#2dd4bf]">
                              {bevCost.toFixed(1)}%
                            </span>
                            <div className="w-20 h-1 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-[#2dd4bf]" style={{ width: `${Math.min(bevCost, 100)}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">0.0%</span>
                        )}
                      </td>
                      
                      <td className="py-3 px-2">
                        {r.ca_total > 0 && matiere > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-mono font-bold text-[#fbbf24]">
                              {matiere.toFixed(1)}%
                            </span>
                            <div className="w-20 h-1 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-[#fbbf24]" style={{ width: `${Math.min(matiere, 100)}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">0.0%</span>
                        )}
                      </td>
                      
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm font-mono font-bold text-[#f472b6]">
                          {masseSal > 0 ? fmtK(masseSal) : '0'} F
                        </span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {nombreSalaries > 0 ? `${nombreSalaries} sal.` : '0 sal.'}
                        </div>
                      </td>
                      
                      <td className="py-3 px-2">
                        {r.ca_total > 0 && msCa > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <span 
                              className="text-sm font-mono font-bold"
                              style={{ color: msCa > 50 ? '#f87171' : msCa > 35 ? '#fbbf24' : '#34d399' }}
                            >
                              {msCa.toFixed(1)}%
                            </span>
                            <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden">
                              <div 
                                className="h-full" 
                                style={{ 
                                  width: `${Math.min(msCa, 100)}%`, 
                                  backgroundColor: msCa > 50 ? '#f87171' : msCa > 35 ? '#fbbf24' : '#34d399'
                                }} 
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">NaN%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      {/* Top Ventes - SUPPRIMÉ - Remplacé par graphique restaurants */}
      
      {/* === 6. GRAPHIQUE PERFORMANCE RESTAURANTS === */}
      {restaurantStats.length > 0 && (
        <div className="trinity-card">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            📈 Performance Restaurants - CA du Jour
          </div>
          
          <div className="space-y-3">
            {restaurantStats
              .sort((a, b) => b.ca_total - a.ca_total)
              .slice(0, 8)
              .map((r, idx) => {
                const maxCa = restaurantStats[0]?.ca_total || 1;
                const pct = (r.ca_total / maxCa * 100);
                
                return (
                  <div 
                    key={r.id}
                    className="cursor-pointer hover:bg-accent/30 p-2 rounded transition"
                    onClick={() => handleSelectRestaurant(restaurants.find(resto => resto.id === r.id))}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-xs font-mono text-muted-foreground">{idx + 1}</span>
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: r.couleur }}
                        />
                        <span className="text-sm font-medium">{r.nom}</span>
                        <span className="text-xs text-muted-foreground">({r.type})</span>
                      </div>
                      <span className="text-sm font-mono font-bold" style={{ color: r.couleur }}>
                        {fmtPrice(r.ca_total)} F
                      </span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all" 
                        style={{ width: `${pct}%`, backgroundColor: r.couleur }} 
                      />
                    </div>
                  </div>
                );
              })}
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

  const [touchesPswSuggestionsCarteModule, setTouchesPswSuggestionsCarteModule] = useState([]);

  const filteredProduits = produits.filter((p) => {
    if (search && !p.nom.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRestaurant && p.restaurant_id !== filterRestaurant) return false;
    if (filterCategorie && p.categorie !== filterCategorie) return false;
    return true;
  });

  const resetForm = () => {
    setForm({ nom: "", restaurant_id: "", categorie: "", prix_vente: "", is_food: true, description: "", touches_psw: [] });
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
      touches_psw: Array.isArray(prod.touches_psw) ? prod.touches_psw : (prod.touches_psw ? prod.touches_psw.split(',').map(t => t.trim()) : [])
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


  // Charger les données de contrôle
  const [controleData, setControleData] = React.useState({stats: {}, produits: []});
  React.useEffect(() => {
    fetch(`${API}/carte-controle${filterRestaurant ? `?restaurant_id=${filterRestaurant}` : ''}`)
      .then(r => r.json())
      .then(data => setControleData(data))
      .catch(err => console.error('Erreur chargement contrôle:', err));
  }, [filterRestaurant, produits]);

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

      {/* KPIs Contrôle Fiches Techniques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="trinity-card" style={{borderLeft: '3px solid #f97316'}}>
          <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">
            PRODUITS CARTE
          </div>
          <div className="text-4xl font-bold text-orange-500 mb-2">
            {controleData.stats?.total_produits || 0}
          </div>
          <div className="text-xs text-muted-foreground">
            {filterRestaurant ? 'Restaurant sélectionné' : 'Tous restaurants'}
          </div>
        </div>

        <div className="trinity-card" style={{borderLeft: '3px solid #10b981'}}>
          <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">
            AVEC FICHE TECHNIQUE
          </div>
          <div className="text-4xl font-bold text-green-500 mb-2">
            {controleData.stats?.avec_ft || 0}
          </div>
          <div className="text-xs text-muted-foreground">
            {controleData.stats?.pourcentage_couvert?.toFixed(1) || '0.0'}% couvert
          </div>
        </div>

        <div className="trinity-card" style={{borderLeft: '3px solid #ef4444'}}>
          <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">
            SANS FICHE TECHNIQUE
          </div>
          <div className="text-4xl font-bold text-red-500 mb-2">
            {controleData.stats?.sans_ft || 0}
          </div>
          <div className="text-xs text-muted-foreground">
            À rattacher
          </div>
        </div>
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
                <th>Fiche Technique</th>
                <th>Touches PSW</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProduits.map((prod) => {
                const resto = getRestaurantById(prod.restaurant_id);
                const produitDetail = controleData.produits?.find(p => p.id === prod.id);
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
                      {produitDetail?.has_fiche ? (
                        <div className="flex items-center gap-1 text-green-500">
                          <Check className="w-4 h-4" />
                          <span className="text-sm">Rattachée</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-500">
                          <X className="w-4 h-4" />
                          <span className="text-sm">Non rattachée</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {produitDetail?.touches_psw?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {produitDetail.touches_psw.slice(0, 2).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                              {t}
                            </span>
                          ))}
                          {produitDetail.touches_psw.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{produitDetail.touches_psw.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
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
            value={Array.isArray(form.touches_psw) ? form.touches_psw.join(', ') : form.touches_psw || ''}
            onChange={(v) => {
              const touches = v.split(',').map(t => t.trim()).filter(Boolean);
              setForm({ ...form, touches_psw: touches });
            }}
            placeholder="Touches caisse (optionnel)"
          />
          
          {/* Bouton pour charger les suggestions PSW */}
          {form.restaurant_id && (
            <div className="mt-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch(`${API}/touches-psw-suggestions?restaurant_id=${form.restaurant_id}`);
                  const data = await res.json();
                  setTouchesPswSuggestionsCarteModule(data.suggestions || []);
                }}
                className="trinity-button"
              >
                📋 Charger les produits de ce restaurant
              </button>
              
              {/* Suggestions */}
              {touchesPswSuggestionsCarteModule.length > 0 && (
                <div className="mt-3 p-3 bg-secondary/30 rounded border max-h-48 overflow-y-auto">
                  <div className="text-xs text-muted-foreground mb-2">
                    Cliquez pour ajouter :
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {touchesPswSuggestionsCarteModule.slice(0, 50).map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const currentTouches = Array.isArray(form.touches_psw) ? form.touches_psw : [];
                          if (!currentTouches.includes(suggestion)) {
                            setForm({...form, touches_psw: [...currentTouches, suggestion]});
                          }
                        }}
                        className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded text-xs transition"
                        disabled={Array.isArray(form.touches_psw) && form.touches_psw.includes(suggestion)}
                      >
                        {Array.isArray(form.touches_psw) && form.touches_psw.includes(suggestion) ? '✓ ' : ''}{suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Chips sélectionnées */}
              {Array.isArray(form.touches_psw) && form.touches_psw.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.touches_psw.map((touche, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm flex items-center gap-1"
                    >
                      {touche}
                      <button
                        type="button"
                        onClick={() => {
                          const newTouches = form.touches_psw.filter((_, i) => i !== idx);
                          setForm({...form, touches_psw: newTouches});
                        }}
                        className="hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
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
  
  const [touchesPswSuggestions, setTouchesPswSuggestions] = useState([]);

  
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
      touches_psw: [],
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
                      <div className="text-xs text-muted-foreground">
                        {fiche.is_food ? "Food Cost" : "Bev Cost"}
                      </div>
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

          {/* Touches PSW */}
          {form.type_fiche === "produit_fini" && (
            <div className="trinity-card">
              <h3 className="font-semibold mb-2">🎯 Touches PSW</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Noms des produits dans les fichiers de ventes (cliquez pour sélectionner ou saisissez manuellement)
              </p>
              
              {/* Bouton pour charger les suggestions */}
              <button
                type="button"
                onClick={async () => {
                  if (!form.restaurant_id) {
                    alert("Veuillez d'abord sélectionner un restaurant");
                    return;
                  }
                  const res = await fetch(`${API}/touches-psw-suggestions?restaurant_id=${form.restaurant_id}`);
                  const data = await res.json();
                  setTouchesPswSuggestions(data.suggestions || []);
                }}
                className="trinity-button mb-3"
                disabled={!form.restaurant_id}
              >
                📋 Charger les produits de ce restaurant
              </button>
              
              {/* Suggestions */}
              {touchesPswSuggestions.length > 0 && (
                <div className="mb-3 p-3 bg-secondary/30 rounded border max-h-48 overflow-y-auto">
                  <div className="text-xs text-muted-foreground mb-2">
                    Cliquez sur un produit pour l'ajouter :
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {touchesPswSuggestions.slice(0, 50).map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (!form.touches_psw.includes(suggestion)) {
                            setForm({...form, touches_psw: [...form.touches_psw, suggestion]});
                          }
                        }}
                        className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded text-xs transition"
                        disabled={form.touches_psw.includes(suggestion)}
                      >
                        {form.touches_psw.includes(suggestion) ? '✓ ' : ''}{suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Saisie manuelle */}
              <input
                type="text"
                value={form.touches_psw?.join(', ') || ''}
                onChange={(e) => {
                  const touches = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  setForm({...form, touches_psw: touches});
                }}
                placeholder="Ou saisissez manuellement : Ex: CORONA 33, BIERE CORONA"
                className="trinity-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Utilisé pour matcher automatiquement les ventes avec cette fiche technique
              </p>
              
              {/* Touches sélectionnées */}
              {form.touches_psw && form.touches_psw.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.touches_psw.map((touche, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm flex items-center gap-1"
                    >
                      {touche}
                      <button
                        type="button"
                        onClick={() => {
                          const newTouches = form.touches_psw.filter((_, i) => i !== idx);
                          setForm({...form, touches_psw: newTouches});
                        }}
                        className="hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
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
    avg_bev_cost: 0,
    cout_production_total: 0,
    cout_food_total: 0,
    cout_bev_total: 0,
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

export default App;
