#!/usr/bin/env python3
"""
Script de nettoyage des imports en double dans MongoDB.
Supprime tous les doublons sauf le plus récent basé sur nom_fichier + type_import + restaurant_id.
"""

import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from collections import defaultdict
import asyncio
from datetime import datetime

# Récupérer les variables d'environnement
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "trinity_db")

if not MONGO_URL:
    print("❌ ERREUR: Variable d'environnement MONGO_URL non trouvée")
    sys.exit(1)

async def cleanup_duplicates():
    """Nettoie les imports en double dans la collection imports."""
    
    print("🔌 Connexion à MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    imports_collection = db.imports
    
    try:
        # Récupérer tous les imports
        print("📥 Récupération de tous les imports...")
        all_imports = await imports_collection.find({}, {"_id": 0}).to_list(None)
        print(f"✅ {len(all_imports)} imports trouvés")
        
        # Grouper par clé unique (nom_fichier, type_import, restaurant_id)
        groups = defaultdict(list)
        for imp in all_imports:
            # Gérer les deux noms de champs possibles pour le type
            type_import = imp.get('type_import') or imp.get('type') or 'ventes'
            key = (
                imp.get('nom_fichier'),
                type_import,
                imp.get('restaurant_id')
            )
            groups[key].append(imp)
        
        # Identifier et supprimer les doublons
        total_duplicates = 0
        total_deleted = 0
        
        for key, imports_group in groups.items():
            if len(imports_group) > 1:
                total_duplicates += len(imports_group)
                print(f"\n🔴 Doublon détecté:")
                print(f"   Fichier: {key[0]}")
                print(f"   Type: {key[1]}")
                print(f"   Restaurant: {key[2]}")
                print(f"   Nombre de copies: {len(imports_group)}")
                
                # Trier par date (du plus récent au plus ancien)
                sorted_imports = sorted(
                    imports_group,
                    key=lambda x: x.get('date_import', ''),
                    reverse=True
                )
                
                # Garder le plus récent
                to_keep = sorted_imports[0]
                to_delete = sorted_imports[1:]
                
                print(f"   ✅ À garder: ID={to_keep['id']}, Date={to_keep.get('date_import', 'N/A')}")
                
                # Supprimer les autres
                for imp in to_delete:
                    print(f"   ❌ À supprimer: ID={imp['id']}, Date={imp.get('date_import', 'N/A')}")
                    result = await imports_collection.delete_one({"id": imp['id']})
                    if result.deleted_count > 0:
                        total_deleted += 1
                        print(f"      ✓ Supprimé")
                    else:
                        print(f"      ✗ Échec de suppression")
        
        # Résumé
        print("\n" + "="*60)
        print(f"📊 RÉSUMÉ DU NETTOYAGE")
        print("="*60)
        print(f"Total imports au départ: {len(all_imports)}")
        print(f"Total doublons trouvés: {total_duplicates}")
        print(f"Total suppressions réussies: {total_deleted}")
        print(f"Total imports après nettoyage: {len(all_imports) - total_deleted}")
        
        if total_deleted > 0:
            print(f"\n✅ Nettoyage terminé avec succès!")
        else:
            print(f"\n✅ Aucun doublon à nettoyer!")
        
    except Exception as e:
        print(f"\n❌ ERREUR lors du nettoyage: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("\n🔌 Connexion MongoDB fermée")

if __name__ == "__main__":
    print("🧹 Script de nettoyage des doublons d'imports")
    print("="*60)
    asyncio.run(cleanup_duplicates())
