import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Edit, Trash2, Search, List, ChevronLeft, PackageOpen, Pencil, MoveRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatAmount, unitLabel, largeUnitLabel } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useListIngredients,
  useCreateIngredient,
  useUpdateIngredient,
  useDeleteIngredient,
  useListCategories,
  useCreateCategory,
  useRenameCategory,
  useDeleteCategory,
  useBulkMoveIngredients,
  getListIngredientsQueryKey,
  getListCategoriesQueryKey,
  type Ingredient,
  type Category,
} from "@workspace/api-client-react";

// Palette applied by position so colors stay stable when names change
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

interface ParsedEntry { name: string; unit: string; purchaseWeightGrams: number; purchasePrice: number; }

function parseBulkLine(line: string): ParsedEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?)\s+([\d.]+)\s*(kg|g|L|ml)\s+(?:AUD\s*)?([\d,]+(?:\.\d+)?)/i);
  if (!match) return null;
  const name = match[1].trim();
  const weightValue = parseFloat(match[2]);
  const rawUnit = match[3];
  const price = parseFloat(match[4].replace(/,/g, ""));
  if (!name || isNaN(weightValue) || isNaN(price) || weightValue <= 0 || price < 0) return null;
  const lu = rawUnit.toLowerCase();
  const isVolume = lu === "ml" || lu === "l";
  const unit = isVolume ? "ml" : "g";
  const purchaseWeightGrams = lu === "kg" ? weightValue * 1000 : lu === "l" ? weightValue * 1000 : weightValue;
  return { name, unit, purchaseWeightGrams, purchasePrice: price };
}

