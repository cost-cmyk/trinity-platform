#!/usr/bin/env python3
"""
Script pour nettoyer les imports en doublon dans la base de données
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def cleanup_duplicates():
    # Connexion à MongoDB
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        print("❌ MONGO_URL non défini")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get("DB_NAME", "trinity_db")
    db = client[db_name]
    
    print(f"🔍 Connexion à MongoDB: {db_name}")
    
    # Récupérer tous les imports
    imports = await db.imports.find({}, {"_id": 0}).to_list(1000)
    print(f"📊 Total imports: {len(imports)}")
    
    # Grouper par clé unique (nom_fichier + restaurant_id + type)
    groups = {}
    for imp in imports:
        key = f"{imp.get('nom_fichier', '')}_{imp.get('restaurant_id', '')}_{imp.get('type', '')}"
        if key not in groups:
            groups[key] = []
        groups[key].append(imp)
    
    # Identifier et supprimer les doublons
    duplicates_removed = 0
    for key, group in groups.items():
        if len(group) > 1:
            # Trier par date d'import (garder le plus ancien)
            group.sort(key=lambda x: x.get('date_import', ''))
            
            print(f"\n🔍 Doublon trouvé: {group[0].get('nom_fichier', 'N/A')}")
            print(f"   {len(group)} enregistrements:")
            
            # Garder le premier, supprimer les autres
            to_keep = group[0]
            to_delete = group[1:]
            
            for imp in to_delete:
                print(f"   🗑️  Suppression: ID={imp['id']}, Date={imp.get('date_import', 'N/A')}")
                await db.imports.delete_one({"id": imp["id"]})
                duplicates_removed += 1
            
            print(f"   ✅ Conservé: ID={to_keep['id']}, Date={to_keep.get('date_import', 'N/A')}")
    
    print(f"\n✅ Nettoyage terminé:")
    print(f"   - Doublons supprimés: {duplicates_removed}")
    print(f"   - Imports restants: {len(imports) - duplicates_removed}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(cleanup_duplicates())
