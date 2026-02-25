#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, List

class TrinityAPITester:
    def __init__(self, base_url="https://smart-company-hub-2.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_entities = {
            'restaurants': [],
            'produits': [],
            'fiches': []
        }

    def log_test(self, name: str, success: bool, details: str = "", data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            'test': name,
            'success': success,
            'details': details,
            'data': data,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if not success and data:
            print(f"    Error data: {data}")
        print()

    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return success, response_data"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, f"Unsupported method: {method}"

            if response.status_code in [200, 201]:
                try:
                    return True, response.json()
                except ValueError:
                    return True, response.text
            else:
                try:
                    error_data = response.json()
                except ValueError:
                    error_data = response.text
                return False, f"HTTP {response.status_code}: {error_data}"
                
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}"

    def test_health_endpoints(self):
        """Test basic health and API availability"""
        print("🔍 Testing Health Endpoints...")
        
        # Test API root
        success, data = self.make_request('GET', '/')
        self.log_test(
            "API Root Health Check",
            success and isinstance(data, dict) and data.get('status') == 'running',
            f"Response: {data}" if success else str(data)
        )
        
        # Test health endpoint
        success, data = self.make_request('GET', '/health')
        self.log_test(
            "Health Endpoint",
            success and isinstance(data, dict) and data.get('status') == 'healthy',
            f"Response: {data}" if success else str(data)
        )

    def test_restaurant_endpoints(self):
        """Test restaurant CRUD operations"""
        print("🏢 Testing Restaurant Endpoints...")
        
        # Test GET restaurants (empty initially)
        success, data = self.make_request('GET', '/restaurants')
        self.log_test(
            "GET /restaurants (initial)",
            success and isinstance(data, list),
            f"Found {len(data) if success else 0} restaurants",
            data if not success else None
        )
        
        # Test POST restaurant - create test restaurant
        restaurant_data = {
            "nom": "Test Restaurant",
            "code": "TEST001", 
            "type": "RESTAURANT",
            "couleur": "#f97316",
            "actif": True
        }
        
        success, data = self.make_request('POST', '/restaurants', restaurant_data)
        if success and isinstance(data, dict) and data.get('id'):
            self.created_entities['restaurants'].append(data['id'])
            self.log_test(
                "POST /restaurants (create)",
                True,
                f"Created restaurant with ID: {data['id']}"
            )
            
            # Test GET specific restaurant
            restaurant_id = data['id']
            success, get_data = self.make_request('GET', f'/restaurants/{restaurant_id}')
            self.log_test(
                "GET /restaurants/{id}",
                success and get_data.get('id') == restaurant_id,
                f"Retrieved restaurant: {get_data.get('nom') if success else 'Failed'}",
                get_data if not success else None
            )
            
            # Test PUT restaurant - update
            update_data = restaurant_data.copy()
            update_data['nom'] = "Updated Test Restaurant"
            success, put_data = self.make_request('PUT', f'/restaurants/{restaurant_id}', update_data)
            self.log_test(
                "PUT /restaurants/{id} (update)",
                success and put_data.get('nom') == "Updated Test Restaurant",
                f"Updated restaurant name to: {put_data.get('nom') if success else 'Failed'}",
                put_data if not success else None
            )
            
        else:
            self.log_test(
                "POST /restaurants (create)",
                False,
                "Failed to create restaurant",
                data
            )

    def test_produits_endpoints(self):
        """Test produits CRUD operations"""
        print("🍽️ Testing Produits Endpoints...")
        
        if not self.created_entities['restaurants']:
            self.log_test(
                "Produits Test Prerequisite",
                False,
                "No restaurants available for produit creation"
            )
            return
        
        restaurant_id = self.created_entities['restaurants'][0]
        
        # Test GET produits (empty initially)
        success, data = self.make_request('GET', '/produits')
        self.log_test(
            "GET /produits (initial)",
            success and isinstance(data, list),
            f"Found {len(data) if success else 0} produits",
            data if not success else None
        )
        
        # Test POST produit - create test product
        produit_data = {
            "nom": "Test Burger",
            "restaurant_id": restaurant_id,
            "categorie": "Plats",
            "prix_vente": 12.50,
            "is_food": True,
            "description": "Test product description",
            "touches_psw": "B1"
        }
        
        success, data = self.make_request('POST', '/produits', produit_data)
        if success and isinstance(data, dict) and data.get('id'):
            self.created_entities['produits'].append(data['id'])
            self.log_test(
                "POST /produits (create)",
                True,
                f"Created produit with ID: {data['id']}, price: {data.get('prix_vente')}€"
            )
            
            # Test GET specific produit
            produit_id = data['id']
            success, get_data = self.make_request('GET', f'/produits/{produit_id}')
            self.log_test(
                "GET /produits/{id}",
                success and get_data.get('id') == produit_id,
                f"Retrieved produit: {get_data.get('nom') if success else 'Failed'}",
                get_data if not success else None
            )
            
            # Test GET produits with filters
            success, filtered_data = self.make_request('GET', '/produits', params={'restaurant_id': restaurant_id})
            self.log_test(
                "GET /produits?restaurant_id=X",
                success and isinstance(filtered_data, list) and len(filtered_data) > 0,
                f"Found {len(filtered_data) if success else 0} produits for restaurant",
                filtered_data if not success else None
            )
            
        else:
            self.log_test(
                "POST /produits (create)",
                False,
                "Failed to create produit",
                data
            )

    def test_fiches_endpoints(self):
        """Test fiches techniques CRUD operations"""
        print("📋 Testing Fiches Techniques Endpoints...")
        
        if not self.created_entities['restaurants']:
            self.log_test(
                "Fiches Test Prerequisite",
                False,
                "No restaurants available for fiche creation"
            )
            return
        
        restaurant_id = self.created_entities['restaurants'][0]
        
        # Test GET fiches (empty initially)
        success, data = self.make_request('GET', '/fiches')
        self.log_test(
            "GET /fiches (initial)",
            success and isinstance(data, list),
            f"Found {len(data) if success else 0} fiches",
            data if not success else None
        )
        
        # Test POST fiche - create test fiche technique
        fiche_data = {
            "nom": "Test Burger Recipe",
            "restaurant_id": restaurant_id,
            "type_fiche": "standard",
            "famille": "Plats",
            "nb_portions": 1,
            "prix_vente": 12.50,
            "statut": "brouillon",
            "ingredients": [
                {
                    "nom": "Pain burger",
                    "quantite": 1.0,
                    "unite": "unité", 
                    "prix_unitaire": 0.80
                },
                {
                    "nom": "Steak haché",
                    "quantite": 150.0,
                    "unite": "g",
                    "prix_unitaire": 0.012
                },
                {
                    "nom": "Fromage", 
                    "quantite": 30.0,
                    "unite": "g",
                    "prix_unitaire": 0.015
                }
            ]
        }
        
        success, data = self.make_request('POST', '/fiches', fiche_data)
        if success and isinstance(data, dict) and data.get('id'):
            self.created_entities['fiches'].append(data['id'])
            
            # Check food cost calculation
            expected_cost = (1 * 0.80) + (150 * 0.012) + (30 * 0.015)  # 0.80 + 1.80 + 0.45 = 3.05
            expected_food_cost_pct = (expected_cost / 12.50) * 100  # ~24.4%
            
            calculated_cost = data.get('cout_total', 0)
            calculated_food_cost = data.get('food_cost_pct', 0)
            
            cost_calculation_ok = abs(calculated_cost - expected_cost) < 0.01
            food_cost_calculation_ok = abs(calculated_food_cost - expected_food_cost_pct) < 1.0
            
            self.log_test(
                "POST /fiches (create with cost calculation)",
                True,
                f"Created fiche with ID: {data['id']}, cost: {calculated_cost}€, food cost: {calculated_food_cost}%"
            )
            
            self.log_test(
                "Food Cost Calculation Accuracy",
                cost_calculation_ok and food_cost_calculation_ok,
                f"Expected cost: {expected_cost:.2f}€, got: {calculated_cost:.2f}€. Expected FC: {expected_food_cost_pct:.1f}%, got: {calculated_food_cost:.1f}%"
            )
            
            # Test GET specific fiche
            fiche_id = data['id']
            success, get_data = self.make_request('GET', f'/fiches/{fiche_id}')
            self.log_test(
                "GET /fiches/{id}",
                success and get_data.get('id') == fiche_id,
                f"Retrieved fiche: {get_data.get('nom') if success else 'Failed'}",
                get_data if not success else None
            )
            
        else:
            self.log_test(
                "POST /fiches (create)",
                False,
                "Failed to create fiche technique",
                data
            )

    def test_dashboard_endpoints(self):
        """Test dashboard statistics endpoints"""
        print("📊 Testing Dashboard Endpoints...")
        
        # Test general dashboard stats
        success, data = self.make_request('GET', '/dashboard/stats')
        if success and isinstance(data, dict):
            required_fields = ['restaurants_count', 'produits_count', 'fiches_count', 'ca_total']
            has_required_fields = all(field in data for field in required_fields)
            
            self.log_test(
                "GET /dashboard/stats",
                has_required_fields,
                f"Stats: {data.get('restaurants_count', 0)} restaurants, {data.get('produits_count', 0)} produits, {data.get('fiches_count', 0)} fiches",
                data if not has_required_fields else None
            )
        else:
            self.log_test(
                "GET /dashboard/stats", 
                False,
                "Failed to get dashboard stats",
                data
            )
        
        # Test restaurant-specific stats
        success, data = self.make_request('GET', '/dashboard/restaurants-stats')
        self.log_test(
            "GET /dashboard/restaurants-stats",
            success and isinstance(data, list),
            f"Found {len(data) if success else 0} restaurant stats entries",
            data if not success else None
        )

    def test_categories_endpoint(self):
        """Test categories endpoint"""
        print("🏷️ Testing Categories Endpoint...")
        
        success, data = self.make_request('GET', '/categories')
        if success and isinstance(data, dict):
            required_keys = ['produits', 'fiches', 'unites']
            has_required_keys = all(key in data for key in required_keys)
            
            self.log_test(
                "GET /categories",
                has_required_keys and all(isinstance(data[key], list) for key in required_keys),
                f"Categories available: {', '.join(required_keys)}",
                data if not has_required_keys else None
            )
        else:
            self.log_test(
                "GET /categories",
                False,
                "Failed to get categories",
                data
            )

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("🧹 Cleaning up test data...")
        
        # Delete created fiches
        for fiche_id in self.created_entities['fiches']:
            success, _ = self.make_request('DELETE', f'/fiches/{fiche_id}')
            if success:
                print(f"    Deleted fiche: {fiche_id}")
            
        # Delete created produits  
        for produit_id in self.created_entities['produits']:
            success, _ = self.make_request('DELETE', f'/produits/{produit_id}')
            if success:
                print(f"    Deleted produit: {produit_id}")
                
        # Delete created restaurants
        for restaurant_id in self.created_entities['restaurants']:
            success, _ = self.make_request('DELETE', f'/restaurants/{restaurant_id}')
            if success:
                print(f"    Deleted restaurant: {restaurant_id}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Trinity API Tests")
        print(f"Testing API at: {self.api_url}")
        print("=" * 50)
        
        try:
            # Run all test suites
            self.test_health_endpoints()
            self.test_restaurant_endpoints()
            self.test_produits_endpoints()
            self.test_fiches_endpoints()
            self.test_dashboard_endpoints()
            self.test_categories_endpoint()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {e}")
        finally:
            # Always try to clean up
            self.cleanup_test_data()
        
        # Print final results
        print("=" * 50)
        print(f"📋 TEST SUMMARY")
        print(f"Tests run: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_run - self.tests_passed > 0:
            print("\n❌ Failed tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = TrinityAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)