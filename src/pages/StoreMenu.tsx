import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import {
  Plus, ArrowRight, Edit, Trash2, UtensilsCrossed,
  Pencil, ChevronLeft, Search, PackageOpen,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CostStatusBadge } from "@/components/CostStatusBadge";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useGetStore,
  useListMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useListMenuCategories,
  useCreateMenuCategory,
  useRenameMenuCategory,
  useDeleteMenuCategory,
  getListMenuItemsQueryKey,
  getListMenuCategoriesQueryKey,
  type MenuItem,
  type MenuItemCategory,
} from "@workspace/api-client-react";

// ── Colour palette (same as Master Ingredients) ───────────────────────────────
const COLOR_PALETTE = [
  { bg: "bg-green-50",  border: "border-green-200"  },
  { bg: "bg-red-50",    border: "border-red-200"    },
  { bg: "bg-blue-50",   border: "border-blue-200"   },
  { bg: "bg-yellow-50", border: "border-yellow-200" },
  { bg: "bg-sky-50",    border: "border-sky-200"    },
  { bg: "bg-orange-50", border: "border-orange-200" },
  { bg: "bg-amber-50",  border: "border-amber-200"  },
  { bg: "bg-zinc-50",   border: "border-zinc-200"   },
];
function categoryColor(index: number) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

