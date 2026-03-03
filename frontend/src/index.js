import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Enregistrement du Service Worker pour PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // D'abord, supprimer les anciens service workers
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
      }
      
      // Ensuite, enregistrer le nouveau service worker
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✅ PWA Service Worker enregistré:', registration.scope);
          
          // Vérifier les mises à jour toutes les heures
          setInterval(() => {
            registration.update();
          }, 3600000);
          
          // Écouter les mises à jour du service worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nouvelle version disponible, demander à l'utilisateur de recharger
                if (confirm('Une nouvelle version de Trinity est disponible. Recharger maintenant ?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch((error) => {
          console.log('❌ Échec enregistrement Service Worker:', error);
        });
    });
  });
}
