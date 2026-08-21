import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useRoute } from "wouter";
import { Plus, ArrowLeft, Edit, Trash2, Calculator, Folder, Download, Upload, Search, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type MenuItem = { 
  id: string; 
  name: string; 
  price: number; 
  folderId: string;
};

type MenuFolder = {
  id: string;
  name: string;
};

export default function StoreMenu() {
  const [, params] = useRoute("/stores/:id/menu");
  const storeId = params?.id || "13";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();

  const [folders, setFolders] = useState<MenuFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>("all");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipeCosts, setRecipeCosts] = useState<{ [key: string]: { totalCost: number; foodCostPercent: number } }>({});
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [selectedFolderId, setSelectedFolderId] = useState("");

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const currentUsername = currentUser?.username || 'default';
  const masterStorageKey = `master_ingredients_${currentUsername}`;

  // 🌟 [성능 최적화] 모든 레시피의 원가를 단 1회의 쿼리로 일괄 계산하도록 개선
  const calculateAllCosts = async (items: MenuItem[]) => {
    try {
      if (!items || items.length === 0) {
        setRecipeCosts({});
        return;
      }

      const recipeIds = items.map(item => item.id);

      // 한번에 해당 레시피들의 모든 하위 재료를 불러옴 (N+1 쿼리 문제 해결)
      const { data: recipeIngs, error } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, total_cost')
        .in('recipe_id', recipeIds);

      if (error) throw error;

      const costsMap: { [key: string]: { totalCost: number; foodCostPercent: number } } = {};
      
      items.forEach((item) => {
        const matchingIngs = recipeIngs?.filter((ri: any) => String(ri.recipe_id) === String(item.id)) || [];
        const totalCost = matchingIngs.reduce((sum: number, ing: any) => sum + Number(ing.total_cost || 0), 0);
        const foodCostPercent = item.price > 0 ? (totalCost / item.price) * 100 : 0;
        costsMap[item.id] = { totalCost, foodCostPercent };
      });

      setRecipeCosts(costsMap);
    } catch (err) {
      console.error("Failed to calculate recipe costs:", err);
    }
  };

  const fetchFoldersAndRecipes = useCallback(async () => {
    setIsLoading(true);
    try {
      let folderQuery = supabase.from('store_folders').select('*').eq('store_id', storeId);
      if (currentUser?.username) {
        folderQuery = folderQuery.or(`user_id.eq.${currentUser.username},user_id.eq.default`);
      }

      const { data: folderData, error: folderError } = await folderQuery;
      if (folderError) throw folderError;

      if (folderData && folderData.length > 0) {
        const uniqueFoldersMap = new Map();
        folderData.forEach((f: any) => {
          uniqueFoldersMap.set(String(f.id), { id: String(f.id), name: f.name });
        });
        setFolders(Array.from(uniqueFoldersMap.values()));
      } else {
        setFolders([]);
      }

      let query = supabase.from('recipes').select('*').eq('store_id', storeId);
      if (currentUser?.username) {
        query = query.or(`user_id.eq.${currentUser.username},user_id.eq.default`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const mappedItems: MenuItem[] = data.map((r: any) => ({
          id: String(r.id),
          name: r.title,
          price: Number(r.selling_price || 0),
          folderId: r.folder_id || "default"
        }));
        setMenuItems(mappedItems);
        await calculateAllCosts(mappedItems);
      } else {
        setMenuItems([]);
        setRecipeCosts({});
      }
    } catch (err) {
      console.error("Failed to fetch folders or recipes from Supabase:", err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, currentUser]);

  useEffect(() => {
    fetchFoldersAndRecipes();

    const handleFocus = () => {
      fetchFoldersAndRecipes();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchFoldersAndRecipes]);

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolderId = `fld_${Date.now()}`;
    const folderName = newFolderName.trim();

    try {
      const { error } = await supabase.from('store_folders').insert([{
        id: newFolderId,
        user_id: currentUser?.username || 'default',
        store_id: storeId,
        name: folderName
      }]);

      if (error) throw error;

      const updatedFolders = [...folders, { id: newFolderId, name: folderName }];
      setFolders(updatedFolders);
      setNewFolderName("");
      setIsFolderModalOpen(false);

      if (activeFolderId === "all" && updatedFolders.length === 1) {
        setActiveFolderId(newFolderId);
      }
    } catch (err: any) {
      console.error("Failed to add folder:", err);
      alert(`Add folder failed: ${err.message || err}`);
    }
  };

  const handleDeleteFolder = async (fldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this folder?")) {
      try {
        const { error } = await supabase.from('store_folders').delete().eq('id', fldId);
        if (error) throw error;

        const updatedFolders = folders.filter(f => f.id !== fldId);
        setFolders(updatedFolders);

        if (activeFolderId === fldId) {
          setActiveFolderId("all");
        }
      } catch (err: any) {
        console.error("Failed to delete folder:", err);
        alert(`Delete folder failed: ${err.message || err}`);
      }
    }
  };

  const handleExportRecipes = () => {
    try {
      const masterLocal = localStorage.getItem(masterStorageKey);
      const masterItems = masterLocal ? JSON.parse(masterLocal) : [];

      const exportData: any = { 
        storeId,
        folders,
        menuItems,
        master_ingredients: masterItems
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `recipes-backup-${currentUsername}-${today}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      alert("Recipes and Master Ingredients exported successfully!");
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportRecipes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        const rawFolders = json.folders || [];
        if (Array.isArray(rawFolders) && rawFolders.length > 0) {
          for (const f of rawFolders) {
            await supabase.from('store_folders').upsert([{
              id: f.id || `fld_${Date.now()}`,
              user_id: currentUser?.username || 'default',
              store_id: storeId,
              name: f.name
            }]);
          }
        }

        const rawMaster = json.master_ingredients || json.ingredients || [];
        if (Array.isArray(rawMaster) && rawMaster.length > 0 && currentUser?.username) {
          const rowsToInsert = rawMaster.map((item: any) => ({
            user_id: currentUser.username,
            name: item.name,
            purchase_amount: Number(item.purchaseAmount || item.purchase_amount || 1000),
            unit: item.unit || "g",
            total_price: Number(item.totalPrice || item.total_price || 0),
            yield_percent: Number(item.yieldPercent || item.yield_percent || 100),
            supplier_id: item.supplierId || item.supplier_id || ""
          }));
          await supabase.from('ingredients').insert(rowsToInsert);
        }

        const itemsToImport = json.menuItems || [];
        const recipesMap = json.recipes || {};

        if (Array.isArray(itemsToImport) && itemsToImport.length > 0) {
          let { data: currentFolders } = await supabase.from('store_folders').select('*').eq('store_id', storeId);
          const defaultFolderId = currentFolders?.[0]?.id || "default";

          for (const item of itemsToImport) {
            const { data: insertedRecipe, error: recError } = await supabase.from('recipes').insert([{
              user_id: currentUser?.username || 'default',
              store_id: storeId,
              folder_id: item.folderId || defaultFolderId,
              title: item.name || item.title || "Untitled",
              selling_price: Number(item.price || 0)
            }]).select().single();

            if (recError || !insertedRecipe) continue;

            const newRecipeId = insertedRecipe.id;
            const rawIngredients = recipesMap[item.id] || item.ingredients || recipesMap[item.name] || [];

            if (Array.isArray(rawIngredients) && rawIngredients.length > 0) {
              const riRows = rawIngredients.map((ing: any) => {
                const qty = Number(ing.quantityGrams || ing.quantity_grams || ing.quantity || 0);
                const cpg = Number(ing.costPerGram || ing.cost_per_gram || 0);
                return {
                  recipe_id: newRecipeId,
                  ingredient_id: ing.ingredientId || ing.ingredient_id || String(Date.now()),
                  ingredient_name: ing.name || ing.ingredient_name || "Ingredient",
                  quantity: qty,
                  quantity_grams: qty,
                  display_unit: ing.displayUnit || ing.display_unit || "g",
                  cost_per_gram: cpg,
                  total_cost: Number(ing.totalCost || ing.total_cost || (qty * cpg)),
                  section_name: ing.sectionName || ing.section_name || "Stove"
                };
              });

              await supabase.from('recipe_ingredients').insert(riRows);
            }
          }

          await fetchFoldersAndRecipes();
          alert(`Successfully imported ${itemsToImport.length} menu items and recipe details!`);
        } else {
          alert("No menu items found in this backup file.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to import backup file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === "" || !selectedFolderId) {
      alert("Please check all fields, including selecting a folder.");
      return;
    }

    const numericPrice = Number(price);

    try {
      if (editingItem) {
        const { error } = await supabase.from('recipes').update({
          title: name,
          selling_price: numericPrice,
          folder_id: selectedFolderId
        }).eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('recipes').insert([{
          user_id: currentUser?.username || 'default',
          store_id: storeId,
          folder_id: selectedFolderId,
          title: name,
          selling_price: numericPrice
        }]);

        if (error) throw error;
      }

      await fetchFoldersAndRecipes();
      closeModal();
    } catch (err: any) {
      console.error("Failed to save recipe:", err);
      alert(`Save failed: ${err.message || err}`);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setName("");
    setPrice("");
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this recipe?")) {
      try {
        const { error } = await supabase.from('recipes').delete().eq('id', id);
        if (error) throw error;

        setMenuItems(menuItems.filter(item => item.id !== id));
      } catch (err: any) {
        console.error("Failed to delete recipe:", err);
        alert(`Delete failed: ${err.message || err}`);
      }
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    const matchesFolder = activeFolderId === "all" || item.folderId === activeFolderId;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/"><Button variant="outline" size="icon"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">Recipe & Menu Folders ({currentUsername})</h1>
            <p className="text-gray-500 text-sm">Organize recipes with Supabase cloud sync & backup.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportRecipes} className="hidden" />
          <Button variant="outline" onClick={handleExportRecipes} className="bg-green-50 text-green-700 border-green-200"><Download size={16} /> Export</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-blue-50 text-blue-700 border-blue-200"><Upload size={16} /> Import</Button>
          <Button onClick={() => { setEditingItem(null); setSelectedFolderId(folders[0]?.id || ""); setIsModalOpen(true); }} className="bg-slate-900 text-white"><Plus size={16} /> Add Recipe</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b">
        <button
          onClick={() => setActiveFolderId("all")}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
            activeFolderId === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
          }`}
        >
          All Recipes
        </button>

        {folders.map(fld => (
          <div key={fld.id} className="flex items-center">
            <button
              onClick={() => setActiveFolderId(fld.id)}
              className={`px-3 py-2 rounded-l-xl text-xs font-bold whitespace-nowrap border-y border-l transition-all ${
                activeFolderId === fld.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {fld.name}
            </button>
            <button
              onClick={(e) => handleDeleteFolder(fld.id, e)}
              className={`px-2 py-2 rounded-r-xl text-xs font-bold border-y border-r transition-all ${
                activeFolderId === fld.id ? "bg-slate-800 text-red-300 border-slate-900" : "bg-white text-red-400 border-slate-200 hover:bg-red-50"
              }`}
              title="Delete Folder"
            >
              &times;
            </button>
          </div>
        ))}

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsFolderModalOpen(true)}
          className="rounded-xl border-dashed border-slate-300 text-slate-600 h-9 shrink-0"
        >
          <FolderPlus size={14} className="mr-1" /> Add Folder
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-200">
        <Search size={18} className="text-slate-400" />
        <input type="text" placeholder="Search recipe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full outline-none text-sm bg-transparent" />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} /> Loading recipes from cloud...
          </div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
            No recipes found. Create a folder and click "+ Add Recipe" to get started.
          </div>
        ) : (
          filteredMenuItems.map((item) => {
            const costInfo = recipeCosts[item.id] || { totalCost: 0, foodCostPercent: 0 };
            return (
              <div key={item.id} className="bg-white border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                <div>
                  <h3 className="text-base font-black text-slate-900">{item.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>Selling: <strong className="text-slate-900">${(item.price || 0).toFixed(2)} AUD</strong></span>
                    <span>•</span>
                    <span>Food Cost: <strong className="text-red-600">${costInfo.totalCost.toFixed(2)} AUD</strong></span>
                    <span>•</span>
                    <span>Cost %: <strong className="text-blue-600">{costInfo.foodCostPercent.toFixed(1)}%</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/menu-items/${item.id}`}><Button className="bg-slate-900 text-white w-10 h-10 p-0 rounded-xl"><Calculator size={18} /></Button></Link>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setName(item.name); setPrice(item.price); setSelectedFolderId(item.folderId); setIsModalOpen(true); }}><Edit size={16} /></Button>
                  <Button variant="ghost" size="icon" onClick={(e) => handleDelete(item.id, e)}><Trash2 size={16} className="text-red-500" /></Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold">Add Recipe Folder</h2>
            <form onSubmit={handleAddFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Folder Name</label>
                <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g., Stove" required className="rounded-xl" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsFolderModalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-slate-900 text-white rounded-xl">Add</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">{editingItem ? "Edit Recipe" : "Add Recipe"}</h2>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Recipe Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Folder</label>
                <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} required className="w-full border rounded-xl p-2.5 text-sm bg-white h-11">
                  <option value="" disabled>Select a folder</option>
                  {folders.map(fld => <option key={fld.id} value={fld.id}>{fld.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Selling Price ($ AUD)</label>
                <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))} required className="rounded-xl" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeModal} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-slate-900 text-white rounded-xl">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}