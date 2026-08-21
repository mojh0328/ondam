import { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { Plus, ArrowLeft, Edit, Trash2, Calculator, Folder, Download, Upload, Search, FolderPlus } from "lucide-react";
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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [selectedFolderId, setSelectedFolderId] = useState("");

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const currentUsername = currentUser?.username || 'default';
  const folderKey = `store_folders_${storeId}_${currentUsername}`;

  const fetchRecipes = async () => {
    try {
      const savedFolders = localStorage.getItem(folderKey);
      if (savedFolders) {
        const parsedFolders = JSON.parse(savedFolders);
        if (Array.isArray(parsedFolders)) {
          setFolders(parsedFolders);
        }
      } else {
        setFolders([]);
      }

      // 🌟 Supabase `recipes` 테이블에서 현재 유저의 레시피 목록 조회
      let query = supabase.from('recipes').select('*');
      if (currentUser?.username) {
        query = query.eq('user_id', currentUser.username);
      } else {
        query = query.eq('user_id', 'default');
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
        calculateAllCosts(mappedItems);
      } else {
        setMenuItems([]);
      }
    } catch (err) {
      console.error("Failed to fetch recipes from Supabase:", err);
    }
  };

  const calculateAllCosts = async (items: MenuItem[]) => {
    try {
      const { data: recipeIngs, error } = await supabase.from('recipe_ingredients').select('*');
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

  useEffect(() => {
    fetchRecipes();
  }, [storeId, currentUser]);

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFld: MenuFolder = {
      id: `fld_${Date.now()}`,
      name: newFolderName.trim()
    };

    const updatedFolders = [...folders, newFld];
    setFolders(updatedFolders);
    localStorage.setItem(folderKey, JSON.stringify(updatedFolders));

    setNewFolderName("");
    setIsFolderModalOpen(false);

    if (activeFolderId === "all" && updatedFolders.length === 1) {
      setActiveFolderId(newFld.id);
    }
  };

  const handleDeleteFolder = (fldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this folder?")) {
      const updatedFolders = folders.filter(f => f.id !== fldId);
      setFolders(updatedFolders);
      localStorage.setItem(folderKey, JSON.stringify(updatedFolders));

      if (activeFolderId === fldId) {
        setActiveFolderId("all");
      }
    }
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

      await fetchRecipes();
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
            <p className="text-gray-500 text-sm">Organize recipes with Supabase cloud sync.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        {filteredMenuItems.length === 0 ? (
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