export default function Ingredients() {
  const queryClient = useQueryClient();

  const { data: ingredients, isLoading: loadingIngredients } = useListIngredients();
  const { data: categories, isLoading: loadingCategories } = useListCategories();

  // ── Navigation ────────────────────────────────────────────────────────────
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Category modals ───────────────────────────────────────────────────────
  const [renamingCategory, setRenamingCategory] = useState<Category | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameEmojiValue, setRenameEmojiValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // ── Create category modal ─────────────────────────────────────────────────
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📦");

  // ── Ingredient add/edit modal ─────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [ingName, setIngName] = useState("");
  const [ingUnit, setIngUnit] = useState<"g" | "ml">("g");
  const [ingWeight, setIngWeight] = useState("");
  const [ingPrice, setIngPrice] = useState("");
  const [ingYield, setIngYield] = useState("100");
  const [ingCategory, setIngCategory] = useState("");

  // ── Bulk add modal ────────────────────────────────────────────────────────
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // ── Bulk move (checkboxes) ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveTargetCategoryId, setMoveTargetCategoryId] = useState<string>("");

  // ── Mutations ─────────────────────────────────────────────────────────────

  // Invalidates all cached recipe costs across every store whenever ingredient
  // data changes (price, name, yield, or deletion). Uses a predicate because
  // menu-item query keys are URL strings that include the store ID, so a simple
  // prefix key cannot match them all at once.
  const invalidateRecipeCosts = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.includes("/menu-items");
      },
    });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    invalidateRecipeCosts();
  };

  const { mutate: createItem, isPending: isCreating, mutateAsync: createItemAsync } = useCreateIngredient({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() }); closeModal(); } },
  });
  const { mutate: updateItem, isPending: isUpdating, mutateAsync: updateItemAsync } = useUpdateIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
        invalidateRecipeCosts();
        closeModal();
      },
    },
  });
  const { mutate: deleteItem } = useDeleteIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
        invalidateRecipeCosts();
      },
    },
  });
  const { mutate: createCategoryMutation, isPending: isCreatingCategory } = useCreateCategory({
    mutation: {
      onSuccess: (created) => {
        invalidateAll();
        toast({ title: "Category created", description: `"${created.name}" is ready to use.` });
        setIsCreateCategoryOpen(false);
        setNewCatName("");
        setNewCatEmoji("📦");
      },
      onError: () => toast({ title: "Create failed", description: "Could not create category.", variant: "destructive" }),
    },
  });
  const { mutate: renameCategory, isPending: isRenaming } = useRenameCategory({
    mutation: {
      onSuccess: (updated) => {
        invalidateAll();
        toast({ title: "Category updated", description: `Saved as "${updated.name}".` });
        setRenamingCategory(null);
      },
      onError: () => toast({ title: "Update failed", description: "That name may already be in use.", variant: "destructive" }),
    },
  });
  const { mutate: deleteCategory, isPending: isDeleting } = useDeleteCategory({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        const name = deletingCategory?.name ?? "Category";
        toast({ title: `"${name}" deleted`, description: "All ingredients in that category were removed." });
        setDeletingCategory(null);
        setSelectedCategoryId(null);
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    },
  });
  const { mutate: bulkMove, isPending: isBulkMoving } = useBulkMoveIngredients({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
        const targetCat = (categories ?? []).find((c) => c.id === parseInt(moveTargetCategoryId));
        toast({ title: `${result.moved} ingredient${result.moved !== 1 ? "s" : ""} moved`, description: `Moved to "${targetCat?.name ?? "category"}".` });
        setSelectedIds(new Set());
        setMoveTargetCategoryId("");
      },
      onError: () => toast({ title: "Move failed", variant: "destructive" }),
    },
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const selectedCategory = useMemo(
    () => categories?.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const isUncategorizedView = selectedCategoryId === -1;

  const knownCategoryNames = useMemo(
    () => new Set((categories ?? []).map((c) => c.name)),
    [categories],
  );

  const orphanedIngredients = useMemo(
    () => (ingredients ?? []).filter((i) => !knownCategoryNames.has(i.category)),
    [ingredients, knownCategoryNames],
  );

  const categoryIngredients = useMemo(() => {
    let base: Ingredient[];
    if (isUncategorizedView) {
      base = [...orphanedIngredients];
    } else if (selectedCategory) {
      base = (ingredients ?? []).filter((i) => i.category === selectedCategory.name);
    } else {
      return [];
    }
    const sorted = base.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.trim().toLowerCase();
    return sorted.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, selectedCategory, isUncategorizedView, orphanedIngredients, searchQuery]);

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ing of ingredients ?? []) map[ing.category] = (map[ing.category] ?? 0) + 1;
    return map;
  }, [ingredients]);

  const allVisibleSelected =
    categoryIngredients.length > 0 && categoryIngredients.every((i) => selectedIds.has(i.id));

  const otherCategories = useMemo(
    () => (categories ?? []).filter((c) => c.id !== selectedCategoryId),
    [categories, selectedCategoryId],
  );

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (editingItem) {
      setIngName(editingItem.name);
      setIngUnit((editingItem.unit === "ml" ? "ml" : "g") as "g" | "ml");
      setIngWeight(editingItem.purchaseWeightGrams.toString());
      setIngPrice(editingItem.purchasePrice.toString());
      setIngYield((editingItem.yieldPercentage ?? 100).toString());
      setIngCategory(editingItem.category);
    } else {
      setIngName(""); setIngUnit("g"); setIngWeight(""); setIngPrice(""); setIngYield("100");
      setIngCategory(selectedCategory?.name ?? "Other");
    }
  }, [editingItem, selectedCategory]);

  useEffect(() => {
    if (renamingCategory) {
      setRenameValue(renamingCategory.name);
      setRenameEmojiValue(renamingCategory.emoji);
      setTimeout(() => renameInputRef.current?.select(), 50);
    }
  }, [renamingCategory]);

  // Clear selection when leaving a category
  useEffect(() => { setSelectedIds(new Set()); setMoveTargetCategoryId(""); }, [selectedCategoryId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openNewItem = () => { setEditingItem(null); setIsModalOpen(true); };
  const openEditItem = (item: Ingredient) => { setEditingItem(item); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditingItem(null); };
  const openBulkModal = () => { setBulkText(""); setIsBulkModalOpen(true); };
  const closeBulkModal = () => { setIsBulkModalOpen(false); setBulkText(""); };

  const handleSelectCategory = (id: number) => { setSelectedCategoryId(id); setSearchQuery(""); };
  const handleBack = () => { setSelectedCategoryId(null); setSearchQuery(""); };

  const openRename = (e: React.MouseEvent, cat: Category) => { e.stopPropagation(); setRenamingCategory(cat); };
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingCategory || !renameValue.trim()) return;
    renameCategory({
      id: renamingCategory.id,
      data: { name: renameValue.trim(), emoji: renameEmojiValue.trim() || "📦" },
    });
  };

  const openCreateCategory = () => { setNewCatName(""); setNewCatEmoji("📦"); setIsCreateCategoryOpen(true); };
  const handleCreateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    createCategoryMutation({ data: { name: newCatName.trim(), emoji: newCatEmoji.trim() || "📦" } });
  };

  const handleDeleteCategoryClick = (e: React.MouseEvent, cat: Category) => {
    e.stopPropagation();
    const count = countByCategory[cat.name] ?? 0;
    if (count === 0) {
      deleteCategory({ id: cat.id });
    } else {
      setDeletingCategory(cat);
    }
  };
  const confirmDeleteCategory = () => {
    if (deletingCategory) deleteCategory({ id: deletingCategory.id });
  };

  const handleIngredientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingName.trim() || !ingWeight || !ingPrice) return;
    const yp = Math.min(100, Math.max(1, parseFloat(ingYield) || 100));
    const data = { name: ingName, category: ingCategory || selectedCategory?.name || "Other", unit: ingUnit, purchaseWeightGrams: parseFloat(ingWeight), purchasePrice: parseFloat(ingPrice), yieldPercentage: yp };
    if (editingItem) updateItem({ id: editingItem.id, data });
    else createItem({ data });
  };

  const handleBulkSubmit = async () => {
    const lines = bulkText.split("\n");
    const failedLines: number[] = [];
    let createdCount = 0, updatedCount = 0;
    setIsBulkProcessing(true);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const parsed = parseBulkLine(lines[i]);
      if (!parsed) { failedLines.push(i + 1); continue; }
      try {
        const existing = ingredients?.find((ing) => ing.name.trim().toLowerCase() === parsed.name.trim().toLowerCase());
        const fullData = { ...parsed, category: selectedCategory?.name ?? "Other" };
        const fullDataWithYield = { ...fullData, yieldPercentage: existing?.yieldPercentage ?? 100 };
        if (existing) { await updateItemAsync({ id: existing.id, data: fullDataWithYield }); updatedCount++; }
        else { await createItemAsync({ data: { ...fullData, yieldPercentage: 100 } }); createdCount++; }
      } catch { failedLines.push(i + 1); }
    }
    await queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
    setIsBulkProcessing(false);
    const total = createdCount + updatedCount;
    if (total > 0) {
      const parts: string[] = [];
      if (createdCount > 0) parts.push(`${createdCount} added`);
      if (updatedCount > 0) parts.push(`${updatedCount} updated`);
      toast({ title: `${total} ingredient${total > 1 ? "s" : ""} processed`, description: `${parts.join(", ")} in ${selectedCategory?.name}.` });
    }
    if (failedLines.length > 0) toast({ title: `${failedLines.length} line${failedLines.length > 1 ? "s" : ""} skipped`, description: `Could not parse line${failedLines.length > 1 ? "s" : ""} ${failedLines.join(", ")}.`, variant: "destructive" });
    closeBulkModal();
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this ingredient? This may affect existing recipes.")) deleteItem({ id });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(categoryIngredients.map((i) => i.id)));
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkMove = () => {
    if (!moveTargetCategoryId || selectedIds.size === 0) return;
    const targetCat = (categories ?? []).find((c) => c.id === parseInt(moveTargetCategoryId));
    if (!targetCat) return;
    bulkMove({ data: { ids: Array.from(selectedIds), targetCategory: targetCat.name } });
  };

  const isLoading = loadingIngredients || loadingCategories;

  // ── Shared rename modal ───────────────────────────────────────────────────
  const renameModal = (
    <Modal isOpen={!!renamingCategory} onClose={() => setRenamingCategory(null)} title={`Edit "${renamingCategory?.name}"`}>
      <form onSubmit={handleRenameSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Emoji</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl border border-zinc-200 bg-zinc-50 text-3xl shrink-0">
              {renameEmojiValue || "📦"}
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
          <Input ref={renameInputRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="e.g. Fresh Produce" required />
          <p className="text-xs text-zinc-500 mt-1.5">All existing ingredients will be updated automatically.</p>
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={() => setRenamingCategory(null)} disabled={isRenaming}>Cancel</Button>
          <Button type="submit" disabled={isRenaming || !renameValue.trim()}>{isRenaming ? "Saving…" : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );

  // ── Create category modal ─────────────────────────────────────────────────
  const createCategoryModal = (
    <Modal isOpen={isCreateCategoryOpen} onClose={() => setIsCreateCategoryOpen(false)} title="New Category">
      <form onSubmit={handleCreateCategorySubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Emoji</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl border border-zinc-200 bg-zinc-50 text-3xl shrink-0">
              {newCatEmoji || "📦"}
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
            placeholder="e.g. Fresh Produce"
            required
            autoFocus
          />
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={() => setIsCreateCategoryOpen(false)} disabled={isCreatingCategory}>Cancel</Button>
          <Button type="submit" disabled={isCreatingCategory || !newCatName.trim()}>
            {isCreatingCategory ? "Creating…" : "Create Category"}
          </Button>
        </div>
      </form>
    </Modal>
  );

  // ── Delete category confirmation modal ────────────────────────────────────
  const deleteCount = deletingCategory ? (countByCategory[deletingCategory.name] ?? 0) : 0;
  const deleteCategoryModal = (
    <Modal isOpen={!!deletingCategory} onClose={() => setDeletingCategory(null)} title="Delete Category?">
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <Trash2 className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800">
            <strong>"{deletingCategory?.name}"</strong> contains{" "}
            <strong>{deleteCount} ingredient{deleteCount !== 1 ? "s" : ""}</strong>.
            All of them will be permanently deleted along with the category.
          </p>
        </div>
        <p className="text-sm text-zinc-500">This cannot be undone. Consider moving ingredients to another category first.</p>
        <div className="pt-2 flex justify-end gap-3 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={() => setDeletingCategory(null)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={confirmDeleteCategory} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : `Delete & Remove ${deleteCount} Ingredient${deleteCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>
    </Modal>
  );

  // ── Category Grid ─────────────────────────────────────────────────────────
  if (selectedCategoryId === null) {
    return (
      <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Master Ingredients</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Shared ingredient database across all stores. Select a category to manage.</p>
          </div>
          <Button onClick={openCreateCategory} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" /> New Category
          </Button>
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
                  {/* Card action buttons — appear on hover */}
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => openRename(e, cat)}
                      className="p-1 rounded-lg hover:bg-white/70 text-zinc-400 hover:text-zinc-700 transition-colors"
                      title="Rename category"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCategoryClick(e, cat)}
                      className="p-1 rounded-lg hover:bg-white/70 text-zinc-400 hover:text-red-600 transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-2xl mb-1.5">{cat.emoji}</div>
                  <div className="font-semibold text-zinc-900 text-xs sm:text-sm pr-8 leading-snug">{cat.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {count === 0 ? "No ingredients" : `${count} ingredient${count > 1 ? "s" : ""}`}
                  </div>
                  <div className="mt-2 text-xs font-medium text-zinc-400 group-hover:text-zinc-700 transition-colors">
                    Manage →
                  </div>
                </div>
              );
            })}

            {/* Virtual "Uncategorized" card — only shown when there are orphaned ingredients */}
            {orphanedIngredients.length > 0 && (
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
                  {orphanedIngredients.length} ingredient{orphanedIngredients.length > 1 ? "s" : ""} need a category
                </div>
                <div className="mt-2 text-xs font-medium text-zinc-400 group-hover:text-zinc-600 transition-colors">
                  Move to a category →
                </div>
              </div>
            )}
          </div>
        )}

        {renameModal}
        {deleteCategoryModal}
        {createCategoryModal}
      </div>
    );
  }

  // ── Category Detail ───────────────────────────────────────────────────────
  const inCatTotal = isUncategorizedView
    ? orphanedIngredients.length
    : (ingredients ?? []).filter((i) => i.category === selectedCategory?.name).length;
  const catIndex = isUncategorizedView ? -1 : (categories ?? []).findIndex((c) => c.id === selectedCategoryId);
  const { bg: catBg, border: catBorder } = catIndex >= 0 ? categoryColor(catIndex) : { bg: "bg-zinc-100", border: "border-zinc-300" };

  const detailEmoji = isUncategorizedView ? "📂" : selectedCategory?.emoji ?? "";
  const detailName  = isUncategorizedView ? "Uncategorized" : selectedCategory?.name ?? "";

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleBack} className="flex items-center gap-1 text-xs sm:text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> All Categories
          </button>
          <span className="text-zinc-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xl sm:text-2xl">{detailEmoji}</span>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">{detailName}</h1>
            <span className="text-xs sm:text-sm text-zinc-400 font-normal">({inCatTotal})</span>
          </div>
          {!isUncategorizedView && selectedCategory && (
            <button
              onClick={(e) => openRename(e, selectedCategory)}
              className="ml-1 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              title="Rename category"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {isUncategorizedView && (
            <span className="ml-2 text-xs text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full">
              Select items below and move them to a category
            </span>
          )}
        </div>
        {!isUncategorizedView && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button variant="outline" onClick={openBulkModal} className="w-full sm:w-auto"><List className="w-4 h-4 mr-2" /> Bulk Add</Button>
            <Button onClick={openNewItem} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Add Ingredient</Button>
          </div>
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

      {/* Bulk-move action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 text-white">
          <div className="flex items-center gap-2 shrink-0">
            <MoveRight className="w-4 h-4" />
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <span className="text-zinc-400 text-sm">→</span>
          </div>
          <select
            value={moveTargetCategoryId}
            onChange={(e) => setMoveTargetCategoryId(e.target.value)}
            className="flex-1 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white"
          >
            <option value="">Move to…</option>
            {otherCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleBulkMove}
              disabled={!moveTargetCategoryId || isBulkMoving}
              className="bg-white text-zinc-900 hover:bg-zinc-100"
            >
              {isBulkMoving ? "Moving…" : "Move"}
            </Button>
            <button
              onClick={() => { setSelectedIds(new Set()); setMoveTargetCategoryId(""); }}
              className="text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {inCatTotal === 0 ? (
          <div className="text-center py-10 sm:py-14 px-4">
            <div className="text-4xl sm:text-5xl mb-3">{detailEmoji}</div>
            <h3 className="text-base font-semibold text-zinc-900">No ingredients in {detailName}</h3>
            {!isUncategorizedView && (
              <>
                <p className="text-zinc-500 mt-1 mb-4 text-sm">Add your first ingredient to this category.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Button onClick={openNewItem} variant="outline" className="w-full sm:w-auto">Add Ingredient</Button>
                  <Button onClick={openBulkModal} variant="outline" className="w-full sm:w-auto"><List className="w-4 h-4 mr-2" /> Bulk Add</Button>
                </div>
              </>
            )}
          </div>
        ) : categoryIngredients.length === 0 ? (
          <div className="text-center py-8 px-4">
            <PackageOpen className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No ingredients match <strong>"{searchQuery}"</strong></p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-zinc-100">
              {categoryIngredients.map((item) => (
                <div key={item.id} className={`px-4 py-3 flex items-start gap-3 ${selectedIds.has(item.id) ? "bg-zinc-50" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelectId(item.id)}
                    className="rounded border-zinc-300 accent-zinc-900 cursor-pointer mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 text-sm truncate">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-xs text-zinc-500">{formatAmount(item.purchaseWeightGrams, item.unit)}</span>
                      <span className="text-xs text-zinc-500">{formatCurrency(item.purchasePrice)}</span>
                      <span className="text-xs text-zinc-400">{formatCurrency(item.costPerKg)}/{largeUnitLabel(item.unit)}</span>
                    </div>
                    {item.yieldPercentage < 100 && (
                      <span className="inline-flex mt-1 items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {item.yieldPercentage}% yield
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEditItem(item)} className="h-8 w-8 text-zinc-500">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
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
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-zinc-300 accent-zinc-900 cursor-pointer"
                        title="Select all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Purchase Amount</TableHead>
                    <TableHead>Yield %</TableHead>
                    <TableHead>Usable Weight</TableHead>
                    <TableHead>Purchase Price</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Bulk Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryIngredients.map((item) => (
                    <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-zinc-50" : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectId(item.id)}
                          className="rounded border-zinc-300 accent-zinc-900 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-zinc-900">{item.name}</TableCell>
                      <TableCell className="text-zinc-600">{formatAmount(item.purchaseWeightGrams, item.unit)}</TableCell>
                      <TableCell>
                        {item.yieldPercentage < 100 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {item.yieldPercentage}%
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">100%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {item.yieldPercentage < 100 ? (
                          <span className="font-medium text-amber-700">{formatAmount(item.usableWeightGrams, item.unit)}</span>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-600">{formatCurrency(item.purchasePrice)}</TableCell>
                      <TableCell className="text-zinc-600">{formatCurrency(item.costPerGram)}/{unitLabel(item.unit)}</TableCell>
                      <TableCell className="font-semibold text-zinc-900">{formatCurrency(item.costPerKg)}/{largeUnitLabel(item.unit)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditItem(item)} className="h-8 w-8 text-zinc-500">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
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
      {deleteCategoryModal}
      {createCategoryModal}

      {/* Single add/edit ingredient modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingItem ? "Edit Ingredient" : `Add to ${detailName}`}>
        <form onSubmit={handleIngredientSubmit} className="space-y-5">
          {editingItem ? (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Category</label>
              <select
                value={ingCategory}
                onChange={(e) => setIngCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
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
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Ingredient Name</label>
            <Input value={ingName} onChange={(e) => setIngName(e.target.value)} placeholder="e.g. Cherry Tomatoes" required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Unit Type</label>
            <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setIngUnit("g")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${ingUnit === "g" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
              >
                ⚖️ Weight (g / kg)
              </button>
              <button
                type="button"
                onClick={() => setIngUnit("ml")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${ingUnit === "ml" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
              >
                💧 Volume (ml / L)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Total Purchase Amount ({ingUnit === "ml" ? "ml" : "g"})
            </label>
            <Input type="number" value={ingWeight} onChange={(e) => setIngWeight(e.target.value)} placeholder={ingUnit === "ml" ? "e.g. 1000" : "e.g. 5000"} required />
            <p className="text-xs text-zinc-500 mt-1">{ingUnit === "ml" ? "1 L = 1000 ml" : "1 kg = 1000 g"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Yield %</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="100"
                step="1"
                value={ingYield}
                onChange={(e) => setIngYield(e.target.value)}
                placeholder="100"
                className="w-28"
              />
              <span className="text-sm text-zinc-500">%</span>
              {(() => {
                const w = parseFloat(ingWeight);
                const y = parseFloat(ingYield);
                if (w > 0 && y > 0 && y < 100) {
                  const usable = w * (y / 100);
                  return (
                    <span className="text-sm text-amber-700 font-medium">
                      → {ingUnit === "ml" ? (usable >= 1000 ? `${(usable / 1000).toFixed(2)}L` : `${usable.toFixed(0)}ml`) : (usable >= 1000 ? `${(usable / 1000).toFixed(2)}kg` : `${usable.toFixed(0)}g`)} usable
                    </span>
                  );
                }
                return <span className="text-xs text-zinc-400">No waste (100% usable)</span>;
              })()}
            </div>
            <p className="text-xs text-zinc-500 mt-1.5">Accounts for trimming, peeling, or cooking loss. Costs are calculated on usable weight only.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Total Purchase Price (AUD)</label>
            <Input type="number" step="0.01" value={ingPrice} onChange={(e) => setIngPrice(e.target.value)} placeholder="e.g. 15.99" required />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isCreating || isUpdating}>{editingItem ? "Save Changes" : "Add Ingredient"}</Button>
          </div>
        </form>
      </Modal>

      {/* Bulk add modal */}
      <Modal isOpen={isBulkModalOpen} onClose={closeBulkModal} title={`Bulk Add to ${detailName}`}>
        <div className="space-y-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${catBg} border ${catBorder}`}>
            <span className="text-lg">{detailEmoji}</span>
            <span className="text-sm text-zinc-600">All entries will be added to <strong>{detailName}</strong></span>
          </div>
          <div>
            <p className="text-sm text-zinc-600 mb-2">Enter one ingredient per line:</p>
            <ul className="text-xs text-zinc-500 space-y-1 mb-3 bg-zinc-50 rounded-lg p-3 font-mono">
              <li>Onion 10kg AUD 15000</li>
              <li>Carrot 5kg 8,500</li>
              <li>Spinach 500g 3200</li>
              <li>Olive Oil 5L AUD 25.00</li>
              <li>Cream 500ml 4.50</li>
            </ul>
            <p className="text-xs text-zinc-400">kg→g and L→ml auto-converted. Commas ignored.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Ingredients</label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Onion 10kg AUD 15000\nCarrot 5kg 8,500\nSpinach 500g 3200"}
              rows={9}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-y font-mono"
              disabled={isBulkProcessing}
              autoFocus
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
            <Button type="button" variant="ghost" onClick={closeBulkModal} disabled={isBulkProcessing}>Cancel</Button>
            <Button onClick={handleBulkSubmit} disabled={!bulkText.trim() || isBulkProcessing}>
              {isBulkProcessing ? "Adding…" : "Add Ingredients"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
