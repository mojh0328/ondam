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

  // 기본 폴더 목록을 비어 있는 상태([])로 시작하여 새 계정엔 폴더가 없게 설정
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

  // 폴더 추가 모달 상태
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const currentUsername = currentUser?.username || 'default';
  const storageKey = `store_menu_${storeId}_${currentUsername}`;
  const folderKey = `store_folders_${storeId}_${currentUsername}`;

  const fetchRecipes = async () => {
    try {
      const savedFolders = localStorage.getItem(folderKey);
      if (savedFolders) {
        const parsedFolders = JSON.parse(savedFolders);
        if (Array.isArray(parsedFolders)) {
          setFolders(parsedFolders);
          if (parsedSuppliersCheck(parsedFolders) && activeFolderId === "all") {
            // 유지
          }
        }
      } else {
        setFolders([]);
        setActiveFolderId("all");
      }

      const savedLocal = localStorage.getItem(storageKey);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        const list = parsed.menuItems || parsed.store_menu_13 || [];
        if (Array.isArray(list)) {
          setMenuItems(list);
          calculateAllCosts(list, parsed.recipes || {});
          return;
        }
      } else {
        setMenuItems([]);
      }
    } catch (err) {
      console.error("Failed to fetch recipes:", err);
    }
  };

  function parsedSuppliersCheck(flds: MenuFolder[]) {
    return flds.length > 0;
  }

  const calculateAllCosts = (items: MenuItem[], recipesMap: any) => {
    const costsMap: { [key: string]: { totalCost: number; foodCostPercent: number } } = {};
    
    items.forEach((item) => {
      const ingList = recipesMap[item.id] || [];
      const totalCost = ingList.reduce((sum: number, ing: any) => sum + Number(ing.totalCost || ing.total_cost || 0), 0);
      const foodCostPercent = item.price > 0 ? (totalCost / item.price) * 100 : 0;
      costsMap[item.id] = { totalCost, foodCostPercent };
    });

    setRecipeCosts(costsMap);
  };

  useEffect(() => {
    fetchRecipes();
  }, [storeId, currentUser]);

  // 폴더 추가 핸들러
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

  // 폴더 삭제 핸들러
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

  const handleExportRecipes = () => {
    try {
      const localData = localStorage.getItem(storageKey);
      let recipesObj = {};
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          recipesObj = parsed.recipes || {};
        } catch (e) {}
      }

      const exportData: any = { 
        storeId,
        folders,
        menuItems,
        recipes: recipesObj 
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `recipes-backup-${currentUsername}-${today}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      alert("Recipes exported successfully!");
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
        
        let importedFolders = folders;
        const folderKeyFound = Object.keys(json).find(k => k.startsWith("store_folders_"));
        if (folderKeyFound && Array.isArray(json[folderKeyFound]) && json[folderKeyFound].length > 0) {
          importedFolders = json[folderKeyFound];
        } else if (Array.isArray(json.folders) && json.folders.length > 0) {
          importedFolders = json.folders;
        }

        setFolders(importedFolders);
        localStorage.setItem(folderKey, JSON.stringify(importedFolders));
        if (importedFolders.length > 0) {
          setActiveFolderId(importedFolders[0].id);
        }

        let itemsToImport: any[] = [];
        const menuKeyFound = Object.keys(json).find(k => k.startsWith("store_menu_"));
        if (menuKeyFound && Array.isArray(json[menuKeyFound])) {
          itemsToImport = json[menuKeyFound];
        } else if (Array.isArray(json.menuItems)) {
          itemsToImport = json.menuItems;
        }

        if (itemsToImport.length > 0) {
          const validFolderIds = new Set(importedFolders.map(f => f.id));
          const defaultFolderId = importedFolders[0]?.id || "";

          const formattedImportedItems: MenuItem[] = itemsToImport.map((item: any) => {
            let fId = item.folderId || item.folder_id;
            if (!fId || !validFolderIds.has(fId)) {
              fId = defaultFolderId;
            }

            return {
              id: String(item.id || Date.now() + Math.random()),
              name: item.name || item.title || "",
              price: Number(item.price || item.selling_price || 0),
              folderId: fId
            };
          });
          
          setMenuItems(formattedImportedItems);

          const recipesData = json.recipes || {};
          const dataToSave = {
            menuItems: formattedImportedItems,
            recipes: recipesData
          };
          localStorage.setItem(storageKey, JSON.stringify(dataToSave));
          calculateAllCosts(formattedImportedItems, recipesData);

          alert(`Successfully imported ${formattedImportedItems.length} menu items and recipe details!`);
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

    const newItem: MenuItem = {
      id: editingItem ? editingItem.id : String(Date.now()),
      name,
      price: Number(price),
      folderId: selectedFolderId
    };

    const updated = editingItem ? menuItems.map(i => i.id === editingItem.id ? newItem : i) : [...menuItems, newItem];
    setMenuItems(updated);

    const existingLocal = localStorage.getItem(storageKey);
    let existingRecipes = {};
    if (existingLocal) {
      try {
        const parsed = JSON.parse(existingLocal);
        existingRecipes = parsed.recipes || {};
      } catch (e) {}
    }

    localStorage.setItem(storageKey, JSON.stringify({
      menuItems: updated,
      recipes: existingRecipes
    }));
    calculateAllCosts(updated, existingRecipes);
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setName("");
    setPrice("");
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this menu item?")) {
      const updated = menuItems.filter(item => item.id !== id);
      setMenuItems(updated);
      
      const existingLocal = localStorage.getItem(storageKey);
      let existingRecipes = {};
      if (existingLocal) {
        try {
          const parsed = JSON.parse(existingLocal);
          existingRecipes = parsed.recipes || {};
        } catch (e) {}
      }

      localStorage.setItem(storageKey, JSON.stringify({
        menuItems: updated,
        recipes: existingRecipes
      }));
      calculateAllCosts(updated, existingRecipes);
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
            <p className="text-gray-500 text-sm">Organize recipes with cloud sync & backup.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportRecipes} className="hidden" />
          <Button variant="outline" onClick={handleExportRecipes} className="bg-green-50 text-green-700 border-green-200"><Download size={16} /> Export</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-blue-50 text-blue-700 border-blue-200"><Upload size={16} /> Import</Button>
          <Button onClick={() => { setEditingItem(null); setSelectedFolderId(folders[0]?.id || ""); setIsModalOpen(true); }} className="bg-slate-900 text-white"><Plus size={16} /> Add Recipe</Button>
        </div>
      </div>

      {/* 폴더 탭 및 추가/삭제 영역 */}
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

      {/* 폴더 추가 모달 */}
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

      {/* 레시피 추가/수정 모달 */}
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