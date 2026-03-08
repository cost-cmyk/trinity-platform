#!/usr/bin/env python3
"""
Test RÉALISTE : Les DEUX doublons ont des ventes.
Simule exactement la situation de l'utilisateur.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from uuid import uuid4

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "trinity_db")

async def test_realistic_duplicates():
    """Test avec DEUX imports qui ont TOUS LES DEUX des ventes."""
    
    print("🧪 TEST RÉALISTE - Doublons avec données")
    print("="*60)
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        test_filename = "MEHERIO_ventes_20260302.xls"
        test_restaurant_id = "resto-123"
        
        # Import 1 : Premier import (plus ANCIEN)
        import1_id = str(uuid4())
        import1 = {
            "id": import1_id,
            "nom_fichier": test_filename,
            "type": "ventes",
            "restaurant_id": test_restaurant_id,
            "date_import": "2026-03-04T12:00:00.000000+00:00",  # Plus ancien
            "statut": "importé",
            "nb_lignes": 103
        }
        
        # Import 2 : Doublon (plus RÉCENT, créé 2 sec après)
        import2_id = str(uuid4())
        import2 = {
            "id": import2_id,
            "nom_fichier": test_filename,
            "type": "ventes",
            "restaurant_id": test_restaurant_id,
            "date_import": "2026-03-04T12:00:02.000000+00:00",  # Plus récent
            "statut": "importé",
            "nb_lignes": 103  # Même nombre !
        }
        
        await db.imports.insert_one(import1)
        await db.imports.insert_one(import2)
        print(f"✅ Import 1 créé : {import1_id[:8]}... (12:00:00)")
        print(f"✅ Import 2 créé : {import2_id[:8]}... (12:00:02)")
        
        # Créer des ventes pour LES DEUX imports
        print("\n📊 Création de ventes pour LES DEUX imports...")
        
        ventes1 = []
        for i in range(103):
            ventes1.append({
                "id": str(uuid4()),
                "import_id": import1_id,
                "restaurant_id": test_restaurant_id,
                "date": "2026-03-02",
                "ca_ht": 100.0 + i,
                "nb_couverts": 1
            })
        await db.ventes.insert_many(ventes1)
        print(f"✅ 103 ventes créées pour Import 1")
        
        ventes2 = []
        for i in range(103):
            ventes2.append({
                "id": str(uuid4()),
                "import_id": import2_id,
                "restaurant_id": test_restaurant_id,
                "date": "2026-03-02",
                "ca_ht": 100.0 + i,
                "nb_couverts": 1
            })
        await db.ventes.insert_many(ventes2)
        print(f"✅ 103 ventes créées pour Import 2 (doublon)")
        
        # Vérifier l'état
        print("\n🔍 ÉTAT AVANT NETTOYAGE:")
        import1_ventes = await db.ventes.count_documents({"import_id": import1_id})
        import2_ventes = await db.ventes.count_documents({"import_id": import2_id})
        total_ventes = await db.ventes.count_documents({})
        print(f"  Import 1 (ANCIEN) : {import1_ventes} ventes")
        print(f"  Import 2 (RÉCENT) : {import2_ventes} ventes")
        print(f"  TOTAL BDD: {total_ventes} ventes")
        
        # Calculer CA AVANT
        ca_avant = 0
        async for vente in db.ventes.find({}):
            ca_avant += vente.get('ca_ht', 0)
        print(f"  CA TOTAL: {ca_avant:.2f} F")
        
        # Simuler la logique
        print("\n🧹 SIMULATION LOGIQUE DE NETTOYAGE...")
        
        imports_group = [import1, import2]
        imports_with_counts = []
        
        for imp in imports_group:
            real_count = await db.ventes.count_documents({"import_id": imp['id']})
            imports_with_counts.append({
                'import': imp,
                'real_data_count': real_count
            })
            print(f"  {imp['id'][:8]}... ({imp['date_import'][11:19]}) : {real_count} ventes")
        
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
        to_delete_count = sorted_imports[1]['real_data_count']
        
        print(f"\n✅ DÉCISION DE LA LOGIQUE:")
        print(f"  À GARDER   : {to_keep['id'][:8]}... (date: {to_keep['date_import'][11:19]}, ventes: {to_keep_count})")
        print(f"  À SUPPRIMER: {to_delete[0]['id'][:8]}... (date: {to_delete[0]['date_import'][11:19]}, ventes: {to_delete_count})")
        
        # Vérifier quelle est la bonne décision
        print("\n🤔 ANALYSE:")
        if to_keep_count == to_delete_count:
            print(f"  ⚠️ Les deux ont le MÊME nombre de ventes ({to_keep_count})")
            print(f"  → La logique utilise la date comme critère secondaire")
            print(f"  → Elle garde le plus RÉCENT : {to_keep['date_import'][11:19]}")
            print(f"\n  ❓ Est-ce le bon choix ?")
            print(f"     - Import 1 (ANCIEN) est le PREMIER créé → Devrait être gardé")
            print(f"     - Import 2 (RÉCENT) est le DOUBLON → Devrait être supprimé")
            
            if to_keep['id'] == import2_id:
                print(f"\n  ❌ PROBLÈME DÉTECTÉ !")
                print(f"     La logique garde le RÉCENT (doublon) au lieu de l'ANCIEN (original)")
        
        # Simuler la suppression
        print(f"\n🗑️ SIMULATION SUPPRESSION:")
        print(f"  Suppression de l'import {to_delete[0]['id'][:8]}...")
        print(f"  Suppression de ses {to_delete_count} ventes associées...")
        
        # Calculer l'état APRÈS
        ventes_restantes = to_keep_count
        ca_apres = ca_avant / 2  # On perd la moitié
        
        print(f"\n📊 ÉTAT APRÈS NETTOYAGE (simulation):")
        print(f"  Imports restants: 1")
        print(f"  Ventes restantes: {ventes_restantes}")
        print(f"  CA restant: {ca_apres:.2f} F (on perd {ca_avant - ca_apres:.2f} F)")
        
        if ventes_restantes < total_ventes / 2:
            print(f"\n  ⚠️ DANGER : On a perdu des données !")
        
        # Nettoyer
        print("\n🧹 Nettoyage des données de test...")
        await db.imports.delete_many({"nom_fichier": test_filename})
        await db.ventes.delete_many({"import_id": {"$in": [import1_id, import2_id]}})
        
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_realistic_duplicates())
