import React, { useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Utility functions (duplicated for now, will be centralized later)
const fmt = (n, decimals = 0) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  }).format(n);
};

const fmtPrice = (n) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(Math.round(n)) + " F";
};

const Dashboard = ({ stats, restaurantStats, loading, restaurants, onRefreshWithMonth }) => {
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restoDashboard, setRestoDashboard] = useState(null);
  const [restoLoading, setRestoLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

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

  // Continue with the rest of Dashboard JSX...
  // This is a placeholder - I'll extract the full component in the next step
  return (
    <div>
      <h2>Dashboard Component</h2>
      <p>To be completed with full extraction...</p>
    </div>
  );
};

export default Dashboard;
