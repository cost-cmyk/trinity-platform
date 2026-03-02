#!/usr/bin/env python3
"""Script de test isolé pour déboguer le parser de budget"""
import openpyxl
from openpyxl import Workbook
from datetime import datetime
import io
import sys

# Créer un fichier Excel de test
def create_test_budget_excel():
    """Crée un fichier Excel de test avec la structure attendue"""
    wb = Workbook()
    
    # Supprimer la feuille par défaut
    wb.remove(wb.active)
    
    # Créer une feuille pour un restaurant
    sheet = wb.create_sheet("Budget CA - Matignon")
    
    # Ajouter les en-têtes
    sheet['A1'] = "Budget CA Mensuel - Matignon"
    sheet['A2'] = "Mois: Janvier 2025"
    sheet['A4'] = "Jour"
    sheet['B4'] = "Date"
    sheet['C4'] = "CA Budget"
    sheet['D4'] = "CA Réel"
    sheet['E4'] = "Écart"
    sheet['F4'] = "Écart %"
    
    # Ajouter des données de test
    data_rows = [
        ["Lundi", "01/01/2025", 5000, 4800, -200, -4.0],
        ["Mardi", "02/01/2025", 4500, 4700, 200, 4.4],
        ["Mercredi", "03/01/2025", 4800, 5100, 300, 6.3],
        ["TOTAL", "", 14300, 14600, 300, 2.1]
    ]
    
    for i, row_data in enumerate(data_rows, start=5):
        for j, value in enumerate(row_data, start=1):
            sheet.cell(row=i, column=j, value=value)
    
    # Créer une deuxième feuille pour un autre restaurant
    sheet2 = wb.create_sheet("Budget CA - Laurent")
    sheet2['A1'] = "Budget CA Mensuel - Laurent"
    sheet2['A2'] = "Mois: Janvier 2025"
    sheet2['A4'] = "Jour"
    sheet2['B4'] = "Date"
    sheet2['C4'] = "CA Budget"
    sheet2['D4'] = "CA Réel"
    
    data_rows2 = [
        ["Lundi", "01/01/2025", 6000, 5900],
        ["Mardi", "02/01/2025", 5500, 5800],
        ["TOTAL", "", 11500, 11700]
    ]
    
    for i, row_data in enumerate(data_rows2, start=5):
        for j, value in enumerate(row_data, start=1):
            sheet2.cell(row=i, column=j, value=value)
    
    # Sauvegarder en bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


# Fonction parse_budget_xlsx copiée depuis server.py
def parse_budget_xlsx(file_content: bytes, filename: str, mois: str):
    """Parse un fichier budget Excel et extrait les données par restaurant et par jour"""
    budgets = []
    
    print(f"\n🔍 DÉBUT DU PARSING")
    print(f"   Fichier: {filename}")
    print(f"   Mois: {mois}")
    print(f"   Taille: {len(file_content)} bytes")
    
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        print(f"\n📊 Feuilles trouvées: {wb.sheetnames}")
        
        # Ignorer la feuille de synthèse, parcourir les feuilles de détails
        for sheet_name in wb.sheetnames:
            print(f"\n   📄 Analyse de: {sheet_name}")
            
            if "Budget CA -" not in sheet_name or "Synthèse" in sheet_name:
                print(f"      ❌ Ignorée (pas de 'Budget CA -' ou contient 'Synthèse')")
                continue
            
            print(f"      ✅ Feuille valide, extraction en cours...")
            sheet = wb[sheet_name]
            
            # Extraire le nom du restaurant du nom de la feuille
            parts = sheet_name.split(" - ")
            restaurant_nom = parts[1].strip() if len(parts) > 1 else sheet_name
            print(f"      🏪 Restaurant: {restaurant_nom}")
            
            # Trouver la ligne d'en-tête (Jour, Date, CA Budget...)
            header_row = None
            for i, row in enumerate(sheet.iter_rows(min_row=1, max_row=10, values_only=True), start=1):
                if row and "Jour" in str(row):
                    header_row = i
                    print(f"      📍 En-tête trouvée à la ligne {i}: {row}")
                    break
            
            if not header_row:
                print(f"      ⚠️  Pas d'en-tête trouvée, feuille ignorée")
                continue
            
            # Lire les données
            lignes_extraites = 0
            for row in sheet.iter_rows(min_row=header_row + 1, values_only=True):
                if not row or not row[0]:
                    continue
                
                jour = str(row[0]).strip()
                
                # Ignorer les lignes TOTAL
                if jour.upper() == "TOTAL":
                    print(f"      🛑 Ligne TOTAL atteinte, fin de l'extraction")
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
                            print(f"         ⚠️  Format de date invalide: {date_val}")
                            continue
                    
                    ca_budget = float(row[2]) if row[2] else 0
                    ca_reel = float(row[3]) if len(row) > 3 and row[3] else 0
                    ecart = float(row[4]) if len(row) > 4 and row[4] else 0
                    ecart_pct = float(row[5]) if len(row) > 5 and row[5] else 0
                    
                    budget_item = {
                        "restaurant_nom": restaurant_nom,
                        "jour": jour,
                        "date": date_str,
                        "ca_budget": ca_budget,
                        "ca_reel": ca_reel,
                        "ecart": ecart,
                        "ecart_pct": ecart_pct
                    }
                    budgets.append(budget_item)
                    lignes_extraites += 1
                    print(f"         ✅ Ligne {lignes_extraites}: {jour} {date_str} - Budget: {ca_budget}")
                
                except (ValueError, IndexError, AttributeError) as e:
                    print(f"         ❌ Erreur parsing ligne: {e}")
                    continue
            
            print(f"      📊 Total lignes extraites pour {restaurant_nom}: {lignes_extraites}")
        
        print(f"\n✅ PARSING TERMINÉ")
        print(f"   Total budgets extraits: {len(budgets)}")
        print(f"   Restaurants uniques: {len(set(b['restaurant_nom'] for b in budgets))}")
        
        return budgets
        
    except Exception as e:
        print(f"\n❌ ERREUR CRITIQUE: {e}")
        import traceback
        traceback.print_exc()
        raise


# TEST
if __name__ == "__main__":
    print("=" * 60)
    print("TEST DU PARSER DE BUDGET")
    print("=" * 60)
    
    # Créer un fichier Excel de test
    print("\n1️⃣  Création du fichier Excel de test...")
    test_file_content = create_test_budget_excel()
    print(f"   ✅ Fichier créé ({len(test_file_content)} bytes)")
    
    # Tester le parser
    print("\n2️⃣  Test du parser...")
    try:
        results = parse_budget_xlsx(test_file_content, "test_budget.xlsx", "2025-01")
        
        print("\n" + "=" * 60)
        print("RÉSULTATS")
        print("=" * 60)
        
        if results:
            print(f"\n✅ {len(results)} enregistrements extraits:")
            for i, budget in enumerate(results[:5], 1):  # Afficher les 5 premiers
                print(f"\n   {i}. {budget['restaurant_nom']}")
                print(f"      Date: {budget['date']} ({budget['jour']})")
                print(f"      CA Budget: {budget['ca_budget']:,.0f} €")
                print(f"      CA Réel: {budget['ca_reel']:,.0f} €")
            
            if len(results) > 5:
                print(f"\n   ... et {len(results) - 5} autres enregistrements")
        else:
            print("\n❌ Aucun enregistrement extrait!")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ Le test a échoué: {e}")
        sys.exit(1)
