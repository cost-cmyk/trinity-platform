import React, { useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmt, fmtPrice, fmtPct } from "@/utils/format";
import API from "@/utils/api";

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
            0 F
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
              {stats.avg_food_cost ? stats.avg_food_cost.toFixed(1) : '0.0'}%
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
              0.0%
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-[#2dd4bf]" style={{ width: '0%' }} />
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
                  const foodCost = r.food_cost_percent || 0;
                  const bevCost = r.beverage_cost_percent || 0;
                  const matiere = r.matiere_percent || 0;
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


export default Dashboard;
