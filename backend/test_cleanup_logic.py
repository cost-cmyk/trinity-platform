#!/usr/bin/env python3
"""
Script de test pour vérifier la logique de nettoyage des doublons.
Simule la situation de l'utilisateur avec des doublons où un import a des données
et l'autre est vide.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
from uuid import uuid4

# Récupérer les variables d'environnement
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "trinity_db")

async def test_cleanup_logic():
    """Teste la logique de nettoyage avec des données simulées."""
    
    print("🧪 TEST DE LA LOGIQUE DE NETTOYAGE")
    print("="*60)
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Créer un doublon de test
        print("\n📝 Création d'un doublon de test...")
        
        test_filename = "TEST_DOUBLON_ventes.xls"
        test_restaurant_id = "test-restaurant-123"
        
        # Import 1 : Celui avec des DONNÉES (créé en premier, donc plus ancien)
        import1_id = str(uuid4())
        import1 = {
            "id": import1_id,
            "nom_fichier": test_filename,
            "type": "ventes",
            "restaurant_id": test_restaurant_id,
            "date_import": "2026-03-04T10:00:00.000000+00:00",  # Plus ancien
            "statut": "importé",
            "nb_lignes": 100
        }
        
        # Import 2 : Celui VIDE (doublon créé après, donc plus récent)
        import2_id = str(uuid4())
        import2 = {
            "id": import2_id,
            "nom_fichier": test_filename,
            "type": "ventes",
            "restaurant_id": test_restaurant_id,
            "date_import": "2026-03-04T10:00:02.000000+00:00",  # Plus récent (2 sec après)
            "statut": "importé",
            "nb_lignes": 100  # Même nb_lignes car même fichier !
        }
        
        # Insérer les imports
        await db.imports.insert_one(import1)
        await db.imports.insert_one(import2)
        print(f"✅ Import 1 créé (avec données) : {import1_id}")
        print(f"✅ Import 2 créé (vide) : {import2_id}")
        
        # Créer des ventes SEULEMENT pour l'import 1
        print("\n📊 Création de 50 ventes pour l'import 1...")
        ventes = []
        for i in range(50):
            ventes.append({
                "id": str(uuid4()),
                "import_id": import1_id,
                "restaurant_id": test_restaurant_id,
                "date": "2026-03-04",
                "ca_ht": 100.0 + i,
                "nb_couverts": 1
            })
        await db.ventes.insert_many(ventes)
        print(f"✅ 50 ventes créées pour import 1")
        
        # Vérifier l'état AVANT nettoyage
        print("\n🔍 ÉTAT AVANT NETTOYAGE:")
        import1_ventes = await db.ventes.count_documents({"import_id": import1_id})
        import2_ventes = await db.ventes.count_documents({"import_id": import2_id})
        print(f"  Import 1 (plus ancien) : {import1_ventes} ventes réelles")
        print(f"  Import 2 (plus récent) : {import2_ventes} ventes réelles")
        
        # Simuler la logique de nettoyage
        print("\n🧹 SIMULATION DE LA LOGIQUE DE NETTOYAGE...")
        
        # Récupérer les deux imports
        imports_group = [import1, import2]
        
        # Compter les ventes réelles
        imports_with_counts = []
        for imp in imports_group:
            real_count = await db.ventes.count_documents({"import_id": imp['id']})
            imports_with_counts.append({
                'import': imp,
                'real_data_count': real_count
            })
            print(f"  {imp['id'][:8]}... : {real_count} ventes réelles")
        
        # Trier
        sorted_imports = sorted(
            imports_with_counts,
            key=lambda x: (
                x['real_data_count'],
                x['import'].get('date_import', '')
            ),
            reverse=True
        )
        
        to_keep = sorted_imports[0]['import']
        to_keep_count = sorted_imports[0]['real_data_count']
        to_delete = [item['import'] for item in sorted_imports[1:]]
        
        print(f"\n✅ DÉCISION:")
        print(f"  À GARDER : {to_keep['id'][:8]}... ({to_keep_count} ventes)")
        print(f"  À SUPPRIMER : {to_delete[0]['id'][:8]}... ({sorted_imports[1]['real_data_count']} ventes)")
        
        # Vérifier que la bonne décision est prise
        if to_keep['id'] == import1_id:
            print("\n🎉 ✅ SUCCÈS : La logique garde le bon import (celui avec les données) !")
        else:
            print("\n❌ ÉCHEC : La logique garde le mauvais import (celui sans données) !")
        
        # Nettoyer les données de test
        print("\n🧹 Nettoyage des données de test...")
        await db.imports.delete_many({"nom_fichier": test_filename})
        await db.ventes.delete_many({"import_id": {"$in": [import1_id, import2_id]}})
        print("✅ Données de test supprimées")
        
    except Exception as e:
        print(f"\n❌ ERREUR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_cleanup_logic())
