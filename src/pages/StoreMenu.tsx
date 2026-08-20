import { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { Plus, ArrowLeft, Edit, Trash2, Calculator, Folder, FolderPlus, Download, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

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
  const storeId = params?.id || "1";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();

  const userPrefix = currentUser ? `_user_${currentUser.username}` : "";
  const foldersKey = `store_folders_${storeId}${userPrefix}`;
  const menuKey = `store_menu_${storeId}${userPrefix}`;

  const [folders, setFolders] = useState<MenuFolder[]>(() => {
    const saved = localStorage.getItem(foldersKey);
    return saved ? JSON.parse(saved) : [
      { id: "fld_1", name: "Stove" },
      { id: "fld_2", name: "Wok" },
      { id: "fld_3", name: "Base Sauce" }
    ];
  });

  const [activeFolderId, setActiveFolderId] = useState<string>(() => folders[0]?.id || "fld_1");
  const [searchTerm, setSearchTerm] = useState("");

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem(menuKey);
    return saved ? JSON.parse(saved) : [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folders[0]?.id || "fld_1");

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<MenuFolder | null>(null);
  const [folderNameInput, setFolderNameInput] = useState("");

  useEffect(() => {
    localStorage.setItem(foldersKey, JSON.stringify(folders));
  }, [folders, foldersKey]);

  useEffect(() => {
    localStorage.setItem(menuKey, JSON.stringify(menuItems));
  }, [menuItems, menuKey]);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setPrice(editingItem.price);
      setSelectedFolderId(editingItem.folderId || folders[0]?.id);
    } else {
      setName("");
      setPrice("");
      setSelectedFolderId(activeFolderId);
    }
  }, [editingItem, isModalOpen, activeFolderId, folders]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleExportRecipes = () => {
    try {
      const exportData: any = {
        storeId,
        folders,
        menuItems,
        recipes: {}
      };

      menuItems.forEach((item) => {
        const recipeData = localStorage.getItem(`recipe_${item.id}${userPrefix}`);
        if (recipeData) {
          try {
            exportData.recipes[item.id] = JSON.parse(recipeData);
          } catch {
            exportData.recipes[item.id] = [];
          }
        }
      });

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `recipes-backup-${currentUser?.username}-${today}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      alert("All recipes data exported successfully!");
    } catch (e) {
      alert("Failed to export recipes data.");
      console.error(e);
    }
  };

  const handleImportRecipes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        if (Array.isArray(json.folders) && json.folders.length > 0) {
          setFolders(json.folders);
          setActiveFolderId(json.folders[0].id);
        }

        if (Array.isArray(json.menuItems)) {
          setMenuItems(json.menuItems);
        }

        if (json.recipes && typeof json.recipes === "object") {
          Object.keys(json.recipes).forEach((menuId) => {
            const recipeList = json.recipes[menuId];
            localStorage.setItem(`recipe_${menuId}${userPrefix}`, JSON.stringify(recipeList));
          });
        }

        alert("All recipes & folders imported successfully!");
      } catch (err) {
        alert("Failed to parse the backup file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;

    if (editingFolder) {
      setFolders(folders.map(f => f.id === editingFolder.id ? { ...f, name: folderNameInput } : f));
    } else {
      const newFld: MenuFolder = {
        id: `fld_${Date.now()}`,
        name: folderNameInput
      };
      setFolders([...folders, newFld]);
      setActiveFolderId(newFld.id);
    }
    setIsFolderModalOpen(false);
    setEditingFolder(null);
    setFolderNameInput("");
  };

  const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (folders.length <= 1) {
      alert("You must keep at least one folder.");
      return;
    }
    if (confirm("Delete this folder? Recipes inside will be deleted.")) {
      const nextFolders = folders.filter(f => f.id !== id);
      setFolders(nextFolders);
      if (activeFolderId === id) setActiveFolderId(nextFolders[0].id);
    }
  };

  const handleCreateOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === "") return;

    if (editingItem) {
      setMenuItems(menuItems.map(item =>
        item.id === editingItem.id ? { ...item, name, price: Number(price), folderId: selectedFolderId } : item
      ));
    } else {
      const newItem: MenuItem = {
        id: Date.now().toString(),
        name,
        price: Number(price),
        folderId: selectedFolderId
      };
      setMenuItems([...menuItems, newItem]);
    }
    closeModal();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this menu item?")) {
      setMenuItems(menuItems.filter(item => item.id !== id));
      localStorage.removeItem(`recipe_${id}${userPrefix}`);
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    const matchesFolder = item.folderId === activeFolderId;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Recipe & Menu Folders</h1>
            <p className="text-gray-500 text-sm">Organize recipes into clean custom folders.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportRecipes} className="hidden" />

          <Button variant="outline" onClick={handleExportRecipes} className="flex items-center gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
            <Download size={16} /> Export JSON
          </Button>

          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
            <Upload size={16} /> Import JSON
          </Button>

          <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white">
            <Plus size={16} /> Add Recipe / Menu
          </Button>
        </div>
      </div>

      {/* 폴더 탭 영역 */}
      <div className="space-y-2 border-b pb-4">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipe Folders</p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { setEditingFolder(null); setFolderNameInput(""); setIsFolderModalOpen(true); }} 
            className="text-xs flex items-center gap-1 text-blue-600 font-semibold"
          >
            <FolderPlus size={14} /> New Recipe Folder
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {folders.map((fld) => (
            <div
              key={fld.id}
              onClick={() => setActiveFolderId(fld.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer border transition-all ${
                activeFolderId === fld.id ? "bg-slate-900 text-white border-slate-900 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              <Folder size={16} />
              <span>{fld.name}</span>
              <div className="flex gap-1 ml-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingFolder(fld); setFolderNameInput(fld.name); setIsFolderModalOpen(true); }} 
                  className="hover:text-blue-400 p-0.5"
                >
                  <Edit size={13} />
                </button>
                <button onClick={(e) => handleDeleteFolder(fld.id, e)} className="hover:text-red-400 p-0.5">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 실시간 알파벳 검색창 */}
      <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-200 shadow-sm">
        <Search size={18} className="text-slate-400 ml-1" />
        <input 
          type="text" 
          placeholder="Search recipe by alphabet (e.g. Soup, Beef, Kimchi)..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="w-full outline-none text-sm text-slate-800 bg-transparent placeholder:text-slate-400" 
        />
      </div>

      {/* 한 줄 리스트 (원가, 마진, 마진율 한눈에 보기) */}
      <div className="space-y-3">
        {filteredMenuItems.map((item) => {
          // 해당 레시피에 저장된 재료 데이터를 불러와 실시간 원가/마진 계산
          const savedRecipe = localStorage.getItem(`recipe_${item.id}${userPrefix}`);
          const recipeIngredients = savedRecipe ? JSON.parse(savedRecipe) : [];
          const totalFoodCost = recipeIngredients.reduce((sum: number, ri: any) => sum + (ri.totalCost || 0), 0);
          const sellingPrice = item.price || 0;
          const marginDollar = sellingPrice - totalFoodCost;
          const marginRatio = sellingPrice > 0 ? (marginDollar / sellingPrice) * 100 : 0;

          return (
            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-4">
              
              {/* 좌측: 레시피 이름 및 판매가 */}
              <div className="space-y-1 pl-1 min-w-[200px]">
                <h3 className="text-base font-black text-slate-900 tracking-tight">{item.name}</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Selling: <span className="text-slate-900 font-bold">${sellingPrice.toFixed(2)} AUD</span>
                </p>
              </div>

              {/* 중앙: 원가, 마진, 마진율 요약 정보 */}
              <div className="flex items-center gap-6 px-4 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <p className="text-slate-400 font-medium">Food Cost</p>
                  <p className="font-bold text-red-500 text-sm">${totalFoodCost.toFixed(2)}</p>
                </div>
                <div className="border-l pl-6 border-slate-200">
                  <p className="text-slate-400 font-medium">Margin ($)</p>
                  <p className="font-bold text-blue-600 text-sm">${marginDollar.toFixed(2)}</p>
                </div>
                <div className="border-l pl-6 border-slate-200">
                  <p className="text-slate-400 font-medium">Margin Ratio</p>
                  <p className="font-bold text-emerald-600 text-sm">{marginRatio.toFixed(1)}%</p>
                </div>
              </div>

              {/* 우측: 작은 정사각형 View 버튼 + 수정/삭제 아이콘 */}
              <div className="flex items-center gap-2">
                <Link href={`/menu-items/${item.id}`}>
                  <Button title="View Recipe & Cost Analysis" className="bg-slate-900 hover:bg-slate-800 text-white w-10 h-10 p-0 rounded-xl flex items-center justify-center shadow-xs">
                    <Calculator size={18} />
                  </Button>
                </Link>

                <div className="flex items-center gap-1 border-l pl-2 border-slate-200">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="text-slate-500 hover:text-slate-900 h-9 w-9 rounded-lg">
                    <Edit size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => handleDelete(item.id, e)} className="text-red-400 hover:text-red-600 h-9 w-9 rounded-lg">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredMenuItems.length === 0 && (
          <div className="py-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
            No recipes found in this folder. Click "+ Add Recipe / Menu" to create one.
          </div>
        )}
      </div>

      {/* 폴더 추가/수정 모달 */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold">{editingFolder ? "Rename Folder" : "New Recipe Folder"}</h2>
            <form onSubmit={handleSaveFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Folder Name</label>
                <Input value={folderNameInput} onChange={(e) => setFolderNameInput(e.target.value)} placeholder="e.g. Stove, Wok" required className="rounded-xl" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsFolderModalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 메뉴 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold">{editingItem ? "Edit Recipe Item" : "Add New Recipe Item"}</h2>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recipe Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kimchi Stew" required className="rounded-xl" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Folder Category</label>
                <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white h-11 outline-none">
                  {folders.map(fld => (
                    <option key={fld.id} value={fld.id}>{fld.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price ($ AUD)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="18.50"
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeModal} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">{editingItem ? "Save Changes" : "Add Recipe"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}