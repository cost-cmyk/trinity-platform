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
import API from "@/utils/api";
import { RESTO_COLORS } from "@/utils/colors";
import Dashboard from "@/components/Dashboard/Dashboard";
import RestaurantsModule from "@/components/Restaurants/RestaurantsModule";
import FichesModule from "@/components/Fiches/FichesModule";
import ImportModule from "@/components/Import/ImportModule";

const RestaurantContext = createContext(null);

// Couleurs disponibles pour les restaurants

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

// ====================== MAIN APP ======================
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

export default App;
