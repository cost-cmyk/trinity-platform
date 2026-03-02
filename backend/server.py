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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection with retry logic
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')

if not mongo_url or not db_name:
    logger.error("MONGO_URL or DB_NAME not found in environment variables")
    raise ValueError("Missing MongoDB configuration")

logger.info(f"Connecting to MongoDB: {mongo_url[:20]}...")
logger.info(f"Using database: {db_name}")

try:
    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=10000,  # 10 seconds timeout
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
        maxPoolSize=10,
        minPoolSize=1
    )
    db = client[db_name]
    logger.info("MongoDB client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize MongoDB client: {e}")
    raise

app = FastAPI(title="Trinity API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# ====================== MIGRATIONS ======================

async def migrate_restaurants():
    """Migration pour renommer et ajouter les restaurants manquants"""
    try:
        logger.info("🔄 Démarrage de la migration des restaurants...")
        
        # Définir les restaurants attendus
        expected_restaurants = [
            {"nom": "Meherio", "code": "MEH", "couleur": "#f97316"},
            {"nom": "Urban Café", "code": "URB", "couleur": "#06b6d4"},
            {"nom": "Jimmy Punaauia", "code": "JP", "couleur": "#8b5cf6"},
            {"nom": "Jimmy Papeete", "code": "JPP", "couleur": "#84cc16"},
            {"nom": "Laboratoire", "code": "LAB", "couleur": "#10b981", "type": "PRODUCTION"},
            {"nom": "Instant Présent", "code": "IP", "couleur": "#ec4899"},
            {"nom": "Urban Garden", "code": "UG", "couleur": "#3b82f6"},
            {"nom": "Urban Fare Ute", "code": "UFU", "couleur": "#f59e0b"}
        ]
        
        # Récupérer les restaurants existants
        existing = await db.restaurants.find({}, {"_id": 0}).to_list(100)
        existing_names = {r["nom"]: r for r in existing}
        
        # Renommer les anciens restaurants
        rename_map = {
            "Jimmy2": "Jimmy Punaauia",
            "Jimmy": "Jimmy Papeete"
        }
        
        for old_name, new_name in rename_map.items():
            if old_name in existing_names:
                logger.info(f"  ✏️  Renommage: {old_name} → {new_name}")
                await db.restaurants.update_one(
                    {"nom": old_name},
                    {"$set": {"nom": new_name}}
                )
                # Mettre à jour le dictionnaire local
                r = existing_names.pop(old_name)
                r["nom"] = new_name
                existing_names[new_name] = r
        
        # Ajouter les restaurants manquants
        for expected in expected_restaurants:
            if expected["nom"] not in existing_names:
                logger.info(f"  ➕ Ajout: {expected['nom']}")
                new_resto = {
                    "id": str(uuid.uuid4()),
                    "nom": expected["nom"],
                    "code": expected["code"],
                    "type": expected.get("type", "RESTAURANT"),
                    "couleur": expected["couleur"],
                    "jours_fermeture": [],
                    "actif": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.restaurants.insert_one(new_resto)
        
        logger.info("✅ Migration des restaurants terminée")
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de la migration des restaurants: {e}")

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
    type_ingredient: str = "achat"  # "achat" ou "sous_fiche"
    fiche_id: Optional[str] = None  # ID de la sous-fiche si type_ingredient="sous_fiche"
    fournisseur: Optional[str] = None  # Fournisseur (si achat)
    date_achat: Optional[str] = None  # Date du dernier achat

class FicheTechniqueBase(BaseModel):
    nom: str
    restaurant_id: str
    type_fiche: str = "produit_fini"  # produit_fini, preparation_base
    famille: str = ""
    is_food: bool = True  # True=Nourriture, False=Boisson
    nb_portions: int = 1
    prix_vente: float = 0
    ingredients: List[IngredientFiche] = []
    statut: str = "brouillon"  # brouillon, fait
    linked_produit_ids: List[str] = []  # Produits de la carte rattachés
    photo_url: Optional[str] = None  # URL de la photo du plat
    poids_total_g: float = 0  # Poids total en grammes

class FicheTechniqueCreate(FicheTechniqueBase):
    pass

class FicheTechnique(FicheTechniqueBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cout_total: float = 0
    food_cost_pct: float = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class VenteBase(BaseModel):
    restaurant_id: str
    date_vente: str  # YYYY-MM-DD
    produit_nom: str
    produit_carte_id: Optional[str] = None
    quantite: int
    prix_unitaire: float
    ca_ttc: float
    ca_ht: Optional[float] = 0  # NOUVEAU
    remise: float = 0
    is_food: bool = True
    famille: Optional[str] = ""  # NOUVEAU
    code_pro: Optional[str] = ""  # NOUVEAU
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

# ====================== FILE UPLOAD & PARSING ======================

def detect_restaurant_from_filename(filename: str, restaurants: list) -> Optional[dict]:
    """Détecte le restaurant à partir du nom de fichier"""
    filename_lower = filename.lower()
    for resto in restaurants:
        if resto["code"].lower() in filename_lower or resto["nom"].lower() in filename_lower:
            return resto
    return None

def detect_date_from_filename(filename: str) -> Optional[str]:
    """Détecte la date à partir du nom de fichier (format YYYYMMDD)"""
    # Pattern: ventes_du_YYYYMMDD ou _YYYYMMDD_
    match = re.search(r'(\d{4})(\d{2})(\d{2})', filename)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month}-{day}"
    return None

# ====================== PARSERS IMPORT CARTES & ACHATS ======================

def parse_carte_xlsx(file_content: bytes, filename: str) -> dict:
    """Parse un fichier .xlsx de carte restaurant et extrait les produits par restaurant"""
    result = {"restaurants": [], "produits": []}
    
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        
        # Traiter chaque feuille (sauf "TOUTES LES CARTES")
        for sheet_name in workbook.sheetnames:
            if sheet_name == "TOUTES LES CARTES":
                continue
            
            sheet = workbook[sheet_name]
            rows = list(sheet.iter_rows(values_only=True))
            
            if not rows or len(rows) < 3:
                continue
            
            # Le nom du restaurant est dans le nom de la feuille
            restaurant_nom = sheet_name.strip()
            
            # Ajouter le restaurant
            result["restaurants"].append({
                "nom": restaurant_nom,
                "code": restaurant_nom.upper()[:3],
                "type": "RESTAURANT",
                "couleur": "#f97316",  # Orange par défaut
                "jours_fermeture": [],
                "actif": True
            })
            
            # Trouver la ligne d'en-tête (ligne 2 après skiprows=2 dans pandas)
            # Format attendu: #, Nom du produit, Catégorie, Prix vente TTC (XPF), Type, Fiche technique, Actif, Description
            header_row = None
            for idx, row in enumerate(rows):
                if row and any(cell for cell in row if cell and 'Nom du produit' in str(cell)):
                    header_row = idx
                    break
            
            if header_row is None:
                continue
            
            # Parser les produits
            current_category = None
            for row in rows[header_row + 1:]:
                if not row or len(row) < 2:
                    continue
                
                # row[0] = # ou Catégorie
                # row[1] = Nom du produit
                # row[2] = Catégorie
                # row[3] = Prix
                # row[4] = Type
                # row[5] = Fiche technique
                # row[6] = Actif
                # row[7] = Description
                
                cell_0 = str(row[0]).strip() if row[0] else ""
                cell_1 = str(row[1]).strip() if len(row) > 1 and row[1] else ""
                
                # Si cell_1 est vide, c'est une ligne de catégorie
                if not cell_1 or cell_1 == "nan":
                    # cell_0 contient la catégorie
                    if cell_0 and cell_0 != "#" and cell_0 != "nan" and not cell_0.isdigit():
                        current_category = cell_0
                    continue
                
                # Extraire les données du produit
                try:
                    nom_produit = cell_1
                    categorie = str(row[2]).strip() if len(row) > 2 and row[2] and str(row[2]).strip() != "nan" else current_category or ""
                    
                    # Prix
                    prix_vente = 0
                    if len(row) > 3 and row[3]:
                        try:
                            prix_vente = float(row[3])
                        except:
                            prix_vente = 0
                    
                    # Type (Nourriture/Boisson)
                    type_produit = str(row[4]).strip().lower() if len(row) > 4 and row[4] else "nourriture"
                    is_food = "nourriture" in type_produit or type_produit == "nourr"
                    
                    # Fiche technique
                    fiche_technique = str(row[5]).strip().lower() if len(row) > 5 and row[5] else "non"
                    has_fiche = fiche_technique == "oui"
                    
                    # Actif
                    actif = str(row[6]).strip().lower() if len(row) > 6 and row[6] else "oui"
                    is_actif = actif == "oui"
                    
                    # Description
                    description = str(row[7]).strip() if len(row) > 7 and row[7] and str(row[7]).strip() != "nan" else ""
                    
                    result["produits"].append({
                        "restaurant_nom": restaurant_nom,
                        "nom": nom_produit,
                        "categorie": categorie,
                        "prix_vente": prix_vente,
                        "is_food": is_food,
                        "description": description,
                        "actif": is_actif
                    })
                    
                except Exception as e:
                    logging.warning(f"Erreur parsing produit: {e}")
                    continue
        
        logging.info(f"Carte parsed: {len(result['restaurants'])} restaurants, {len(result['produits'])} produits")
        return result
        
    except Exception as e:
        logging.error(f"Erreur parsing carte XLSX: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur de lecture du fichier carte: {str(e)}")

def parse_achats_xlsx(file_content: bytes, filename: str) -> List[dict]:
    """Parse un fichier .xlsx d'achats Odoo et extrait les lignes d'achat"""
    achats = []
    
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        sheet = workbook.active
        rows = list(sheet.iter_rows(values_only=True))
        
        if not rows or len(rows) < 2:
            return achats
        
        # En-tête attendu: Référence de la commande, Partenaire, Produit, Prix unitaire, Quantité, Unité de mesure, Sous-total, Taxes, Total, Arrivée prévue
        header_row = rows[0]
        
        # Mapper les colonnes
        col_mapping = {}
        for idx, cell in enumerate(header_row):
            if cell:
                cell_lower = str(cell).lower().strip()
                if 'référence' in cell_lower or 'reference' in cell_lower:
                    col_mapping['reference'] = idx
                elif 'partenaire' in cell_lower or 'fournisseur' in cell_lower:
                    col_mapping['partenaire'] = idx
                elif 'produit' in cell_lower:
                    col_mapping['produit'] = idx
                elif 'prix unitaire' in cell_lower:
                    col_mapping['prix_unitaire'] = idx
                elif 'quantité' in cell_lower or 'quantite' in cell_lower:
                    col_mapping['quantite'] = idx
                elif 'unité' in cell_lower or 'unite' in cell_lower:
                    col_mapping['unite'] = idx
                elif 'total' in cell_lower and 'sous' not in cell_lower:
                    col_mapping['total'] = idx
                elif 'arrivée' in cell_lower or 'arrivee' in cell_lower or 'date' in cell_lower:
                    col_mapping['date'] = idx
        
        # Parser les lignes de données
        current_produit = None
        for row in rows[1:]:
            if not row or len(row) < 3:
                continue
            
            # Dans Odoo, les produits sont groupés: 
            # - Première ligne contient le nom du produit dans colonne Référence
            # - Lignes suivantes contiennent les détails
            
            reference = str(row[col_mapping.get('reference', 0)]).strip() if col_mapping.get('reference') is not None else ""
            partenaire = str(row[col_mapping.get('partenaire', 1)]).strip() if col_mapping.get('partenaire') is not None else ""
            produit = str(row[col_mapping.get('produit', 2)]).strip() if col_mapping.get('produit') is not None else ""
            
            # Si partenaire est vide ou "nan", c'est une ligne de header de produit
            if not partenaire or partenaire == "nan" or partenaire == "None":
                # C'est un header de produit - le nom du produit est dans reference
                if reference and reference != "nan":
                    current_produit = reference.split("(")[0].strip()  # Retirer les infos entre parenthèses
                continue
            
            # C'est une ligne de détail d'achat
            if not current_produit:
                current_produit = produit if produit and produit != "nan" else "Produit inconnu"
            
            # Si le produit est vide ou "nan", utiliser current_produit
            if not produit or produit == "nan" or produit == "None":
                produit_final = current_produit
            else:
                produit_final = produit
            
            try:
                prix_unitaire = float(row[col_mapping.get('prix_unitaire', 3)]) if col_mapping.get('prix_unitaire') is not None and row[col_mapping.get('prix_unitaire')] else 0
                quantite = float(row[col_mapping.get('quantite', 4)]) if col_mapping.get('quantite') is not None and row[col_mapping.get('quantite')] else 0
                unite = str(row[col_mapping.get('unite', 5)]).strip() if col_mapping.get('unite') is not None and row[col_mapping.get('unite')] else "UNITE"
                total = float(row[col_mapping.get('total', 8)]) if col_mapping.get('total') is not None and row[col_mapping.get('total')] else 0
                
                # Date
                date_achat = None
                if col_mapping.get('date') is not None and row[col_mapping.get('date')]:
                    date_val = row[col_mapping.get('date')]
                    if date_val and str(date_val) != "NaT":
                        try:
                            if isinstance(date_val, datetime):
                                date_achat = date_val.strftime("%Y-%m-%d")
                            else:
                                date_achat = str(date_val).split()[0]
                        except:
                            pass
                
                if not date_achat:
                    date_achat = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                
                achats.append({
                    "reference_commande": reference,
                    "fournisseur": partenaire,
                    "produit": produit_final,
                    "prix_unitaire": prix_unitaire,
                    "quantite": quantite,
                    "unite": unite,
                    "total": total,
                    "date_achat": date_achat,
                    "categorie": "Autres"
                })
                
            except Exception as e:
                logging.warning(f"Erreur parsing ligne achat: {e}")
                continue
        
        logging.info(f"Achats parsed: {len(achats)} lignes")
        return achats
        
    except Exception as e:
        logging.error(f"Erreur parsing achats XLSX: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur de lecture du fichier achats: {str(e)}")


def parse_xls_file(file_content: bytes, filename: str) -> List[dict]:
    """Parse un fichier .xls (Excel 97-2003) et extrait les ventes"""
    logging.info(f"🔵 PARSER XLS APPELÉ pour {filename}")
    ventes = []
    
    try:
        workbook = xlrd.open_workbook(file_contents=file_content)
        sheet = workbook.sheet_by_index(0)
        
        # Trouver les colonnes (chercher dans les premières lignes)
        header_row = -1
        col_mapping = {}
        
        # Colonnes attendues PSW - étendu pour le format réel
        expected_cols = {
            'code_pro': ['code pro', 'code_pro', 'code produit', 'code article', 'référence', 'reference', 'ref'],
            'designation': ['désignation', 'designation', 'produit', 'article', 'libellé', 'libelle', 'nom'],
            'quantite': ['qté', 'qte', 'quantité', 'quantite', 'qty', 'nb', 'qté vendue', 'qte vendue'],
            'prix_unitaire': ['pu', 'p.u.', 'pu ttc', 'prix unitaire', 'prix unit', 'prix de vente unitaire', 'prix de vente'],
            'ca_ttc': ['ca ttc', 'ca  ttc', 'cattc', 'montant ttc', 'total ttc'],
            'ca_ht': ['ca ht', 'caht', 'montant ht'],
            'remise': ['remise', 'rem', 'réduction', 'reduction', 'rabais', 'montant total de remise', 'total de remise'],
            'famille': ['famille', 'catégorie', 'categorie', 'groupe'],
            'fournisseur': ['fournisseur', 'type produit']  # BOISSON ou NOURRITURE
        }
        
        # Chercher l'en-tête dans les 10 premières lignes
        for row_idx in range(min(10, sheet.nrows)):
            row_values = [str(cell).lower().strip() for cell in sheet.row_values(row_idx)]
            
            # Vérifier si cette ligne contient des en-têtes
            temp_mapping = {}
            
            for col_idx, cell_value in enumerate(row_values):
                cell_lower = cell_value.lower()  # Comparaison case-insensitive
                for key, aliases in expected_cols.items():
                    if any(alias in cell_lower for alias in aliases):
                        if key not in temp_mapping:  # Garder la première occurrence
                            temp_mapping[key] = col_idx
                        break
            
            # Si on a trouvé désignation et quantité, c'est l'en-tête
            if 'designation' in temp_mapping and 'quantite' in temp_mapping:
                header_row = row_idx
                col_mapping = temp_mapping
                logging.info(f"En-tête trouvé ligne {row_idx}: {col_mapping}")
                break
        
        if header_row == -1:
            # Pas d'en-tête trouvé, format PSW par défaut
            col_mapping = {
                'designation': 1, 
                'quantite': 2, 
                'ca_ht': 3,
                'ca_ttc': 5, 
                'famille': 6, 
                'fournisseur': 7,
                'prix_unitaire': 8, 
                'remise': 9
            }
            header_row = 0
            logging.info("Pas d'en-tête, utilisation format PSW par défaut")
        
        # Parser les données
        for row_idx in range(header_row + 1, sheet.nrows):
            try:
                row = sheet.row_values(row_idx)
                
                # Ignorer les lignes vides ou totaux
                designation_col = col_mapping.get('designation', 1)
                if designation_col >= len(row):
                    continue
                    
                designation = str(row[designation_col]).strip()
                if not designation or designation.lower() in ['total', 'sous-total', 'sous total', '']:
                    continue
                
                # Extraire les valeurs numériques
                def get_float(col_key, default=0):
                    col_idx = col_mapping.get(col_key)
                    if col_idx is not None and col_idx < len(row):
                        val = row[col_idx]
                        if isinstance(val, (int, float)):
                            return float(val)
                        try:
                            val_str = str(val).replace('€', '').replace('F', '').replace(' ', '').replace(',', '.').strip()
                            return float(val_str) if val_str else default
                        except:
                            pass
                    return default
                
                quantite = get_float('quantite', 0)
                prix_unitaire = get_float('prix_unitaire', 0)
                ca_ttc = get_float('ca_ttc', 0)
                ca_ht = get_float('ca_ht', 0)
                remise = get_float('remise', 0)
                
                # Si CA TTC est à 0 mais CA HT existe, utiliser CA HT
                if ca_ttc == 0 and ca_ht > 0:
                    ca_ttc = ca_ht
                
                # Conserver les lignes avec CA TTC > 0 OU avec une remise > 0 (offres) OU avec quantité
                # Ignorer uniquement les lignes complètement vides
                if ca_ttc == 0 and quantite == 0 and remise == 0:
                    continue
                
                # NE PAS exclure les CA TTC négatifs - ils sont conservés
                
                # Remise négative = bug PSW SEULEMENT si CA TTC >= 0
                # Si CA TTC est négatif, on garde la remise négative aussi
                remise_negative = False
                if remise < 0 and ca_ttc >= 0:
                    remise_negative = True
                    remise = 0
                
                # Déterminer si c'est nourriture ou boisson
                # D'abord vérifier la colonne "Fournisseur" si elle existe
                is_food = True
                
                # Vérifier fournisseur (BOISSON ou NOURRITURE)
                fournisseur_col = col_mapping.get('fournisseur')
                if fournisseur_col is not None and fournisseur_col < len(row):
                    fournisseur = str(row[fournisseur_col]).lower().strip()
                    if 'boisson' in fournisseur:
                        is_food = False
                    elif 'nourriture' in fournisseur or 'nourr' in fournisseur:
                        is_food = True
                else:
                    # Sinon vérifier famille et désignation
                    famille = ""
                    if 'famille' in col_mapping and col_mapping['famille'] < len(row):
                        famille = str(row[col_mapping['famille']]).lower()
                    
                    boisson_keywords = ['boisson', 'drink', 'bière', 'biere', 'vin', 'alcool', 'café', 'cafe', 
                                       'thé', 'the', 'soda', 'jus', 'eau', 'cocktail', 'apéritif', 'aperitif', 
                                       'digestif', 'mocktail', 'soft', 'pression', 'verre']
                    if any(kw in famille or kw in designation.lower() for kw in boisson_keywords):
                        is_food = False
                
                # Extraire la famille si disponible
                famille_finale = ""
                famille_col = col_mapping.get('famille')
                logging.info(f"DEBUG: famille_col = {famille_col}, len(row) = {len(row)}")
                if famille_col is not None and famille_col < len(row):
                    famille_finale = str(row[famille_col]).strip()
                    logging.info(f"DEBUG: Famille extraite = '{famille_finale}'")
                else:
                    logging.warning(f"DEBUG: Famille NON extraite (col={famille_col}, len={len(row)})")
                
                # Extraire le code produit si disponible
                code_pro = ""
                code_col = col_mapping.get('code_pro')
                if code_col is not None and code_col < len(row):
                    code_pro = str(row[code_col]).strip()
                
                ventes.append({
                    'produit_nom': designation,
                    'quantite': int(quantite) if quantite else 1,
                    'prix_unitaire': prix_unitaire,
                    'ca_ttc': ca_ttc,
                    'ca_ht': ca_ht,  # Ajouter CA HT
                    'remise': remise,
                    'is_food': is_food,
                    'famille': famille_finale,  # NOUVEAU
                    'code_pro': code_pro,  # NOUVEAU
                    'remise_negative_corrigee': remise_negative
                })
                
            except Exception as e:
                logging.warning(f"Erreur ligne {row_idx}: {e}")
                continue
                
    except Exception as e:
        logging.error(f"Erreur parsing XLS: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur de lecture du fichier XLS: {str(e)}")
    
    return ventes

def parse_xlsx_file(file_content: bytes, filename: str) -> List[dict]:
    """Parse un fichier .xlsx (Excel 2007+) et extrait les ventes"""
    logging.info(f"🟠 PARSER XLSX APPELÉ pour {filename}")
    ventes = []
    
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        sheet = workbook.active
        
        rows = list(sheet.iter_rows(values_only=True))
        
        if not rows:
            return ventes
        
        # Colonnes attendues PSW - étendu pour le format réel
        expected_cols = {
            'designation': ['désignation', 'designation', 'produit', 'article', 'libellé', 'libelle', 'nom'],
            'quantite': ['qté', 'qte', 'quantité', 'quantite', 'qty', 'nb', 'qté vendue', 'qte vendue'],
            'prix_unitaire': ['pu', 'p.u.', 'pu ttc', 'prix unitaire', 'prix unit', 'prix de vente unitaire', 'prix de vente'],
            'ca_ttc': ['ca ttc', 'ca  ttc', 'cattc', 'montant ttc', 'total ttc'],
            'ca_ht': ['ca ht', 'caht', 'montant ht'],
            'remise': ['remise', 'rem', 'réduction', 'reduction', 'rabais', 'montant total de remise'],
            'famille': ['famille', 'catégorie', 'categorie', 'groupe'],
            'fournisseur': ['fournisseur', 'type produit']
        }
        
        header_row = -1
        col_mapping = {}
        
        for row_idx, row in enumerate(rows[:10]):
            row_values = [str(cell).lower().strip() if cell else '' for cell in row]
            
            temp_mapping = {}
            for col_idx, cell_value in enumerate(row_values):
                for key, aliases in expected_cols.items():
                    if any(alias in cell_value for alias in aliases):
                        if key not in temp_mapping:
                            temp_mapping[key] = col_idx
                        break
            
            if 'designation' in temp_mapping and 'quantite' in temp_mapping:
                header_row = row_idx
                col_mapping = temp_mapping
                break
        
        if header_row == -1:
            col_mapping = {
                'designation': 1, 
                'quantite': 2, 
                'ca_ht': 3,
                'ca_ttc': 5, 
                'famille': 6, 
                'fournisseur': 7,
                'prix_unitaire': 8, 
                'remise': 9
            }
            header_row = 0
        
        for row_idx, row in enumerate(rows[header_row + 1:], start=header_row + 1):
            try:
                if not row:
                    continue
                
                designation_col = col_mapping.get('designation', 1)
                if designation_col >= len(row) or not row[designation_col]:
                    continue
                
                designation = str(row[designation_col]).strip()
                if not designation or designation.lower() in ['total', 'sous-total', '']:
                    continue
                
                def get_val(col_key, default=0):
                    col_idx = col_mapping.get(col_key)
                    if col_idx is not None and col_idx < len(row) and row[col_idx] is not None:
                        val = row[col_idx]
                        if isinstance(val, (int, float)):
                            return float(val)
                        try:
                            val_str = str(val).replace('€', '').replace('F', '').replace(' ', '').replace(',', '.').strip()
                            return float(val_str) if val_str else default
                        except:
                            pass
                    return default
                
                quantite = get_val('quantite', 0)
                prix_unitaire = get_val('prix_unitaire', 0)
                ca_ttc = get_val('ca_ttc', 0)
                ca_ht = get_val('ca_ht', 0)
                remise = get_val('remise', 0)
                
                # Si CA TTC est à 0 mais CA HT existe, utiliser CA HT
                if ca_ttc == 0 and ca_ht > 0:
                    ca_ttc = ca_ht
                
                # Conserver les lignes avec CA TTC != 0 OU avec une remise > 0 (offres) OU avec quantité
                # Ignorer uniquement les lignes complètement vides
                if ca_ttc == 0 and quantite == 0 and remise == 0:
                    continue
                
                # NE PAS exclure les CA TTC négatifs - ils sont conservés
                
                # Remise négative = bug PSW SEULEMENT si CA TTC >= 0
                # Si CA TTC est négatif, on garde la remise négative aussi
                remise_negative = False
                if remise < 0 and ca_ttc >= 0:
                    remise_negative = True
                    remise = 0
                
                # Déterminer si c'est nourriture ou boisson
                is_food = True
                
                # Vérifier fournisseur
                fournisseur_col = col_mapping.get('fournisseur')
                if fournisseur_col is not None and fournisseur_col < len(row) and row[fournisseur_col]:
                    fournisseur = str(row[fournisseur_col]).lower().strip()
                    if 'boisson' in fournisseur:
                        is_food = False
                    elif 'nourriture' in fournisseur or 'nourr' in fournisseur:
                        is_food = True
                else:
                    famille = ""
                    if 'famille' in col_mapping and col_mapping['famille'] < len(row) and row[col_mapping['famille']]:
                        famille = str(row[col_mapping['famille']]).lower()
                    
                    boisson_keywords = ['boisson', 'drink', 'bière', 'vin', 'alcool', 'café', 'thé', 'soda', 
                                       'jus', 'eau', 'cocktail', 'mocktail', 'soft', 'pression', 'verre']
                    if any(kw in famille or kw in designation.lower() for kw in boisson_keywords):
                        is_food = False
                
                # Extraire la famille si disponible
                famille_finale = ""
                famille_col = col_mapping.get('famille')
                if famille_col is not None and famille_col < len(row) and row[famille_col]:
                    famille_finale = str(row[famille_col]).strip()
                
                # Extraire le code produit si disponible
                code_pro = ""
                code_col = col_mapping.get('code_pro')
                if code_col is not None and code_col < len(row) and row[code_col]:
                    code_pro = str(row[code_col]).strip()
                
                ventes.append({
                    'produit_nom': designation,
                    'quantite': int(quantite) if quantite else 1,
                    'prix_unitaire': prix_unitaire,
                    'ca_ttc': ca_ttc,
                    'ca_ht': ca_ht,  # Ajouter CA HT
                    'remise': remise,
                    'is_food': is_food,
                    'famille': famille_finale,  # NOUVEAU
                    'code_pro': code_pro,  # NOUVEAU
                    'remise_negative_corrigee': remise_negative
                })
                
            except Exception as e:
                logging.warning(f"Erreur ligne {row_idx}: {e}")
                continue
                
    except Exception as e:
        logging.error(f"Erreur parsing XLSX: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur de lecture du fichier XLSX: {str(e)}")
    
    return ventes

@api_router.post("/imports/preview")
async def preview_import_file(
    file: UploadFile = File(...),
    restaurant_id: str = Form(None),
    date_vente: str = Form(None)
):
    """Prévisualise un fichier de ventes SANS l'importer - pour contrôle"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    filename = file.filename.lower()
    if not filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .xls ou .xlsx")
    
    content = await file.read()
    restaurants = await db.restaurants.find({}, {"_id": 0}).to_list(100)
    
    # Détecter restaurant et date
    detected_restaurant_id = restaurant_id
    detected_date = date_vente
    
    if not detected_restaurant_id:
        detected_resto = detect_restaurant_from_filename(file.filename, restaurants)
        if detected_resto:
            detected_restaurant_id = detected_resto["id"]
    
    if not detected_date:
        detected_date = detect_date_from_filename(file.filename)
        if not detected_date:
            detected_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Parser le fichier
    if filename.endswith('.xls'):
        ventes_data = parse_xls_file(content, file.filename)
    else:
        ventes_data = parse_xlsx_file(content, file.filename)
    
    # Analyser les données
    ca_total = sum(v["ca_ttc"] for v in ventes_data)
    total_quantite = sum(v["quantite"] for v in ventes_data)
    total_remise = sum(v["remise"] for v in ventes_data)
    
    # Compter les remises négatives corrigées (bug PSW)
    nb_remises_negatives = sum(1 for v in ventes_data if v.get("remise_negative_corrigee", False))
    
    # Compter nourriture vs boisson
    nb_food = sum(1 for v in ventes_data if v["is_food"])
    nb_drink = sum(1 for v in ventes_data if not v["is_food"])
    
    # Ajouter un index à chaque ligne pour l'exclusion
    lignes = []
    for idx, v in enumerate(ventes_data):
        lignes.append({
            "idx": idx,
            "produit_nom": v["produit_nom"],
            "quantite": v["quantite"],
            "prix_unitaire": v["prix_unitaire"],
            "ca_ttc": v["ca_ttc"],
            "ca_ht": v.get("ca_ht", 0),  # NOUVEAU
            "remise": v["remise"],
            "is_food": v["is_food"],
            "famille": v.get("famille", ""),  # NOUVEAU
            "code_pro": v.get("code_pro", ""),  # NOUVEAU
            "is_remise_negative": v.get("remise_negative_corrigee", False),
            "exclu": False
        })
    
    # Restaurant info
    restaurant_info = None
    if detected_restaurant_id:
        resto = next((r for r in restaurants if r["id"] == detected_restaurant_id), None)
        if resto:
            restaurant_info = {"id": resto["id"], "nom": resto["nom"], "couleur": resto["couleur"]}
    
    return {
        "filename": file.filename,
        "detected_restaurant_id": detected_restaurant_id,
        "detected_date": detected_date,
        "restaurant": restaurant_info,
        "nb_lignes": len(ventes_data),
        "ca_total": round(ca_total, 2),
        "total_quantite": total_quantite,
        "total_remise": round(total_remise, 2),
        "nb_remises_negatives": nb_remises_negatives,
        "nb_food": nb_food,
        "nb_drink": nb_drink,
        "lignes": lignes
    }

@api_router.post("/imports/confirm")
async def confirm_import(data: dict):
    """Confirme l'import après prévisualisation avec les lignes exclues"""
    
    restaurant_id = data.get("restaurant_id")
    date_vente = data.get("date_vente")
    lignes = data.get("lignes", [])
    filename = data.get("filename", "import.xls")
    
    if not restaurant_id:
        raise HTTPException(status_code=400, detail="Restaurant requis")
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant non trouvé")
    
    # Filtrer les lignes non exclues
    lignes_actives = [l for l in lignes if not l.get("exclu", False)]
    
    if not lignes_actives:
        raise HTTPException(status_code=400, detail="Aucune ligne à importer (toutes exclues)")
    
    # Créer l'import
    import_id = str(uuid.uuid4())
    import_record = {
        "id": import_id,
        "type": "ventes",
        "restaurant_id": restaurant_id,
        "nom_fichier": filename,
        "date_import": datetime.now(timezone.utc).isoformat(),
        "statut": "importé",
        "nb_lignes": len(lignes_actives),
        "nb_exclues": len(lignes) - len(lignes_actives),
        "erreurs": []
    }
    await db.imports.insert_one(import_record)
    
    # Créer les ventes
    ventes_docs = []
    for l in lignes_actives:
        vente = {
            "id": str(uuid.uuid4()),
            "restaurant_id": restaurant_id,
            "date_vente": date_vente,
            "produit_nom": l["produit_nom"],
            "produit_carte_id": None,
            "quantite": l["quantite"],
            "prix_unitaire": l["prix_unitaire"],
            "ca_ttc": l["ca_ttc"],
            "ca_ht": l.get("ca_ht", 0),  # NOUVEAU
            "remise": l["remise"],
            "is_food": l["is_food"],
            "famille": l.get("famille", ""),  # NOUVEAU
            "code_pro": l.get("code_pro", ""),  # NOUVEAU
            "import_id": import_id,
            "exclu": False,
            "annotation": l.get("annotation", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        ventes_docs.append(vente)
    
    if ventes_docs:
        await db.ventes.insert_many(ventes_docs)
    
    ca_total = sum(v["ca_ttc"] for v in ventes_docs)
    
    return {
        "success": True,
        "import_id": import_id,
        "restaurant": restaurant["nom"],
        "date_vente": date_vente,
        "nb_lignes": len(ventes_docs),
        "nb_exclues": len(lignes) - len(lignes_actives),
        "ca_total": round(ca_total, 2),
        "message": f"{len(ventes_docs)} ventes importées pour {restaurant['nom']}"
    }

@api_router.post("/imports/upload")
async def upload_and_import_file(
    file: UploadFile = File(...),
    restaurant_id: str = Form(None),
    date_vente: str = Form(None)
):
    """Upload et parse un fichier de ventes (XLS ou XLSX)"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    filename = file.filename.lower()
    if not filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .xls ou .xlsx")
    
    # Lire le contenu du fichier
    content = await file.read()
    
    # Récupérer les restaurants pour la détection
    restaurants = await db.restaurants.find({}, {"_id": 0}).to_list(100)
    
    # Détecter le restaurant si non fourni
    if not restaurant_id:
        detected_resto = detect_restaurant_from_filename(file.filename, restaurants)
        if detected_resto:
            restaurant_id = detected_resto["id"]
        else:
            raise HTTPException(status_code=400, detail="Restaurant non détecté. Veuillez le sélectionner manuellement.")
    
    # Vérifier que le restaurant existe
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant non trouvé")
    
    # Détecter la date si non fournie
    if not date_vente:
        date_vente = detect_date_from_filename(file.filename)
        if not date_vente:
            date_vente = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Parser le fichier selon le format
    if filename.endswith('.xls'):
        ventes_data = parse_xls_file(content, file.filename)
    else:
        ventes_data = parse_xlsx_file(content, file.filename)
    
    logging.info(f"🔍 Ventes parsées: {len(ventes_data)} lignes")
    if ventes_data:
        logging.info(f"🔍 Première vente parsée: {ventes_data[0]}")
    
    if not ventes_data:
        raise HTTPException(status_code=400, detail="Aucune donnée de vente trouvée dans le fichier")
    
    # Créer l'enregistrement d'import
    import_id = str(uuid.uuid4())
    import_record = {
        "id": import_id,
        "type": "ventes",
        "restaurant_id": restaurant_id,
        "nom_fichier": file.filename,
        "date_import": datetime.now(timezone.utc).isoformat(),
        "statut": "importé",
        "nb_lignes": len(ventes_data),
        "erreurs": []
    }
    await db.imports.insert_one(import_record)
    
    # Créer les ventes
    ventes_docs = []
    for v in ventes_data:
        vente = {
            "id": str(uuid.uuid4()),
            "restaurant_id": restaurant_id,
            "date_vente": date_vente,
            "produit_nom": v["produit_nom"],
            "produit_carte_id": None,
            "quantite": v["quantite"],
            "prix_unitaire": v["prix_unitaire"],
            "ca_ttc": v["ca_ttc"],
            "ca_ht": v.get("ca_ht", 0),  # NOUVEAU
            "remise": v["remise"],
            "is_food": v["is_food"],
            "famille": v.get("famille", ""),  # NOUVEAU
            "code_pro": v.get("code_pro", ""),  # NOUVEAU
            "import_id": import_id,
            "exclu": False,
            "annotation": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        ventes_docs.append(vente)
    
    logging.info(f"🔍 Ventes à insérer: {len(ventes_docs)}")
    if ventes_docs:
        logging.info(f"🔍 Première vente à insérer: famille='{ventes_docs[0].get('famille')}', code_pro='{ventes_docs[0].get('code_pro')}', ca_ht={ventes_docs[0].get('ca_ht')}")
    
    if ventes_docs:
        result = await db.ventes.insert_many(ventes_docs)
        logging.info(f"✅ {len(result.inserted_ids)} ventes insérées en DB")
    
    # Calculer les stats
    ca_total = sum(v["ca_ttc"] for v in ventes_docs)
    
    return {
        "success": True,
        "import_id": import_id,
        "restaurant": restaurant["nom"],
        "date_vente": date_vente,
        "nb_lignes": len(ventes_docs),
        "ca_total": round(ca_total, 2),
        "message": f"{len(ventes_docs)} ventes importées pour {restaurant['nom']} du {date_vente}"
    }

@api_router.get("/imports/{import_id}/ventes")
async def get_import_ventes(import_id: str):
    """Récupérer les ventes d'un import spécifique"""
    ventes = await db.ventes.find({"import_id": import_id}, {"_id": 0}).to_list(10000)
    return ventes

@api_router.delete("/imports/{import_id}")
async def delete_import(import_id: str):
    """Supprimer un import et ses ventes associées"""
    # Supprimer les ventes
    ventes_result = await db.ventes.delete_many({"import_id": import_id})
    # Supprimer l'import
    import_result = await db.imports.delete_one({"id": import_id})
    
    if import_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Import non trouvé")
    
    return {
        "message": "Import supprimé",
        "ventes_supprimees": ventes_result.deleted_count
    }


# ====================== IMPORT CARTES ======================

@api_router.post("/imports/carte/preview")
async def preview_carte_import(file: UploadFile = File(...)):
    """Preview d'un fichier de carte avant import"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    filename = file.filename.lower()
    if not filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .xlsx")
    
    content = await file.read()
    
    try:
        data = parse_carte_xlsx(content, file.filename)
        
        return {
            "success": True,
            "filename": file.filename,
            "nb_restaurants": len(data["restaurants"]),
            "nb_produits": len(data["produits"]),
            "restaurants": data["restaurants"],
            "produits": data["produits"]  # Tous les produits
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/imports/carte/confirm")
async def confirm_carte_import(data: dict):
    """Confirme l'import de carte après prévisualisation"""
    
    restaurants_data = data.get("restaurants", [])
    produits_data = data.get("produits", [])
    
    if not restaurants_data or not produits_data:
        raise HTTPException(status_code=400, detail="Données manquantes")
    
    # Créer ou récupérer les restaurants
    restaurant_mapping = {}  # nom -> id
    
    for resto_data in restaurants_data:
        # Vérifier si le restaurant existe déjà
        existing = await db.restaurants.find_one({"nom": resto_data["nom"]})
        
        if existing:
            restaurant_mapping[resto_data["nom"]] = existing["id"]
        else:
            # Créer le restaurant
            resto_doc = {
                "id": str(uuid.uuid4()),
                "nom": resto_data["nom"],
                "code": resto_data["code"],
                "type": resto_data["type"],
                "couleur": resto_data["couleur"],
                "jours_fermeture": resto_data["jours_fermeture"],
                "actif": resto_data["actif"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.restaurants.insert_one(resto_doc)
            restaurant_mapping[resto_data["nom"]] = resto_doc["id"]
    
    # Créer les produits
    produits_crees = 0
    for produit_data in produits_data:
        restaurant_id = restaurant_mapping.get(produit_data["restaurant_nom"])
        
        if not restaurant_id:
            continue
        
        # Vérifier si le produit existe déjà (même nom + même restaurant)
        existing_produit = await db.produits.find_one({
            "nom": produit_data["nom"],
            "restaurant_id": restaurant_id
        })
        
        if existing_produit:
            # Mettre à jour le produit existant
            await db.produits.update_one(
                {"id": existing_produit["id"]},
                {"$set": {
                    "categorie": produit_data["categorie"],
                    "prix_vente": produit_data["prix_vente"],
                    "is_food": produit_data["is_food"],
                    "description": produit_data["description"],
                    "actif": produit_data["actif"]
                }}
            )
        else:
            # Créer le produit
            produit_doc = {
                "id": str(uuid.uuid4()),
                "nom": produit_data["nom"],
                "restaurant_id": restaurant_id,
                "categorie": produit_data["categorie"],
                "prix_vente": produit_data["prix_vente"],
                "is_food": produit_data["is_food"],
                "description": produit_data["description"],
                "touches_psw": "",
                "fiche_technique_id": None,
                "actif": produit_data["actif"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.produits.insert_one(produit_doc)
            produits_crees += 1
    
    return {
        "success": True,
        "restaurants_crees": len([r for r in restaurants_data if r["nom"] not in restaurant_mapping]),
        "produits_crees": produits_crees,
        "message": f"{produits_crees} produits importés pour {len(restaurant_mapping)} restaurants"
    }

# ====================== IMPORT ACHATS ======================

@api_router.post("/imports/achats/preview")
async def preview_achats_import(file: UploadFile = File(...)):
    """Preview d'un fichier d'achats Odoo avant import"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    filename = file.filename.lower()
    if not filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .xlsx")
    
    content = await file.read()
    
    try:
        achats = parse_achats_xlsx(content, file.filename)
        
        return {
            "success": True,
            "filename": file.filename,
            "nb_achats": len(achats),
            "achats": achats  # Tous les achats
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/imports/achats/confirm")
async def confirm_achats_import(data: dict):
    """Confirme l'import d'achats après prévisualisation"""
    
    achats_data = data.get("achats", [])
    restaurant_id = data.get("restaurant_id")
    
    if not achats_data:
        raise HTTPException(status_code=400, detail="Aucune donnée d'achat")
    
    if not restaurant_id:
        raise HTTPException(status_code=400, detail="Restaurant requis")
    
    # Vérifier que le restaurant existe
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant non trouvé")
    
    # Créer l'enregistrement d'import
    import_id = str(uuid.uuid4())
    import_record = {
        "id": import_id,
        "type": "achats",
        "restaurant_id": restaurant_id,
        "nom_fichier": data.get("filename", "achats.xlsx"),
        "date_import": datetime.now(timezone.utc).isoformat(),
        "statut": "importé",
        "nb_lignes": len(achats_data),
        "erreurs": []
    }
    await db.imports.insert_one(import_record)
    
    # Créer les achats dans la collection "achats"
    achats_docs = []
    for achat in achats_data:
        achat_doc = {
            "id": str(uuid.uuid4()),
            "import_id": import_id,
            "restaurant_id": restaurant_id,
            "reference_commande": achat["reference_commande"],
            "fournisseur": achat["fournisseur"],
            "produit": achat["produit"],
            "prix_unitaire": achat["prix_unitaire"],
            "quantite": achat["quantite"],
            "unite": achat["unite"],
            "total": achat["total"],
            "date_achat": achat["date_achat"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        achats_docs.append(achat_doc)
    
    if achats_docs:
        await db.achats.insert_many(achats_docs)
    
    return {
        "success": True,
        "import_id": import_id,
        "restaurant": restaurant["nom"],
        "nb_achats": len(achats_docs),
        "message": f"{len(achats_docs)} achats importés pour {restaurant['nom']}"
    }


# ====================== IMPORT BUDGETS ======================

@api_router.post("/imports/budget/preview")
async def preview_budget_import(file: UploadFile = File(...), mois: str = Form(...)):
    """Preview d'un fichier budget avant import"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    filename = file.filename.lower()
    if not filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .xlsx")
    
    if not mois:
        raise HTTPException(status_code=400, detail="Mois requis (format: YYYY-MM)")
    
    content = await file.read()
    
    try:
        budgets_data = parse_budget_xlsx(content, file.filename, mois)
        
        nb_restaurants = len(set(b["restaurant_nom"] for b in budgets_data))
        total_budget = sum(b["ca_budget"] for b in budgets_data)
        total_reel = sum(b.get("ca_reel", 0) for b in budgets_data)
        
        return {
            "success": True,
            "filename": file.filename,
            "mois": mois,
            "nb_restaurants": nb_restaurants,
            "nb_lignes": len(budgets_data),
            "total_budget": round(total_budget, 2),
            "total_reel": round(total_reel, 2),
            "budgets": budgets_data
        }
    except Exception as e:
        logger.error(f"Erreur preview budget: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/imports/budget/confirm")
async def confirm_budget_import(data: dict):
    """Confirme l'import de budget après prévisualisation"""
    
    budgets_data = data.get("budgets", [])
    mois = data.get("mois")
    
    if not budgets_data or not mois:
        raise HTTPException(status_code=400, detail="Données manquantes")
    
    # Supprimer les anciens budgets du même mois
    await db.budgets.delete_many({"mois": mois})
    
    # Créer l'enregistrement d'import
    import_id = str(uuid.uuid4())
    import_record = {
        "id": import_id,
        "type": "budget",
        "mois": mois,
        "nom_fichier": data.get("filename", "budget.xlsx"),
        "date_import": datetime.now(timezone.utc).isoformat(),
        "statut": "importé",
        "nb_lignes": len(budgets_data)
    }
    await db.imports.insert_one(import_record)
    
    # Créer les budgets
    budgets_docs = []
    for b in budgets_data:
        resto = await db.restaurants.find_one({"nom": b["restaurant_nom"]})
        restaurant_id = resto["id"] if resto else None
        
        budget_doc = {
            "id": str(uuid.uuid4()),
            "import_id": import_id,
            "mois": mois,
            "restaurant_nom": b["restaurant_nom"],
            "restaurant_id": restaurant_id,
            "date": b["date"],
            "jour": b["jour"],
            "ca_budget": b["ca_budget"],
            "ca_reel": b.get("ca_reel", 0),
            "ecart": b.get("ecart", 0),
            "ecart_pct": b.get("ecart_pct", 0),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        budgets_docs.append(budget_doc)
    
    if budgets_docs:
        await db.budgets.insert_many(budgets_docs)
    
    return {
        "success": True,
        "nb_budgets_crees": len(budgets_docs),
        "mois": mois
    }

@api_router.get("/budgets")
async def get_budgets(mois: str = None, restaurant_id: str = None):
    """Récupérer les budgets avec filtres optionnels"""
    query = {}
    if mois:
        query["mois"] = mois
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    
    budgets = await db.budgets.find(query, {"_id": 0}).to_list(1000)
    return budgets

def parse_budget_xlsx(file_content: bytes, filename: str, mois: str) -> List[dict]:
    """Parse un fichier budget Excel et extrait les données par restaurant et par jour"""
    budgets = []
    
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        
        # Ignorer la feuille de synthèse, parcourir les feuilles de détails
        for sheet_name in wb.sheetnames:
            if "Budget CA -" not in sheet_name or "Synthèse" in sheet_name:
                continue
            
            sheet = wb[sheet_name]
            
            # Extraire le nom du restaurant du nom de la feuille
            parts = sheet_name.split(" - ")
            restaurant_nom = parts[1].strip() if len(parts) > 1 else sheet_name
            
            # Trouver la ligne d'en-tête (Jour, Date, CA Budget...)
            header_row = None
            for i, row in enumerate(sheet.iter_rows(min_row=1, max_row=10, values_only=True), start=1):
                if row and "Jour" in str(row):
                    header_row = i
                    break
            
            if not header_row:
                continue
            
            # Lire les données
            for row in sheet.iter_rows(min_row=header_row + 1, values_only=True):
                if not row or not row[0]:
                    continue
                
                jour = str(row[0]).strip()
                
                # Ignorer les lignes TOTAL
                if jour.upper() == "TOTAL":
                    break
                
                try:
                    date_val = row[1]
                    if isinstance(date_val, datetime):
                        date_str = date_val.strftime("%Y-%m-%d")
                    else:
                        # Parser format DD/MM/YYYY
                        date_parts = str(date_val).split("/")
                        if len(date_parts) == 3:
                            date_str = f"{date_parts[2]}-{date_parts[1].zfill(2)}-{date_parts[0].zfill(2)}"
                        else:
                            continue
                    
                    ca_budget = float(row[2]) if row[2] else 0
                    ca_reel = float(row[3]) if len(row) > 3 and row[3] else 0
                    ecart = float(row[4]) if len(row) > 4 and row[4] else 0
                    ecart_pct = float(row[5]) if len(row) > 5 and row[5] else 0
                    
                    budgets.append({
                        "restaurant_nom": restaurant_nom,
                        "jour": jour,
                        "date": date_str,
                        "ca_budget": ca_budget,
                        "ca_reel": ca_reel,
                        "ecart": ecart,
                        "ecart_pct": ecart_pct
                    })
                
                except (ValueError, IndexError, AttributeError) as e:
                    logging.warning(f"Erreur parsing ligne budget: {e}")
                    continue
        
        return budgets
        
    except Exception as e:
        logging.error(f"Erreur parse_budget_xlsx: {e}")
        raise


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

@api_router.get("/dashboard/restaurant/{restaurant_id}")
async def get_restaurant_dashboard(restaurant_id: str, date: Optional[str] = None):
    """Dashboard complet pour un restaurant sélectionné"""
    
    # Vérifier que le restaurant existe
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant non trouvé")
    
    # Dates disponibles pour ce restaurant
    dates_pipeline = [
        {"$match": {"restaurant_id": restaurant_id}},
        {"$group": {"_id": "$date_vente"}},
        {"$sort": {"_id": -1}},
        {"$limit": 60}
    ]
    dates_result = await db.ventes.aggregate(dates_pipeline).to_list(60)
    dates_disponibles = [d["_id"] for d in dates_result]
    
    # Date du jour = première date disponible si pas de date fournie
    date_jour = date if date else (dates_disponibles[0] if dates_disponibles else None)
    
    # Calculer le mois à partir de la date du jour
    if date_jour:
        # Format: YYYY-MM
        mois_courant = date_jour[:7]
    else:
        mois_courant = None
    
    # Query pour le jour
    query_jour = {"restaurant_id": restaurant_id}
    if date_jour:
        query_jour["date_vente"] = date_jour
    
    # Query pour le mois (toutes les dates du mois)
    query_mois = {"restaurant_id": restaurant_id}
    if mois_courant:
        query_mois["date_vente"] = {"$regex": f"^{mois_courant}"}
    
    # Stats globales du restaurant (selon la date sélectionnée ou tout)
    ventes_query = {"restaurant_id": restaurant_id}
    if date:
        ventes_query["date_vente"] = date
    
    pipeline_global = [
        {"$match": ventes_query},
        {"$group": {
            "_id": None,
            "ca_total": {"$sum": "$ca_ttc"},
            "ca_food": {"$sum": {"$cond": [{"$eq": ["$is_food", True]}, "$ca_ttc", 0]}},
            "ca_drink": {"$sum": {"$cond": [{"$eq": ["$is_food", False]}, "$ca_ttc", 0]}},
            "total_remise": {"$sum": "$remise"},
            "total_quantite": {"$sum": "$quantite"},
            "nb_lignes": {"$sum": 1}
        }}
    ]
    stats_result = await db.ventes.aggregate(pipeline_global).to_list(1)
    stats = stats_result[0] if stats_result else {
        "ca_total": 0, "ca_food": 0, "ca_drink": 0, 
        "total_remise": 0, "total_quantite": 0, "nb_lignes": 0
    }
    
    # ===== TOP 10 DU JOUR =====
    # Nourriture du jour
    top_jour_food = await db.ventes.aggregate([
        {"$match": {**query_jour, "is_food": True}},
        {"$group": {
            "_id": "$produit_nom",
            "quantite": {"$sum": "$quantite"},
            "ca": {"$sum": "$ca_ttc"}
        }},
        {"$sort": {"quantite": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # Boissons du jour
    top_jour_drink = await db.ventes.aggregate([
        {"$match": {**query_jour, "is_food": False}},
        {"$group": {
            "_id": "$produit_nom",
            "quantite": {"$sum": "$quantite"},
            "ca": {"$sum": "$ca_ttc"}
        }},
        {"$sort": {"quantite": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # ===== TOP 10 DU MOIS =====
    # Nourriture du mois
    top_mois_food = await db.ventes.aggregate([
        {"$match": {**query_mois, "is_food": True}},
        {"$group": {
            "_id": "$produit_nom",
            "quantite": {"$sum": "$quantite"},
            "ca": {"$sum": "$ca_ttc"}
        }},
        {"$sort": {"quantite": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # Boissons du mois
    top_mois_drink = await db.ventes.aggregate([
        {"$match": {**query_mois, "is_food": False}},
        {"$group": {
            "_id": "$produit_nom",
            "quantite": {"$sum": "$quantite"},
            "ca": {"$sum": "$ca_ttc"}
        }},
        {"$sort": {"quantite": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # Répartition par catégorie
    by_category = await db.ventes.aggregate([
        {"$match": ventes_query},
        {"$group": {
            "_id": "$is_food",
            "ca": {"$sum": "$ca_ttc"},
            "quantite": {"$sum": "$quantite"},
            "remise": {"$sum": "$remise"}
        }}
    ]).to_list(10)
    
    # Food cost moyen des fiches de ce restaurant
    fiches_stats = await db.fiches_techniques.aggregate([
        {"$match": {"restaurant_id": restaurant_id, "statut": "fait"}},
        {"$group": {
            "_id": None,
            "avg_food_cost": {"$avg": "$food_cost_pct"},
            "total_cout": {"$sum": "$cout_total"}
        }}
    ]).to_list(1)
    
    food_cost_data = fiches_stats[0] if fiches_stats else {"avg_food_cost": 0, "total_cout": 0}
    
    return {
        "restaurant": restaurant,
        "date_selectionnee": date_jour,
        "mois_courant": mois_courant,
        "dates_disponibles": dates_disponibles,
        "kpis": {
            "ca_total": round(stats.get("ca_total", 0), 0),
            "ca_food": round(stats.get("ca_food", 0), 0),
            "ca_drink": round(stats.get("ca_drink", 0), 0),
            "total_remise": round(stats.get("total_remise", 0), 0),
            "total_quantite": stats.get("total_quantite", 0),
            "nb_lignes": stats.get("nb_lignes", 0),
            "avg_food_cost": round(food_cost_data.get("avg_food_cost", 0) or 0, 1)
        },
        "top_jour": {
            "food": [{"nom": t["_id"], "quantite": t["quantite"], "ca": round(t["ca"], 0)} for t in top_jour_food],
            "drink": [{"nom": t["_id"], "quantite": t["quantite"], "ca": round(t["ca"], 0)} for t in top_jour_drink]
        },
        "top_mois": {
            "food": [{"nom": t["_id"], "quantite": t["quantite"], "ca": round(t["ca"], 0)} for t in top_mois_food],
            "drink": [{"nom": t["_id"], "quantite": t["quantite"], "ca": round(t["ca"], 0)} for t in top_mois_drink]
        },
        "repartition": {
            "food": next((c for c in by_category if c["_id"] == True), {"ca": 0, "quantite": 0, "remise": 0}),
            "drink": next((c for c in by_category if c["_id"] == False), {"ca": 0, "quantite": 0, "remise": 0})
        }
    }

# ====================== CATEGORIES ======================


# ====================== COÛT THÉORIQUE ======================

@api_router.get("/dashboard/restaurant/{restaurant_id}/cout-theorique")
async def get_cout_theorique(restaurant_id: str, date: Optional[str] = None):
    """Calcule le coût théorique basé sur les fiches techniques"""
    
    # Vérifier que le restaurant existe
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant non trouvé")
    
    # Query pour les ventes
    ventes_query = {"restaurant_id": restaurant_id}
    if date:
        ventes_query["date_vente"] = date
    
    # Récupérer toutes les ventes
    ventes = await db.ventes.find(ventes_query, {"_id": 0}).to_list(10000)
    
    # Récupérer tous les produits du restaurant avec leurs fiches techniques
    produits = await db.produits.find({"restaurant_id": restaurant_id}, {"_id": 0}).to_list(10000)
    produits_map = {p["nom"]: p for p in produits}
    
    # Récupérer toutes les fiches techniques du restaurant
    fiches = await db.fiches_techniques.find({"restaurant_id": restaurant_id}, {"_id": 0}).to_list(10000)
    fiches_map = {f["id"]: f for f in fiches}
    
    # Calculer CA et coût par type
    ca_food_total = 0
    ca_drink_total = 0
    cout_food_total = 0
    cout_drink_total = 0
    
    ventes_avec_cout = []
    ventes_sans_fiche = []
    
    for vente in ventes:
        ca = vente.get("ca_ttc", 0)
        quantite = vente.get("quantite", 1)
        is_food = vente.get("is_food", True)
        nom_produit = vente.get("produit_nom", "")
        
        # Ajouter au CA
        if is_food:
            ca_food_total += ca
        else:
            ca_drink_total += ca
        
        # Chercher le produit correspondant
        produit = produits_map.get(nom_produit)
        
        if produit and produit.get("fiche_technique_id"):
            # Le produit a une fiche technique
            fiche = fiches_map.get(produit["fiche_technique_id"])
            
            if fiche:
                # Calculer le coût théorique basé sur les ingrédients
                cout_unitaire = 0
                
                for ingredient in fiche.get("ingredients", []):
                    ingredient_produit_id = ingredient.get("produit_id")
                    quantite_ingredient = ingredient.get("quantite", 0)
                    
                    # Chercher le produit ingrédient pour avoir son prix
                    ingredient_produit = next((p for p in produits if p["id"] == ingredient_produit_id), None)
                    
                    if ingredient_produit:
                        # Prix d'achat de l'ingrédient (on utilise prix_vente en attendant import achats)
                        prix_ingredient = ingredient_produit.get("prix_vente", 0)
                        cout_unitaire += prix_ingredient * quantite_ingredient
                
                cout_total_ligne = cout_unitaire * quantite
                
                if is_food:
                    cout_food_total += cout_total_ligne
                else:
                    cout_drink_total += cout_total_ligne
                
                ventes_avec_cout.append({
                    "produit": nom_produit,
                    "ca": ca,
                    "cout": cout_total_ligne,
                    "quantite": quantite,
                    "is_food": is_food
                })
            else:
                ventes_sans_fiche.append(nom_produit)
        else:
            ventes_sans_fiche.append(nom_produit)
    
    # Calculer les ratios
    ca_total = ca_food_total + ca_drink_total
    cout_total = cout_food_total + cout_drink_total
    
    food_cost_pct = (cout_food_total / ca_food_total * 100) if ca_food_total > 0 else 0
    beverage_cost_pct = (cout_drink_total / ca_drink_total * 100) if ca_drink_total > 0 else 0
    cout_global_pct = (cout_total / ca_total * 100) if ca_total > 0 else 0
    
    return {
        "success": True,
        "restaurant": restaurant["nom"],
        "date": date or "Toutes les dates",
        "ca_total": round(ca_total, 2),
        "ca_food": round(ca_food_total, 2),
        "ca_drink": round(ca_drink_total, 2),
        "cout_total": round(cout_total, 2),
        "cout_food": round(cout_food_total, 2),
        "cout_drink": round(cout_drink_total, 2),
        "food_cost_pct": round(food_cost_pct, 1),
        "beverage_cost_pct": round(beverage_cost_pct, 1),
        "cout_global_pct": round(cout_global_pct, 1),
        "nb_ventes_avec_cout": len(ventes_avec_cout),
        "nb_ventes_sans_fiche": len(ventes_sans_fiche),
        "couverture_pct": round(len(ventes_avec_cout) / len(ventes) * 100, 1) if ventes else 0
    }


# ====================== ACHATS ======================

@api_router.get("/achats")
async def get_achats(restaurant_id: Optional[str] = None):
    """Récupère tous les achats, optionnellement filtrés par restaurant"""
    query = {}
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    
    achats = await db.achats.find(query, {"_id": 0}).to_list(10000)
    return achats

@api_router.get("/categories")
async def get_categories():
    """Liste des catégories disponibles"""
    return {
        "produits": ["Entrées", "Plats", "Desserts", "Boissons chaudes", "Boissons froides", "Alcools", "Apéritifs", "Menus"],
        "fiches": ["Entrées", "Plats", "Desserts", "Boissons", "Préparations de base", "Sauces"],
        "unites": ["g", "kg", "L", "ml", "cl", "unité", "pièce"]
    }

@api_router.get("/restaurants/{restaurant_id}/familles")
async def get_familles_by_restaurant(restaurant_id: str):
    """Récupérer les familles uniques d'un restaurant depuis les ventes"""
    try:
        # Récupérer les familles uniques depuis les VENTES (collection principale)
        familles_ventes = await db.ventes.distinct("famille", {"restaurant_id": restaurant_id})
        
        # Récupérer aussi depuis les produits et fiches comme fallback
        familles_produits = await db.produits.distinct("famille", {"restaurant_id": restaurant_id})
        familles_fiches = await db.fiches_techniques.distinct("famille", {"restaurant_id": restaurant_id})
        
        # Combiner et dédupliquer (priorité aux ventes)
        familles = list(set([f for f in familles_ventes + familles_produits + familles_fiches if f]))
        
        # Si vide, retourner des familles par défaut
        if not familles:
            familles = ["Entrées", "Plats", "Desserts", "Boissons", "Préparations de base", "Sauces"]
        
        return sorted(familles)
        
    except Exception as e:
        logger.error(f"Erreur get_familles_by_restaurant: {e}")
        return ["Entrées", "Plats", "Desserts", "Boissons"]

# ====================== HEALTH ======================

@api_router.get("/")
async def root():
    return {"message": "Trinity API v1.0", "status": "running"}

@api_router.get("/health")
async def health():
    """Health check endpoint with MongoDB status"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "unknown"
    }
    
    try:
        # Try to ping MongoDB
        await client.admin.command('ping')
        health_status["database"] = "connected"
    except Exception as e:
        logger.warning(f"Health check: MongoDB ping failed - {e}")
        health_status["database"] = "disconnected"
        health_status["status"] = "degraded"
    
    return health_status

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    """Verify MongoDB connection on startup"""
    try:
        logger.info("Verifying MongoDB connection...")
        # Ping the database to verify connection
        await client.admin.command('ping')
        logger.info("✅ MongoDB connection successful!")
        
        # Log database info
        collections = await db.list_collection_names()
        logger.info(f"Connected to database '{db_name}' with {len(collections)} collections")
        
        # Exécuter la migration des restaurants
        await migrate_restaurants()
        
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        logger.error("Application will continue but database operations may fail")

@app.on_event("shutdown")


# ====================== PARSER BUDGET ======================

def parse_budget_xlsx(file_content: bytes, filename: str, mois: str) -> List[dict]:
    """Parse un fichier budget Excel et extrait les données par restaurant et par jour"""
    budgets = []
    
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        
        # Ignorer la feuille de synthèse, parcourir les feuilles de détails
        for sheet_name in wb.sheetnames:
            if "Budget CA -" not in sheet_name or "Synthèse" in sheet_name:
                continue
            
            sheet = wb[sheet_name]
            
            # Extraire le nom du restaurant du nom de la feuille
            # Ex: "Budget CA - Meherio - Mars 2025" -> "Meherio"
            parts = sheet_name.split(" - ")
            restaurant_nom = parts[1].strip() if len(parts) > 1 else sheet_name
            
            # Trouver la ligne d'en-tête (Jour, Date, CA Budget...)
            header_row = None
            for i, row in enumerate(sheet.iter_rows(min_row=1, max_row=10, values_only=True), start=1):
                if row and "Jour" in str(row):
                    header_row = i
                    break
            
            if not header_row:
                continue
            
            # Lire les données
            for row in sheet.iter_rows(min_row=header_row + 1, values_only=True):
                if not row or not row[0]:
                    continue
                
                jour = str(row[0]).strip()
                
                # Ignorer les lignes TOTAL
                if jour.upper() == "TOTAL":
                    break
                
                try:
                    date_val = row[1]
                    if isinstance(date_val, datetime):
                        date_str = date_val.strftime("%Y-%m-%d")
                    else:
                        # Parser format DD/MM/YYYY
                        date_parts = str(date_val).split("/")
                        if len(date_parts) == 3:
                            date_str = f"{date_parts[2]}-{date_parts[1].zfill(2)}-{date_parts[0].zfill(2)}"
                        else:
                            continue
                    
                    ca_budget = float(row[2]) if row[2] else 0
                    ca_reel = float(row[3]) if len(row) > 3 and row[3] else 0
                    ecart = float(row[4]) if len(row) > 4 and row[4] else 0
                    ecart_pct = float(row[5]) if len(row) > 5 and row[5] else 0
                    
                    budgets.append({
                        "restaurant_nom": restaurant_nom,
                        "jour": jour,
                        "date": date_str,
                        "ca_budget": ca_budget,
                        "ca_reel": ca_reel,
                        "ecart": ecart,
                        "ecart_pct": ecart_pct
                    })
                
                except (ValueError, IndexError, AttributeError) as e:
                    logging.warning(f"Erreur parsing ligne budget: {e}")
                    continue
        
        return budgets
        
    except Exception as e:
        logging.error(f"Erreur parse_budget_xlsx: {e}")
        raise


# ====================== IMPORT BUDGETS ======================

@api_router.post("/imports/budget/preview")
async def preview_budget_import(file: UploadFile = File(...), mois: str = Form(...)):
    """Preview d'un fichier budget avant import"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    filename = file.filename.lower()
    if not filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .xlsx")
    
    if not mois:
        raise HTTPException(status_code=400, detail="Mois requis (format: YYYY-MM)")
    
    content = await file.read()
    
    try:
        budgets_data = parse_budget_xlsx(content, file.filename, mois)
        
        nb_restaurants = len(set(b["restaurant_nom"] for b in budgets_data))
        total_budget = sum(b["ca_budget"] for b in budgets_data)
        total_reel = sum(b.get("ca_reel", 0) for b in budgets_data)
        
        return {
            "success": True,
            "filename": file.filename,
            "mois": mois,
            "nb_restaurants": nb_restaurants,
            "nb_lignes": len(budgets_data),
            "total_budget": round(total_budget, 2),
            "total_reel": round(total_reel, 2),
            "budgets": budgets_data
        }
    except Exception as e:
        logger.error(f"Erreur preview budget: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/imports/budget/confirm")
async def confirm_budget_import(data: dict):
    """Confirme l'import de budget après prévisualisation"""
    
    budgets_data = data.get("budgets", [])
    mois = data.get("mois")
    
    if not budgets_data or not mois:
        raise HTTPException(status_code=400, detail="Données manquantes")
    
    # Supprimer les anciens budgets du même mois
    await db.budgets.delete_many({"mois": mois})
    
    # Créer l'enregistrement d'import
    import_id = str(uuid.uuid4())
    import_record = {
        "id": import_id,
        "type": "budget",
        "mois": mois,
        "nom_fichier": data.get("filename", "budget.xlsx"),
        "date_import": datetime.now(timezone.utc).isoformat(),
        "statut": "importé",
        "nb_lignes": len(budgets_data)
    }
    await db.imports.insert_one(import_record)
    
    # Créer les budgets
    budgets_docs = []
    for b in budgets_data:
        resto = await db.restaurants.find_one({"nom": b["restaurant_nom"]})
        restaurant_id = resto["id"] if resto else None
        
        budget_doc = {
            "id": str(uuid.uuid4()),
            "import_id": import_id,
            "mois": mois,
            "restaurant_nom": b["restaurant_nom"],
            "restaurant_id": restaurant_id,
            "date": b["date"],
            "jour": b["jour"],
            "ca_budget": b["ca_budget"],
            "ca_reel": b.get("ca_reel", 0),
            "ecart": b.get("ecart", 0),
            "ecart_pct": b.get("ecart_pct", 0),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        budgets_docs.append(budget_doc)
    
    if budgets_docs:
        await db.budgets.insert_many(budgets_docs)
    
    return {
        "success": True,
        "nb_budgets_crees": len(budgets_docs),
        "mois": mois
    }

@api_router.get("/budgets")
async def get_budgets(mois: str = None, restaurant_id: str = None):
    """Récupérer les budgets avec filtres optionnels"""
    query = {}
    if mois:
        query["mois"] = mois
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    
    budgets = await db.budgets.find(query, {"_id": 0}).to_list(1000)
    return budgets

async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    logger.info("Closing MongoDB connection...")
    client.close()
    logger.info("MongoDB connection closed")
