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

def parse_xls_file(file_content: bytes, filename: str) -> List[dict]:
    """Parse un fichier .xls (Excel 97-2003) et extrait les ventes"""
    ventes = []
    
    try:
        workbook = xlrd.open_workbook(file_contents=file_content)
        sheet = workbook.sheet_by_index(0)
        
        # Trouver les colonnes (chercher dans les premières lignes)
        header_row = -1
        col_mapping = {}
        
        # Colonnes attendues PSW - étendu pour le format réel
        expected_cols = {
            'designation': ['désignation', 'designation', 'produit', 'article', 'libellé', 'libelle', 'nom'],
            'quantite': ['qté', 'qte', 'quantité', 'quantite', 'qty', 'nb', 'qté vendue', 'qte vendue'],
            'prix_unitaire': ['pu', 'p.u.', 'pu ttc', 'prix unitaire', 'prix unit', 'prix de vente unitaire', 'prix de vente'],
            'ca_ttc': ['ca ttc', 'ca  ttc', 'cattc', 'montant ttc', 'total ttc'],
            'ca_ht': ['ca ht', 'caht', 'montant ht'],
            'remise': ['remise', 'rem', 'réduction', 'reduction', 'rabais', 'montant total de remise'],
            'famille': ['famille', 'catégorie', 'categorie', 'type', 'groupe'],
            'fournisseur': ['fournisseur', 'type produit']  # BOISSON ou NOURRITURE
        }
        
        # Chercher l'en-tête dans les 10 premières lignes
        for row_idx in range(min(10, sheet.nrows)):
            row_values = [str(cell).lower().strip() for cell in sheet.row_values(row_idx)]
            
            # Vérifier si cette ligne contient des en-têtes
            temp_mapping = {}
            
            for col_idx, cell_value in enumerate(row_values):
                for key, aliases in expected_cols.items():
                    if any(alias in cell_value for alias in aliases):
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
            logging.info(f"Pas d'en-tête, utilisation format PSW par défaut")
        
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
                
                ventes.append({
                    'produit_nom': designation,
                    'quantite': int(quantite) if quantite else 1,
                    'prix_unitaire': prix_unitaire,
                    'ca_ttc': ca_ttc,
                    'remise': remise,
                    'is_food': is_food,
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
            'famille': ['famille', 'catégorie', 'categorie', 'type', 'groupe'],
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
                
                # Remise négative = bug PSW, on la met à 0 mais on garde la ligne
                remise_negative = remise < 0
                if remise_negative:
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
                
                ventes.append({
                    'produit_nom': designation,
                    'quantite': int(quantite) if quantite else 1,
                    'prix_unitaire': prix_unitaire,
                    'ca_ttc': ca_ttc,
                    'remise': remise,
                    'is_food': is_food,
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
            "remise": v["remise"],
            "is_food": v["is_food"],
            "is_remise_negative": v.get("remise_negative_corrigee", False),  # Remise était négative, corrigée à 0
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
            "remise": l["remise"],
            "is_food": l["is_food"],
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
            "remise": v["remise"],
            "is_food": v["is_food"],
            "import_id": import_id,
            "exclu": False,
            "annotation": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        ventes_docs.append(vente)
    
    if ventes_docs:
        await db.ventes.insert_many(ventes_docs)
    
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
