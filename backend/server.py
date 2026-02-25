from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import xlrd
import openpyxl

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Trinity API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# ====================== MODELS ======================

class RestaurantBase(BaseModel):
    nom: str
    code: str
    type: str = "RESTAURANT"  # RESTAURANT, BAR, PRODUCTION
    couleur: str = "#f97316"  # Orange par défaut
    jours_fermeture: List[int] = []  # 0=Lundi, 6=Dimanche
    actif: bool = True

class RestaurantCreate(RestaurantBase):
    pass

class Restaurant(RestaurantBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProduitBase(BaseModel):
    nom: str
    restaurant_id: str
    categorie: str  # Entrées, Plats, Desserts, Boissons, etc.
    prix_vente: float
    is_food: bool = True  # True=Nourriture, False=Boisson
    description: Optional[str] = ""
    touches_psw: Optional[str] = ""  # Touches caisse PSW
    fiche_technique_id: Optional[str] = None
    actif: bool = True

class ProduitCreate(ProduitBase):
    pass

class Produit(ProduitBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class IngredientFiche(BaseModel):
    nom: str
    quantite: float
    unite: str  # g, kg, L, ml, unité
    prix_unitaire: float
    cout_ligne: float = 0

class FicheTechniqueBase(BaseModel):
    nom: str
    restaurant_id: str
    type_fiche: str = "standard"  # standard, preparation
    famille: str = ""
    nb_portions: int = 1
    prix_vente: float = 0
    ingredients: List[IngredientFiche] = []
    statut: str = "brouillon"  # brouillon, fait

class FicheTechniqueCreate(FicheTechniqueBase):
    pass

class FicheTechnique(FicheTechniqueBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cout_total: float = 0
    food_cost_pct: float = 0
    linked_produit_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class VenteBase(BaseModel):
    restaurant_id: str
    date_vente: str  # YYYY-MM-DD
    produit_nom: str
    produit_carte_id: Optional[str] = None
    quantite: int
    prix_unitaire: float
    ca_ttc: float
    remise: float = 0
    is_food: bool = True
    import_id: Optional[str] = None
    exclu: bool = False
    annotation: Optional[str] = ""

class Vente(VenteBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ImportRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # ventes, achats, carte
    restaurant_id: str
    nom_fichier: str
    date_import: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    statut: str = "importé"  # en_attente, importé, erreur
    nb_lignes: int = 0
    erreurs: List[str] = []

# ====================== RESTAURANTS ======================

@api_router.get("/restaurants", response_model=List[Restaurant])
async def get_restaurants():
    restaurants = await db.restaurants.find({}, {"_id": 0}).to_list(100)
    return restaurants

@api_router.get("/restaurants/{restaurant_id}", response_model=Restaurant)
async def get_restaurant(restaurant_id: str):
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant non trouvé")
    return restaurant

@api_router.post("/restaurants", response_model=Restaurant)
async def create_restaurant(data: RestaurantCreate):
    restaurant = Restaurant(**data.model_dump())
    doc = restaurant.model_dump()
    await db.restaurants.insert_one(doc)
    return restaurant

@api_router.put("/restaurants/{restaurant_id}", response_model=Restaurant)
async def update_restaurant(restaurant_id: str, data: RestaurantCreate):
    existing = await db.restaurants.find_one({"id": restaurant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Restaurant non trouvé")
    update_data = data.model_dump()
    await db.restaurants.update_one({"id": restaurant_id}, {"$set": update_data})
    updated = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return updated

@api_router.delete("/restaurants/{restaurant_id}")
async def delete_restaurant(restaurant_id: str):
    result = await db.restaurants.delete_one({"id": restaurant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant non trouvé")
    return {"message": "Restaurant supprimé"}

# ====================== PRODUITS CARTE ======================

@api_router.get("/produits", response_model=List[Produit])
async def get_produits(restaurant_id: Optional[str] = None, categorie: Optional[str] = None, is_food: Optional[bool] = None):
    query = {}
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    if categorie:
        query["categorie"] = categorie
    if is_food is not None:
        query["is_food"] = is_food
    produits = await db.produits.find(query, {"_id": 0}).to_list(1000)
    return produits

@api_router.get("/produits/{produit_id}", response_model=Produit)
async def get_produit(produit_id: str):
    produit = await db.produits.find_one({"id": produit_id}, {"_id": 0})
    if not produit:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    return produit

@api_router.post("/produits", response_model=Produit)
async def create_produit(data: ProduitCreate):
    produit = Produit(**data.model_dump())
    doc = produit.model_dump()
    await db.produits.insert_one(doc)
    return produit

@api_router.put("/produits/{produit_id}", response_model=Produit)
async def update_produit(produit_id: str, data: ProduitCreate):
    existing = await db.produits.find_one({"id": produit_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    update_data = data.model_dump()
    await db.produits.update_one({"id": produit_id}, {"$set": update_data})
    updated = await db.produits.find_one({"id": produit_id}, {"_id": 0})
    return updated

@api_router.delete("/produits/{produit_id}")
async def delete_produit(produit_id: str):
    result = await db.produits.delete_one({"id": produit_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    return {"message": "Produit supprimé"}

# ====================== FICHES TECHNIQUES ======================

def calculate_fiche_costs(fiche_data: dict) -> dict:
    """Calcule le coût total et le food cost % d'une fiche technique"""
    cout_total = sum(ing.get("cout_ligne", ing.get("quantite", 0) * ing.get("prix_unitaire", 0)) for ing in fiche_data.get("ingredients", []))
    prix_vente = fiche_data.get("prix_vente", 0)
    nb_portions = fiche_data.get("nb_portions", 1) or 1
    cout_portion = cout_total / nb_portions
    food_cost_pct = (cout_portion / prix_vente * 100) if prix_vente > 0 else 0
    return {
        "cout_total": round(cout_total, 2),
        "food_cost_pct": round(food_cost_pct, 1)
    }

@api_router.get("/fiches", response_model=List[FicheTechnique])
async def get_fiches(restaurant_id: Optional[str] = None, statut: Optional[str] = None, type_fiche: Optional[str] = None):
    query = {}
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    if statut:
        query["statut"] = statut
    if type_fiche:
        query["type_fiche"] = type_fiche
    fiches = await db.fiches_techniques.find(query, {"_id": 0}).to_list(500)
    return fiches

@api_router.get("/fiches/{fiche_id}", response_model=FicheTechnique)
async def get_fiche(fiche_id: str):
    fiche = await db.fiches_techniques.find_one({"id": fiche_id}, {"_id": 0})
    if not fiche:
        raise HTTPException(status_code=404, detail="Fiche technique non trouvée")
    return fiche

@api_router.post("/fiches", response_model=FicheTechnique)
async def create_fiche(data: FicheTechniqueCreate):
    fiche_dict = data.model_dump()
    # Calculer cout_ligne pour chaque ingrédient
    for ing in fiche_dict.get("ingredients", []):
        ing["cout_ligne"] = round(ing.get("quantite", 0) * ing.get("prix_unitaire", 0), 2)
    # Calculer coûts
    costs = calculate_fiche_costs(fiche_dict)
    fiche = FicheTechnique(**fiche_dict, **costs)
    doc = fiche.model_dump()
    await db.fiches_techniques.insert_one(doc)
    return fiche

@api_router.put("/fiches/{fiche_id}", response_model=FicheTechnique)
async def update_fiche(fiche_id: str, data: FicheTechniqueCreate):
    existing = await db.fiches_techniques.find_one({"id": fiche_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Fiche technique non trouvée")
    fiche_dict = data.model_dump()
    # Calculer cout_ligne pour chaque ingrédient
    for ing in fiche_dict.get("ingredients", []):
        ing["cout_ligne"] = round(ing.get("quantite", 0) * ing.get("prix_unitaire", 0), 2)
    # Calculer coûts
    costs = calculate_fiche_costs(fiche_dict)
    fiche_dict.update(costs)
    await db.fiches_techniques.update_one({"id": fiche_id}, {"$set": fiche_dict})
    updated = await db.fiches_techniques.find_one({"id": fiche_id}, {"_id": 0})
    return updated

@api_router.delete("/fiches/{fiche_id}")
async def delete_fiche(fiche_id: str):
    result = await db.fiches_techniques.delete_one({"id": fiche_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fiche technique non trouvée")
    return {"message": "Fiche technique supprimée"}

# Lier une fiche à un produit
@api_router.post("/fiches/{fiche_id}/link/{produit_id}")
async def link_fiche_to_produit(fiche_id: str, produit_id: str):
    fiche = await db.fiches_techniques.find_one({"id": fiche_id})
    if not fiche:
        raise HTTPException(status_code=404, detail="Fiche technique non trouvée")
    produit = await db.produits.find_one({"id": produit_id})
    if not produit:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    await db.fiches_techniques.update_one({"id": fiche_id}, {"$set": {"linked_produit_id": produit_id}})
    await db.produits.update_one({"id": produit_id}, {"$set": {"fiche_technique_id": fiche_id}})
    return {"message": "Fiche liée au produit"}

# ====================== VENTES ======================

@api_router.get("/ventes", response_model=List[Vente])
async def get_ventes(restaurant_id: Optional[str] = None, date_vente: Optional[str] = None, limit: int = 1000):
    query = {}
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    if date_vente:
        query["date_vente"] = date_vente
    ventes = await db.ventes.find(query, {"_id": 0}).sort("date_vente", -1).to_list(limit)
    return ventes

@api_router.post("/ventes/bulk", response_model=dict)
async def create_ventes_bulk(ventes: List[VenteBase]):
    """Import en masse des ventes"""
    if not ventes:
        raise HTTPException(status_code=400, detail="Aucune vente à importer")
    docs = []
    for v in ventes:
        vente = Vente(**v.model_dump())
        docs.append(vente.model_dump())
    result = await db.ventes.insert_many(docs)
    return {"inserted": len(result.inserted_ids)}

@api_router.delete("/ventes")
async def delete_ventes(restaurant_id: Optional[str] = None, date_vente: Optional[str] = None, import_id: Optional[str] = None):
    """Supprimer des ventes (par restaurant, date ou import)"""
    query = {}
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    if date_vente:
        query["date_vente"] = date_vente
    if import_id:
        query["import_id"] = import_id
    if not query:
        raise HTTPException(status_code=400, detail="Au moins un filtre requis")
    result = await db.ventes.delete_many(query)
    return {"deleted": result.deleted_count}

# ====================== IMPORTS ======================

@api_router.get("/imports", response_model=List[ImportRecord])
async def get_imports(restaurant_id: Optional[str] = None, type: Optional[str] = None):
    query = {}
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    if type:
        query["type"] = type
    imports = await db.imports.find(query, {"_id": 0}).sort("date_import", -1).to_list(100)
    return imports

@api_router.post("/imports", response_model=ImportRecord)
async def create_import(data: dict):
    import_record = ImportRecord(**data)
    doc = import_record.model_dump()
    await db.imports.insert_one(doc)
    return import_record

# ====================== DASHBOARD / STATS ======================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(restaurant_id: Optional[str] = None, date: Optional[str] = None):
    """Statistiques pour le dashboard"""
    # Compter les entités
    restaurants_count = await db.restaurants.count_documents({"actif": True})
    produits_count = await db.produits.count_documents({"actif": True})
    fiches_count = await db.fiches_techniques.count_documents({})
    
    # Stats ventes
    ventes_query = {}
    if restaurant_id:
        ventes_query["restaurant_id"] = restaurant_id
    if date:
        ventes_query["date_vente"] = date
    
    pipeline = [
        {"$match": ventes_query},
        {"$group": {
            "_id": None,
            "ca_total": {"$sum": "$ca_ttc"},
            "total_couverts": {"$sum": "$quantite"},
            "nb_ventes": {"$sum": 1}
        }}
    ]
    
    ventes_stats = await db.ventes.aggregate(pipeline).to_list(1)
    ventes_data = ventes_stats[0] if ventes_stats else {"ca_total": 0, "total_couverts": 0, "nb_ventes": 0}
    
    # Top 10 ventes
    top_pipeline = [
        {"$match": ventes_query},
        {"$group": {
            "_id": "$produit_nom",
            "quantite": {"$sum": "$quantite"},
            "ca": {"$sum": "$ca_ttc"},
            "is_food": {"$first": "$is_food"}
        }},
        {"$sort": {"quantite": -1}},
        {"$limit": 10}
    ]
    top_ventes = await db.ventes.aggregate(top_pipeline).to_list(10)
    
    # Food cost moyen des fiches
    fiches_pipeline = [
        {"$match": {"statut": "fait"}},
        {"$group": {
            "_id": None,
            "avg_food_cost": {"$avg": "$food_cost_pct"}
        }}
    ]
    fiches_stats = await db.fiches_techniques.aggregate(fiches_pipeline).to_list(1)
    avg_food_cost = fiches_stats[0]["avg_food_cost"] if fiches_stats else 0
    
    return {
        "restaurants_count": restaurants_count,
        "produits_count": produits_count,
        "fiches_count": fiches_count,
        "ca_total": round(ventes_data.get("ca_total", 0), 2),
        "total_couverts": ventes_data.get("total_couverts", 0),
        "nb_ventes": ventes_data.get("nb_ventes", 0),
        "avg_food_cost": round(avg_food_cost or 0, 1),
        "top_ventes": [{"nom": t["_id"], "quantite": t["quantite"], "ca": round(t["ca"], 2), "is_food": t.get("is_food", True)} for t in top_ventes]
    }

@api_router.get("/dashboard/restaurants-stats")
async def get_restaurants_stats():
    """Statistiques par restaurant"""
    restaurants = await db.restaurants.find({"actif": True}, {"_id": 0}).to_list(100)
    
    stats = []
    for resto in restaurants:
        # CA pour ce restaurant
        pipeline = [
            {"$match": {"restaurant_id": resto["id"]}},
            {"$group": {
                "_id": None,
                "ca_total": {"$sum": "$ca_ttc"},
                "nb_ventes": {"$sum": 1}
            }}
        ]
        ventes = await db.ventes.aggregate(pipeline).to_list(1)
        ventes_data = ventes[0] if ventes else {"ca_total": 0, "nb_ventes": 0}
        
        # Nombre de produits
        produits_count = await db.produits.count_documents({"restaurant_id": resto["id"], "actif": True})
        
        # Nombre de fiches
        fiches_count = await db.fiches_techniques.count_documents({"restaurant_id": resto["id"]})
        
        stats.append({
            "id": resto["id"],
            "nom": resto["nom"],
            "code": resto["code"],
            "couleur": resto["couleur"],
            "type": resto["type"],
            "ca_total": round(ventes_data.get("ca_total", 0), 2),
            "nb_ventes": ventes_data.get("nb_ventes", 0),
            "produits_count": produits_count,
            "fiches_count": fiches_count
        })
    
    return stats

# ====================== CATEGORIES ======================

@api_router.get("/categories")
async def get_categories():
    """Liste des catégories disponibles"""
    return {
        "produits": ["Entrées", "Plats", "Desserts", "Boissons chaudes", "Boissons froides", "Alcools", "Apéritifs", "Menus"],
        "fiches": ["Entrées", "Plats", "Desserts", "Boissons", "Préparations de base", "Sauces"],
        "unites": ["g", "kg", "L", "ml", "cl", "unité", "pièce"]
    }

# ====================== HEALTH ======================

@api_router.get("/")
async def root():
    return {"message": "Trinity API v1.0", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