export default function StoreMenu() {
  const params = useParams<{ storeId: string }>();
  const storeId = parseInt(params.storeId || "0");
  const queryClient = useQueryClient();

  const { data: store } = useGetStore(storeId);
  const { data: menuItems, isLoading: loadingItems } = useListMenuItems(storeId);
  const { data: categories, isLoading: loadingCats } = useListMenuCategories(storeId);

  // ── Navigation ─────────────────────────────────────────────────────────────
  // null = category grid; -1 = uncategorized; n = category id
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Category modals ────────────────────────────────────────────────────────
  const [isCreateCatOpen, setIsCreateCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🍽️");

  const [renamingCat, setRenamingCat] = useState<MenuItemCategory | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameEmojiValue, setRenameEmojiValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [deletingCat, setDeletingCat] = useState<MenuItemCategory | null>(null);

  // ── Menu item modal ────────────────────────────────────────────────────────
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("Uncategorized");
  const [sellingPrice, setSellingPrice] = useState("");

  // ── Derived data ───────────────────────────────────────────────────────────
  const isUncategorizedView = selectedCategoryId === -1;

  const knownCategoryNames = useMemo(
    () => new Set((categories ?? []).map((c) => c.name)),
    [categories],
  );

  const uncategorizedItems = useMemo(
    () => (menuItems ?? []).filter(
      (i) => i.category === "Uncategorized" || !knownCategoryNames.has(i.category),
    ),
    [menuItems, knownCategoryNames],
  );

  const selectedCategory = useMemo(
    () => (categories ?? []).find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of menuItems ?? []) {
      map[item.category] = (map[item.category] ?? 0) + 1;
    }
    return map;
  }, [menuItems]);

  const detailItems = useMemo(() => {
    let base: MenuItem[];
    if (isUncategorizedView) {
      base = [...uncategorizedItems];
    } else if (selectedCategory) {
      base = (menuItems ?? []).filter((i) => i.category === selectedCategory.name);
    } else {
      return [];
    }
    const sorted = base.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.trim().toLowerCase();
    return sorted.filter((i) => i.name.toLowerCase().includes(q));
  }, [menuItems, selectedCategory, isUncategorizedView, uncategorizedItems, searchQuery]);

  const catIndex = isUncategorizedView
    ? -1
    : (categories ?? []).findIndex((c) => c.id === selectedCategoryId);
  const { bg: catBg, border: catBorder } =
    catIndex >= 0 ? categoryColor(catIndex) : { bg: "bg-zinc-100", border: "border-zinc-300" };
  const detailEmoji = isUncategorizedView ? "📂" : selectedCategory?.emoji ?? "";
  const detailName  = isUncategorizedView ? "Uncategorized" : selectedCategory?.name ?? "";
  const inCatTotal  = isUncategorizedView
    ? uncategorizedItems.length
    : (menuItems ?? []).filter((i) => i.category === selectedCategory?.name).length;

  const defaultCategoryForNew = useMemo(() => {
    if (isUncategorizedView) return "Uncategorized";
    return selectedCategory?.name ?? "Uncategorized";
  }, [isUncategorizedView, selectedCategory]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (editingItem) {
      setItemName(editingItem.name);
      setItemCategory(editingItem.category);
      setSellingPrice(editingItem.sellingPrice.toString());
    } else {
      setItemName("");
      setItemCategory(defaultCategoryForNew);
      setSellingPrice("");
    }
  }, [editingItem, defaultCategoryForNew]);

  useEffect(() => {
    if (renamingCat) {
      setRenameValue(renamingCat.name);
      setRenameEmojiValue(renamingCat.emoji);
      setTimeout(() => renameInputRef.current?.select(), 50);
    }
  }, [renamingCat]);

  useEffect(() => { setSearchQuery(""); }, [selectedCategoryId]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey(storeId) });
    queryClient.invalidateQueries({ queryKey: getListMenuCategoriesQueryKey(storeId) });
  };

  const { mutate: createItem, isPending: isCreating } = useCreateMenuItem({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey(storeId) }); closeItemModal(); } },
  });
  const { mutate: updateItem, isPending: isUpdating } = useUpdateMenuItem({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey(storeId) }); closeItemModal(); } },
  });
  const { mutate: deleteItem } = useDeleteMenuItem({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey(storeId) }) },
  });

  const { mutate: createCatMutation, isPending: isCreatingCat } = useCreateMenuCategory({
    mutation: {
      onSuccess: (created) => {
        invalidateAll();
        toast({ title: "Category created", description: `"${created.name}" is ready to use.` });
        setIsCreateCatOpen(false);
        setNewCatName("");
        setNewCatEmoji("🍽️");
        setSelectedCategoryId(created.id);
      },
      onError: () => toast({ title: "Create failed", description: "That name may already be in use.", variant: "destructive" }),
    },
  });
  const { mutate: renameCatMutation, isPending: isRenaming } = useRenameMenuCategory({
    mutation: {
      onSuccess: (updated) => {
        invalidateAll();
        toast({ title: "Category updated", description: `Saved as "${updated.name}".` });
        setRenamingCat(null);
      },
      onError: () => toast({ title: "Update failed", description: "That name may already be in use.", variant: "destructive" }),
    },
  });
  const { mutate: deleteCatMutation, isPending: isDeleting } = useDeleteMenuCategory({
    mutation: {
      onSuccess: () => {
        const name = deletingCat?.name ?? "Category";
        invalidateAll();
        toast({ title: `"${name}" deleted`, description: "Dishes moved to Uncategorized." });
        setDeletingCat(null);
        setSelectedCategoryId(null);
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectCategory = (id: number) => { setSelectedCategoryId(id); };
  const handleBack = () => { setSelectedCategoryId(null); };

  const openRename = (e: React.MouseEvent, cat: MenuItemCategory) => {
    e.stopPropagation();
    setRenamingCat(cat);
  };
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingCat || !renameValue.trim()) return;
    renameCatMutation({ storeId, id: renamingCat.id, data: { name: renameValue.trim(), emoji: renameEmojiValue.trim() || "🍽️" } });
  };

  const handleDeleteCatClick = (e: React.MouseEvent, cat: MenuItemCategory) => {
    e.stopPropagation();
    const count = countByCategory[cat.name] ?? 0;
    if (count === 0) deleteCatMutation({ storeId, id: cat.id });
    else setDeletingCat(cat);
  };

  const openNewItem = () => { setEditingItem(null); setIsItemModalOpen(true); };
  const openEditItem = (item: MenuItem) => { setEditingItem(item); setIsItemModalOpen(true); };
  const closeItemModal = () => { setIsItemModalOpen(false); setEditingItem(null); };

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !sellingPrice) return;
    const data = {
      name: itemName.trim(),
      category: itemCategory || "Uncategorized",
      sellingPrice: parseFloat(sellingPrice),
    };
    if (editingItem) updateItem({ storeId, id: editingItem.id, data });
    else createItem({ storeId, data });
  };

  const handleDeleteItem = (id: number) => {
    if (window.confirm("Delete this menu item?")) deleteItem({ storeId, id });
  };

  const isLoading = loadingItems || loadingCats;

  // ── Shared modals ─────────────────────────────────────────────────────────
  const deleteCount = deletingCat ? (countByCategory[deletingCat.name] ?? 0) : 0;

  const renameModal = (
    <Modal isOpen={!!renamingCat} onClose={() => setRenamingCat(null)} title={`Edit "${renamingCat?.name}"`}>
      <form onSubmit={handleRenameSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Emoji</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl border border-zinc-200 bg-zinc-50 text-3xl shrink-0">
              {renameEmojiValue || "🍽️"}
            </div>
            <Input
              value={renameEmojiValue}
              onChange={(e) => setRenameEmojiValue(e.target.value)}
              placeholder="Type or paste an emoji"
              className="flex-1"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Category name</label>
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="e.g. Dinner Menu"
            required
          />
          <p className="text-xs text-zinc-500 mt-1.5">All dishes in this category will be updated automatically.</p>
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={() => setRenamingCat(null)} disabled={isRenaming}>Cancel</Button>
          <Button type="submit" disabled={isRenaming || !renameValue.trim()}>
            {isRenaming ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );

  const createCatModal = (
    <Modal isOpen={isCreateCatOpen} onClose={() => setIsCreateCatOpen(false)} title="New Category">
      <form onSubmit={(e) => { e.preventDefault(); if (!newCatName.trim()) return; createCatMutation({ storeId, data: { name: newCatName.trim(), emoji: newCatEmoji.trim() || "🍽️" } }); }} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Emoji</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl border border-zinc-200 bg-zinc-50 text-3xl shrink-0">
              {newCatEmoji || "🍽️"}
            </div>
            <Input
              value={newCatEmoji}
              onChange={(e) => setNewCatEmoji(e.target.value)}
              placeholder="Type or paste an emoji"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">Tip: open your OS emoji picker with ⌘+Ctrl+Space (Mac) or Win+. (Windows).</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Category name</label>
          <Input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="e.g. Dinner Menu"
            required
            autoFocus
          />
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={() => setIsCreateCatOpen(false)} disabled={isCreatingCat}>Cancel</Button>
          <Button type="submit" disabled={isCreatingCat || !newCatName.trim()}>
            {isCreatingCat ? "Creating…" : "Create Category"}
          </Button>
        </div>
      </form>
    </Modal>
  );

  const deleteCatModal = (
    <Modal isOpen={!!deletingCat} onClose={() => setDeletingCat(null)} title="Delete Category?">
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <Trash2 className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900">
            <strong>"{deletingCat?.name}"</strong> has{" "}
            <strong>{deleteCount} dish{deleteCount !== 1 ? "es" : ""}</strong>.
            They will be moved to <strong>Uncategorized</strong> — not deleted.
          </p>
        </div>
        <p className="text-sm text-zinc-500">The category will be removed but all dishes remain intact.</p>
        <div className="pt-2 flex justify-end gap-3 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={() => setDeletingCat(null)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={() => deletingCat && deleteCatMutation({ storeId, id: deletingCat.id })} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete Category"}
          </Button>
        </div>
      </div>
    </Modal>
  );

  const itemModal = (
    <Modal isOpen={isItemModalOpen} onClose={closeItemModal} title={editingItem ? "Edit Menu Item" : `Add to ${detailName}`}>
      <form onSubmit={handleItemSubmit} className="space-y-5">
        {/* Category indicator / selector */}
        {editingItem ? (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Category</label>
            <select
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="Uncategorized">📂 Uncategorized</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${catBg} border ${catBorder}`}>
            <span className="text-lg">{detailEmoji}</span>
            <span className="text-sm font-medium text-zinc-700">{detailName}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Dish Name</label>
          <Input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. Classic Cheeseburger"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Selling Price ($)</label>
          <Input
            type="number"
            step="0.01"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            placeholder="e.g. 14.50"
            required
          />
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={closeItemModal}>Cancel</Button>
          <Button type="submit" disabled={isCreating || isUpdating}>
            {editingItem ? "Save Changes" : "Add Menu Item"}
          </Button>
        </div>
      </form>
    </Modal>
  );

  // ── GRID VIEW ─────────────────────────────────────────────────────────────
  if (selectedCategoryId === null) {
    return (
      <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Page header */}
        <div>
          <Link
            href="/stores"
            className="text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center mb-2 sm:mb-4 w-fit transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> Back to Stores
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 leading-tight">
                {store?.name ? `${store.name} Menu` : "Loading…"}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Select a category to manage dishes and view cost margins.</p>
            </div>
            <Button onClick={() => { setNewCatName(""); setNewCatEmoji("🍽️"); setIsCreateCatOpen(true); }} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> New Category
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-zinc-400 text-sm">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {(categories ?? []).map((cat, idx) => {
              const { bg, border } = categoryColor(idx);
              const count = countByCategory[cat.name] ?? 0;
              return (
                <div
                  key={cat.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectCategory(cat.id)}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectCategory(cat.id)}
                  className={`group relative text-left rounded-xl border ${bg} ${border} p-3 sm:p-4 hover:shadow-md transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900`}
                >
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => openRename(e, cat)}
                      className="p-1 rounded-lg hover:bg-white/70 text-zinc-400 hover:text-zinc-700 transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCatClick(e, cat)}
                      className="p-1 rounded-lg hover:bg-white/70 text-zinc-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-2xl mb-1.5">{cat.emoji}</div>
                  <div className="font-semibold text-zinc-900 text-xs sm:text-sm pr-8 leading-snug">{cat.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {count === 0 ? "No dishes" : `${count} dish${count !== 1 ? "es" : ""}`}
                  </div>
                  <div className="mt-2 text-xs font-medium text-zinc-400 group-hover:text-zinc-700 transition-colors">
                    Manage →
                  </div>
                </div>
              );
            })}

            {/* Uncategorized virtual card */}
            {uncategorizedItems.length > 0 && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelectCategory(-1)}
                onKeyDown={(e) => e.key === "Enter" && handleSelectCategory(-1)}
                className="group relative text-left rounded-xl border bg-zinc-100 border-zinc-300 border-dashed p-3 sm:p-4 hover:shadow-md transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <div className="text-2xl mb-1.5">📂</div>
                <div className="font-semibold text-zinc-500 text-xs sm:text-sm">Uncategorized</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {uncategorizedItems.length} dish{uncategorizedItems.length !== 1 ? "es" : ""} need a category
                </div>
                <div className="mt-2 text-xs font-medium text-zinc-400 group-hover:text-zinc-600 transition-colors">
                  Move to a category →
                </div>
              </div>
            )}

            {/* Empty state when no categories at all */}
            {(categories ?? []).length === 0 && uncategorizedItems.length === 0 && (
              <div className="col-span-full text-center py-12 sm:py-16">
                <UtensilsCrossed className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-zinc-900">No categories yet</h3>
                <p className="text-zinc-500 mt-1 mb-4 text-sm">Create a category to start organising your menu.</p>
                <Button onClick={() => { setNewCatName(""); setNewCatEmoji("🍽️"); setIsCreateCatOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> New Category
                </Button>
              </div>
            )}
          </div>
        )}

        {renameModal}
        {createCatModal}
        {deleteCatModal}
      </div>
    );
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-xs sm:text-sm text-zinc-500 hover:text-zinc-900 transition-colors w-fit"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> All Categories
          </button>
          <span className="text-zinc-300 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xl sm:text-2xl">{detailEmoji}</span>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 line-clamp-1">{detailName}</h1>
            <span className="text-xs sm:text-sm text-zinc-400 font-normal">({inCatTotal})</span>
          </div>
          <div className="flex items-center">
            {!isUncategorizedView && selectedCategory && (
              <button
                onClick={(e) => openRename(e, selectedCategory)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                title="Rename category"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {isUncategorizedView && (
              <span className="ml-2 text-xs text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full text-center">
                Edit a dish below to reassign its category
              </span>
            )}
          </div>
        </div>
        {!isUncategorizedView && (
          <Button onClick={openNewItem} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" /> Add Menu Item
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search in ${detailName}…`}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {inCatTotal === 0 ? (
          <div className="text-center py-10 sm:py-14 px-4">
            <div className="text-4xl sm:text-5xl mb-3">{detailEmoji}</div>
            <h3 className="text-base font-semibold text-zinc-900">No dishes in {detailName}</h3>
            {!isUncategorizedView && (
              <>
                <p className="text-zinc-500 mt-1 mb-4 text-sm">Add your first dish to this category.</p>
                <Button onClick={openNewItem} variant="outline" className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Add Menu Item
                </Button>
              </>
            )}
          </div>
        ) : detailItems.length === 0 ? (
          <div className="text-center py-8 px-4">
            <PackageOpen className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No dishes match <strong>"{searchQuery}"</strong></p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-zinc-100">
              {detailItems.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 text-sm truncate">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs text-zinc-500">{formatCurrency(item.sellingPrice)}</span>
                      <span className="text-xs text-zinc-400">Cost: {formatCurrency(item.totalIngredientCost)}</span>
                    </div>
                    <div className="mt-1.5">
                      <CostStatusBadge percentage={item.foodCostPercentage} />
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Link href={`/stores/${storeId}/menu/${item.id}`}>
                      <Button variant="ghost" size="sm" className="text-primary font-semibold px-2 h-8 text-xs">
                        Recipe
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => openEditItem(item)} className="h-8 w-8 text-zinc-500">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish Name</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Food Cost %</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-zinc-900">{item.name}</TableCell>
                      <TableCell className="text-zinc-600">{formatCurrency(item.sellingPrice)}</TableCell>
                      <TableCell className="text-zinc-600">{formatCurrency(item.totalIngredientCost)}</TableCell>
                      <TableCell>
                        <CostStatusBadge percentage={item.foodCostPercentage} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/stores/${storeId}/menu/${item.id}`}>
                            <Button variant="ghost" size="sm" className="text-primary font-semibold">
                              Recipe <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => openEditItem(item)} className="h-8 w-8 text-zinc-500 ml-2">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {renameModal}
      {createCatModal}
      {deleteCatModal}
      {itemModal}
    </div>
  );
}
