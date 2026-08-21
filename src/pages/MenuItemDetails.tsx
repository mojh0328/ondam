import { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Plus, Trash2, Layers, Package, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type MasterIngredient = {
  id: string;
  name: string;
  purchaseAmount?: number;
  unit?: string;
  totalPrice?: number;
  yieldPercent?: number;
  costPerGram: number;
};

type RecipeIngredient = {
  id: string;
  ingredientId: string;
  name: string;
  quantityGrams: number;
  costPerGram: number;
  totalCost: number;
};

type MenuItem = {
  id: string;
  storeId?: string | number;
  name: string;
  price: number;
};

export default function MenuItemDetails() {
  const [, params] = useRoute("/menu-items/:id");
  const menuItemId = params?.id || "1";
  const { currentUser } = useAuth();

  const [menuItem, setMenuItem] = useState<MenuItem | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [masterIngredients, setMasterIngredients] = useState<MasterIngredient[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<MasterIngredient | null>(null);
  const [quantityGrams, setQuantityGrams] = useState<number | "">("");
  const [bulkText, setBulkText] = useState("");

  // 1. 메뉴 정보 및 마스터 식자재, 레시피 매핑 데이터 Supabase에서 불러오기
  const fetchRecipeDetails = async () => {
    try {
      // 메뉴 정보 가져오기
      const { data: menuData, error: menuError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', menuItemId)
        .single();

      if (menuError) throw menuError;
      if (menuData) {
        setMenuItem({
          id: menuData.id,
          storeId: menuData.store_id || "1",
          name: menuData.title,
          price: Number(menuData.selling_price || 0)
        });
      }

      // 마스터 식자재 목록 가져오기 (원가 계산용)
      const { data: ingData, error: ingError } = await supabase
        .from('ingredients')
        .select('*');

      if (ingError) throw ingError;
      const formattedMaster: MasterIngredient[] = (ingData || []).map((item: any) => {
        const amt = Number(item.purchase_amount || 1000);
        const prc = Number(item.total_price || 0);
        const yP = Number(item.yield_percent ?? 100);
        const u = item.unit || "g";

        let rawGrams = amt;
        if (u === "kg" || u === "L") rawGrams = amt * 1000;
        const validGrams = rawGrams * (yP / 100);
        const costG = validGrams > 0 ? prc / validGrams : prc / rawGrams;

        return {
          id: item.id,
          name: item.name,
          purchaseAmount: amt,
          unit: u,
          totalPrice: prc,
          yieldPercent: yP,
          costPerGram: costG
        };
      });
      setMasterIngredients(formattedMaster);

      // 해당 레시피에 매핑된 재료들 가져오기 (recipe_ingredients)
      const { data: mapData, error: mapError } = await supabase
        .from('recipe_ingredients')
        .select('*, ingredients(name, total_price, purchase_amount, unit, yield_percent)')
        .eq('recipe_id', menuItemId);

      if (mapError) throw mapError;
      if (mapData) {
        const formattedRecipeIngs: RecipeIngredient[] = mapData.map((ri: any) => {
          const ing = ri.ingredients;
          const amt = Number(ing?.purchase_amount || 1000);
          const prc = Number(ing?.total_price || 0);
          const yP = Number(ing?.yield_percent ?? 100);
          const u = ing?.unit || "g";

          let rawGrams = amt;
          if (u === "kg" || u === "L") rawGrams = amt * 1000;
          const validGrams = rawGrams * (yP / 100);
          const costG = validGrams > 0 ? prc / validGrams : prc / rawGrams;

          const qty = Number(ri.quantity);
          const cost = qty * costG;

          return {
            id: ri.id,
            ingredientId: ri.ingredient_id,
            name: ing?.name || "Unknown",
            quantityGrams: qty,
            costPerGram: costG,
            totalCost: cost
          };
        });
        setRecipeIngredients(formattedRecipeIngs);
      }
    } catch (err) {
      console.error("Failed to fetch recipe details from Supabase:", err);
    }
  };

  useEffect(() => {
    fetchRecipeDetails();
  }, [menuItemId]);

  const totalFoodCost = recipeIngredients.reduce((sum, item) => sum + item.totalCost, 0);
  const sellingPrice = menuItem?.price || 0;
  const marginDollar = sellingPrice - totalFoodCost;
  const foodCostRatio = sellingPrice > 0 ? (totalFoodCost / sellingPrice) * 100 : 0;

  const filteredMasterList = masterIngredients.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectIngredient = (item: MasterIngredient) => {
    setSelectedIngredient(item);
    setSearchQuery(item.name);
    setIsDropdownOpen(false);
  };

  // Supabase에 레시피 재료 추가
  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient || quantityGrams === "") return;

    const qty = Number(quantityGrams);

    try {
      const { error } = await supabase
        .from('recipe_ingredients')
        .insert({
          recipe_id: menuItemId,
          ingredient_id: selectedIngredient.id,
          quantity: qty
        });

      if (error) throw error;

      await fetchRecipeDetails();
      closeModal();
    } catch (err) {
      console.error("Failed to add ingredient to recipe:", err);
      alert("Failed to save recipe ingredient.");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedIngredient(null);
    setSearchQuery("");
    setIsDropdownOpen(false);
    setQuantityGrams("");
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    const lines = bulkText.split("\n");
    const newInserts: any[] = [];

    lines.forEach((line) => {
      const parts = line.trim().split(/,|\t|\s+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const searchName = parts[0].toLowerCase();
        const qty = parseFloat(parts[1]) || 0;

        const master = masterIngredients.find(m => m.name.toLowerCase().includes(searchName));
        if (master && qty > 0) {
          newInserts.push({
            recipe_id: menuItemId,
            ingredient_id: master.id,
            quantity: qty
          });
        }
      }
    });

    if (newInserts.length > 0) {
      try {
        const { error } = await supabase.from('recipe_ingredients').insert(newInserts);
        if (error) throw error;

        await fetchRecipeDetails();
        alert(`${newInserts.length} ingredients added successfully!`);
        setBulkText("");
        setIsBulkModalOpen(false);
      } catch (err) {
        console.error("Bulk insert failed:", err);
        alert("Failed to bulk insert recipe ingredients.");
      }
    }
  };

  // Supabase에서 레시피 재료 삭제
  const handleDelete = async (id: string) => {
    if (confirm("Delete this ingredient from recipe?")) {
      try {
        const { error } = await supabase
          .from('recipe_ingredients')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setRecipeIngredients(recipeIngredients.filter(item => item.id !== id));
      } catch (err) {
        console.error("Failed to delete recipe ingredient:", err);
        alert("Failed to delete from database.");
      }
    }
  };

  const backStoreId = menuItem?.storeId || "00000000-0000-0000-0000-000000000001";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/stores/${backStoreId}/menu`}>
          <Button variant="outline" size="icon">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Recipe & Cost Analysis (Cloud Sync)</h1>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-gray-500 font-medium">Selling Price ($ AUD)</p>
          <p className="text-2xl font-bold text-gray-900">$ {sellingPrice.toFixed(2)}</p>
        </Card>

        <Card className="p-4 space-y-1">
          <p className="text-xs text-gray-500 font-medium">Total Food Cost</p>
          <p className="text-2xl font-bold text-red-500">${totalFoodCost.toFixed(2)} AUD</p>
        </Card>

        <Card className="p-4 space-y-1">
          <p className="text-xs text-gray-500 font-medium">Margin ($)</p>
          <p className="text-2xl font-bold text-blue-600">${marginDollar.toFixed(2)} AUD</p>
        </Card>

        <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col justify-center">
          <p className="text-xs text-gray-400 font-medium">Food Cost % (원가율)</p>
          <p className="text-3xl font-bold text-amber-400">{foodCostRatio.toFixed(1)}%</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package size={20} /> Recipe Structure
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsBulkModalOpen(true)} className="flex items-center gap-2 rounded-xl">
              <Layers size={16} /> Bulk Input
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
              <Plus size={16} /> Add Ingredient
            </Button>
          </div>
        </div>

        <Card className="p-5 border rounded-2xl space-y-4 bg-white shadow-xs">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-sm font-bold text-slate-800 px-3 py-1 bg-slate-100 rounded-xl flex items-center gap-1.5">
              🏷️ {menuItem?.name || "Recipe Menu"}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Subtotal: ${totalFoodCost.toFixed(2)} AUD
            </span>
          </div>

          <div className="divide-y">
            {recipeIngredients.map((item) => (
              <div key={item.id} className="py-3 flex justify-between items-center text-sm hover:bg-slate-50 px-2 rounded-xl transition-colors">
                <div>
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-400">
                    Qty: <span className="font-semibold text-slate-700">{item.quantityGrams}g</span> 
                    {item.quantityGrams >= 1000 && ` (${(item.quantityGrams / 1000).toFixed(3)}kg)`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-900">${item.totalCost.toFixed(2)}</span>
                  <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            {recipeIngredients.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">No ingredients added yet. Click "+ Add Ingredient" to start.</p>
            )}
          </div>
        </Card>
      </div>

      {/* 모달창들 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative overflow-visible">
            <h2 className="text-lg font-bold">Add Ingredient to Recipe</h2>
            <form onSubmit={handleAddIngredient} className="space-y-4">
              
              <div className="relative space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Ingredient Search</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedIngredient(null);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Type to search..."
                    className="pl-9 bg-slate-50 rounded-xl"
                  />
                </div>

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto z-50 divide-y">
                    {filteredMasterList.map((ing) => {
                      const isSelected = selectedIngredient?.id === ing.id;
                      const pAmt = ing.purchaseAmount || 1000;
                      const u = ing.unit || "g";
                      const prc = ing.totalPrice || 0;

                      return (
                        <div
                          key={ing.id}
                          onClick={() => handleSelectIngredient(ing)}
                          className={`p-3 text-xs flex justify-between items-center cursor-pointer transition-colors hover:bg-slate-100 ${
                            isSelected ? "bg-blue-50 text-blue-900 font-bold" : "text-slate-800"
                          }`}
                        >
                          <div>
                            <p className="font-bold text-sm text-slate-900">{ing.name}</p>
                            <p className="text-slate-500">Purchased: {pAmt}{u} (${prc.toFixed(2)})</p>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="font-bold text-blue-600">${(ing.costPerGram * 1000).toFixed(2)}/kg</span>
                            {isSelected && <Check size={14} className="text-blue-600" />}
                          </div>
                        </div>
                      );
                    })}

                    {filteredMasterList.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No matching ingredients found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedIngredient && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-blue-900">
                    <span>Selected: {selectedIngredient.name}</span>
                    <span>${selectedIngredient.totalPrice?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Yield: {selectedIngredient.yieldPercent || 100}%</span>
                    <span className="font-bold">Effective: ${(selectedIngredient.costPerGram * 1000).toFixed(2)} / kg</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity to Use (Grams / ml)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={quantityGrams}
                  onChange={(e) => setQuantityGrams(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 100"
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeModal} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={!selectedIngredient} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">Add to Recipe</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold">Bulk Input Ingredients</h2>
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <textarea
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="e.g.&#10;Egg 58&#10;Onion 5&#10;Soft Tofu 250"
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm font-mono outline-none"
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsBulkModalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="rounded-xl">Add All</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}