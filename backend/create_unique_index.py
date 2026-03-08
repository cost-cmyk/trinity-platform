#!/usr/bin/env python3
"""
Créer un index unique sur (nom_fichier, type, restaurant_id) pour empêcher les doublons.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "trinity_db")

async def create_unique_index():
    """Créer un index unique pour empêcher les doublons d'imports."""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        print("🔧 Création d'un index unique sur la collection 'imports'...")
        
        # Créer un index unique sur (nom_fichier, type, restaurant_id)
        result = await db.imports.create_index(
            [
                ("nom_fichier", 1),
                ("type", 1),
                ("restaurant_id", 1)
            ],
            unique=True,
            name="unique_import_constraint"
        )
        
        print(f"✅ Index créé: {result}")
        print("\n📝 Désormais, MongoDB empêchera PHYSIQUEMENT les doublons")
        print("   Si un doublon est tenté, MongoDB retournera une erreur")
        
    except Exception as e:
        if "already exists" in str(e):
            print("✅ L'index existe déjà")
        else:
            print(f"❌ Erreur: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_unique_index())
