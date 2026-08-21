import { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Plus, Trash2, Calculator, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type RecipeItem = {
  id: string;
  ingredientId: string;
  name: string;
  quantityGrams: number;
  displayUnit: string;
  costPerGram: number;
  totalCost: number;
  sectionName: string;
};

type MasterIngredient = {
  id: string;
  name: string;
  costPerGram: number;
  unit: string;
};

export default function MenuItemDetail() {
  const [, params] = useRoute("/menu-items/:id");
  const recipeId = params?.id || "";
  const { currentUser } = useAuth();

  const [menuName, setMenuName] = useState("Recipe Menu");
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeItem[]>([]);
  const [masterIngredients, setMasterIngredients] = useState<MasterIngredient[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMaster, setSelectedMaster] = useState<MasterIngredient | null>(null);
  const [quantity, setQuantity] = useState<number | "">("");
  const [sectionName, setSectionName] = useState("Stove");

  const storeId = "13";

  const fetchRecipeDetail = async () => {
    try {
      // 1. Supabase `recipes` 테이블에서 현재 레시피 정보 조회
      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", recipeId)
        .maybeSingle();

      if (recipeError) throw recipeError;
      if (recipeData) {
        setMenuName(recipeData.title || "Recipe Menu");
        setSellingPrice(Number(recipeData.selling_price || 0));
      }

      // 2. Supabase `recipe_ingredients` 테이블에서 해당 레시피의 재료 목록 조회
      const { data: riData, error: riError } = await supabase
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipeId);

      if (riError) throw riError;
      if (riData) {
        const mapped: RecipeItem[] = riData.map((item: any) => {
          const q = Number(item.quantity_grams || 0);
          const c = Number(item.cost_per_gram || 0);
          return {
            id: String(item.id),
            ingredientId: String(item.ingredient_id || ""),
            name: item.ingredient_name || "Ingredient",
            quantityGrams: q,
            displayUnit: item.display_unit || "g",
            costPerGram: c,
            totalCost: Number(item.total_cost || (q * c)),
            sectionName: item.section_name || "Stove"
          };
        });
        setRecipeIngredients(mapped);
      }

      // 3. Supabase `ingredients` 테이블에서 현재 계정의 마스터 재료 목록 조회
      let query = supabase.from("ingredients").select("*");
      if (currentUser?.username) {
        query = query.eq("user_id", currentUser.username);
      } else {
        query = query.eq("user_id", "default");
      }

      const { data: dbIngredients, error } = await query;
      if (error) throw error;

      if (dbIngredients && dbIngredients.length > 0) {
        const formatted: MasterIngredient[] = dbIngredients.map((i: any) => {
          const amt = Number(i.purchase_amount || 1000);
          const price = Number(i.total_price || 0);
          const yP = Number(i.yield_percent ?? 100);
          const u = i.unit || "g";
          
          let rawGrams = amt;
          if (u === "kg" || u === "L") rawGrams = amt * 1000;
          const validGrams = rawGrams * (yP / 100);
          const costG = validGrams > 0 ? price / validGrams : price / rawGrams;

          return {
            id: String(i.id),
            name: i.name,
            costPerGram: costG,
            unit: u
          };
        });
        setMasterIngredients(formatted);
      } else {
        setMasterIngredients([]);
      }
    } catch (err) {
      console.error("Failed to load recipe detail from Supabase:", err);
    }
  };

  useEffect(() => {
    if (recipeId) {
      fetchRecipeDetail();
    }
  }, [recipeId, currentUser]);

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaster || quantity === "") return;

    const qty = Number(quantity);
    const total = qty * selectedMaster.costPerGram;

    try {
      const { data, error } = await supabase.from("recipe_ingredients").insert([{
        recipe_id: recipeId,
        ingredient_id: selectedMaster.id,
        ingredient_name: selectedMaster.name,
        quantity_grams: qty,
        display_unit: selectedMaster.unit,
        cost_per_gram: selectedMaster.costPerGram,
        total_cost: total,
        section_name: sectionName
      }]).select().single();

      if (error) throw error;

      const newItem: RecipeItem = {
        id: String(data?.id || Date.now()),
        ingredientId: selectedMaster.id,
        name: selectedMaster.name,
        quantityGrams: qty,
        displayUnit: selectedMaster.unit,
        costPerGram: selectedMaster.costPerGram,
        totalCost: total,
        sectionName
      };

      setRecipeIngredients([...recipeIngredients, newItem]);
      setSelectedMaster(null);
      setQuantity("");
      setSearchTerm("");
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Failed to add ingredient:", err);
      alert(`Add failed: ${err.message || err}`);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    const lines = bulkText.split("\n");
    const newItemsToInsert: any[] = [];
    const localNewItems: RecipeItem[] = [];

    lines.forEach((line) => {
      const parts = line.split(/[\t,]/);
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const qty = Number(parts[1].trim()) || 0;
        const found = masterIngredients.find(m => m.name.toLowerCase() === name.toLowerCase());
        const cpg = found ? found.costPerGram : 0;
        const total = qty * cpg;

        newItemsToInsert.push({
          recipe_id: recipeId,
          ingredient_id: found ? found.id : String(Date.now()),
          ingredient_name: name,
          quantity_grams: qty,
          display_unit: found ? found.unit : "g",
          cost_per_gram: cpg,
          total_cost: total,
          section_name: "Stove"
        });
      }
    });

    if (newItemsToInsert.length > 0) {
      try {
        const { data, error } = await supabase.from("recipe_ingredients").insert(newItemsToInsert).select();
        if (error) throw error;

        if (data) {
          const mapped = data.map((item: any) => ({
            id: String(item.id),
            ingredientId: String(item.ingredient_id),
            name: item.ingredient_name,
            quantityGrams: Number(item.quantity_grams),
            displayUnit: item.display_unit,
            costPerGram: Number(item.cost_per_gram),
            totalCost: Number(item.total_cost),
            sectionName: item.section_name
          }));
          setRecipeIngredients([...recipeIngredients, ...mapped]);
        }

        setBulkText("");
        setIsBulkModalOpen(false);
      } catch (err: any) {
        console.error("Bulk add failed:", err);
        alert(`Bulk add failed: ${err.message || err}`);
      }
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (confirm("Delete this ingredient?")) {
      try {
        const { error } = await supabase.from("recipe_ingredients").delete().eq("id", id);
        if (error) throw error;

        setRecipeIngredients(recipeIngredients.filter(i => i.id !== id));
      } catch (err: any) {
        console.error("Failed to delete ingredient:", err);
        alert(`Delete failed: ${err.message || err}`);
      }
    }
  };

  const filteredMasters = masterIngredients.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalFoodCost = recipeIngredients.reduce((acc, cur) => acc + (cur.totalCost || 0), 0);
  const margin = sellingPrice - totalFoodCost;
  const foodCostPercent = sellingPrice > 0 ? (totalFoodCost / sellingPrice) * 100 : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/stores/${storeId}/menu`}>
            <Button variant="outline" size="icon"><ArrowLeft size={16} /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{menuName} - Recipe Cost Analysis</h1>
            <p className="text-gray-500 text-sm">Detailed ingredient cost breakdown and margin.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsBulkModalOpen(true)} className="bg-slate-50">
            <Layers size={16} className="mr-1" /> Bulk Input
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white">
            <Plus size={16} className="mr-1" /> Add Ingredient
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block font-semibold">Selling Price ($ AUD)</span>
          <span className="text-xl font-black text-slate-900">${sellingPrice.toFixed(2)}</span>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block font-semibold">Total Food Cost</span>
          <span className="text-xl font-black text-red-600">${totalFoodCost.toFixed(2)} AUD</span>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block font-semibold">Margin ($)</span>
          <span className="text-xl font-black text-blue-600">${margin.toFixed(2)} AUD</span>
        </div>
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 block font-semibold">Food Cost % (원가율)</span>
          <span className="text-xl font-black text-amber-400">{foodCostPercent.toFixed(1)}%</span>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Calculator size={18} /> Recipe Structure ({recipeIngredients.length} items)
        </h3>

        {recipeIngredients.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No ingredients added yet. Click "+ Add Ingredient" to start.
          </div>
        ) : (
          <div className="space-y-2">
            {recipeIngredients.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 border rounded-xl">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                  <p className="text-xs text-slate-500">
                    Section: {item.sectionName} / Qty: {item.quantityGrams}{item.displayUnit} / Unit Cost: ${item.costPerGram.toFixed(4)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-900 text-sm">${item.totalCost.toFixed(2)} AUD</span>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteIngredient(item.id)}>
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">Add Ingredient to Recipe</h2>
            <form onSubmit={handleAddIngredient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Ingredient Search</label>
                <Input 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Type to search master ingredients..." 
                  className="rounded-xl" 
                />
              </div>

              <div className="max-h-40 overflow-y-auto border rounded-xl p-2 space-y-1 bg-slate-50">
                {filteredMasters.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">No master ingredients found. Please add ingredients first.</div>
                ) : (
                  filteredMasters.map((m) => (
                    <div 
                      key={m.id} 
                      onClick={() => setSelectedMaster(m)}
                      className={`p-2 rounded-lg cursor-pointer text-xs flex justify-between items-center transition-all ${
                        selectedMaster?.id === m.id ? "bg-slate-900 text-white font-bold" : "bg-white hover:bg-slate-100 text-slate-800"
                      }`}
                    >
                      <span>{m.name}</span>
                      <span className="opacity-70">${m.costPerGram.toFixed(4)}/{m.unit}</span>
                    </div>
                  ))
                )}
              </div>

              {selectedMaster && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Quantity ({selectedMaster.unit})</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))} 
                    required 
                    className="rounded-xl" 
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">Section</label>
                <select value={sectionName} onChange={(e) => setSectionName(e.target.value)} className="w-full border rounded-xl p-2.5 text-sm bg-white h-11">
                  <option value="Stove">Stove</option>
                  <option value="Wok">Wok</option>
                  <option value="Base Sauce">Base Sauce</option>
                  <option value="Cold">Cold</option>
                  <option value="Deep Fried">Deep Fried</option>
                  <option value="Extra">Extra</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={!selectedMaster} className="bg-slate-900 text-white rounded-xl">Add</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4">
            <h2 className="text-lg font-bold">Bulk Input Ingredients</h2>
            <p className="text-xs text-gray-500">Enter format: Ingredient Name, Quantity (one per line)</p>
            <form onSubmit={handleBulkAdd} className="space-y-4">
              <textarea 
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Garlic, 100\nBeef, 250\nOnion, 50"}
                className="w-full border rounded-2xl p-3 text-sm outline-none bg-slate-50"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsBulkModalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-slate-900 text-white rounded-xl">Import Bulk</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}