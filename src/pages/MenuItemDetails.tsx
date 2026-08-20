import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Plus, Edit, Trash2, PieChart, List, Search, X, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CostStatusBadge } from "@/components/CostStatusBadge";
import { formatCurrency, formatAmount } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useGetStore,
  useListMenuItems,
  useListIngredients,
  useListMenuItemIngredients,
  useAddMenuItemIngredient,
  useUpdateMenuItemIngredient,
  useDeleteMenuItemIngredient,
  getListMenuItemsQueryKey,
  getListMenuItemIngredientsQueryKey,
  type MenuItemIngredient,
  type Ingredient,
  type MenuItem,
} from "@workspace/api-client-react";

// ── Option types ──────────────────────────────────────────────────────────────
type IngredientOption =
  | { type: "ingredient"; id: number; name: string; unit: string; purchaseWeightGrams: number }
  | { type: "subRecipe"; id: number; name: string };

function formatOptionSubtext(opt: IngredientOption): string {
  if (opt.type === "ingredient") {
    const w = opt.purchaseWeightGrams;
    if (opt.unit === "ml") {
      return w >= 1000 ? `${w / 1000}L` : `${w}ml`;
    }
    return w >= 1000 ? `${w / 1000}kg` : `${w}g`;
  }
  return "Recipe";
}

// ── Searchable combobox ───────────────────────────────────────────────────────
interface ComboboxProps {
  options: IngredientOption[];
  value: IngredientOption | null;
  onChange: (opt: IngredientOption | null) => void;
  disabled?: boolean;
}

function IngredientCombobox({ options, value, onChange, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState<number>(-1);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const ingredients = filtered.filter((o) => o.type === "ingredient");
  const subRecipes = filtered.filter((o) => o.type === "subRecipe");
  const flatFiltered = [...ingredients, ...subRecipes];

  useEffect(() => { setHighlighted(-1); }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const select = (opt: IngredientOption) => {
    onChange(opt);
    setQuery("");
    setOpen(false);
  };

  const clear = () => { onChange(null); setQuery(""); inputRef.current?.focus(); setOpen(true); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key !== "Escape") setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, flatFiltered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (highlighted >= 0 && flatFiltered[highlighted]) select(flatFiltered[highlighted]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const displayValue = value ? value.name : query;

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 w-full h-11 px-3 rounded-xl border transition-all ${open ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200"} bg-white`}>
        <Search className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          ref={inputRef}
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); onChange(null); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search ingredients or sub-recipes…"
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none min-w-0"
        />
        {value ? (
          <button type="button" onClick={clear} className="text-zinc-400 hover:text-zinc-700 shrink-0">
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto"
        >
          {flatFiltered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400 text-center">No matches found</div>
          ) : (
            <>
              {ingredients.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                    Master Ingredients
                  </div>
                  {ingredients.map((opt, idx) => {
                    const globalIdx = idx;
                    return (
                      <button
                        key={`ing-${opt.id}`}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                        onMouseEnter={() => setHighlighted(globalIdx)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${highlighted === globalIdx ? "bg-zinc-50" : "hover:bg-zinc-50"}`}
                      >
                        <span className="text-sm font-medium text-zinc-900">{opt.name}</span>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className="text-xs text-zinc-400">{formatOptionSubtext(opt)}</span>
                          <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full">Ingredient</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {subRecipes.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                    Sub-Recipes
                  </div>
                  {subRecipes.map((opt, idx) => {
                    const globalIdx = ingredients.length + idx;
                    return (
                      <button
                        key={`sub-${opt.id}`}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                        onMouseEnter={() => setHighlighted(globalIdx)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${highlighted === globalIdx ? "bg-zinc-50" : "hover:bg-zinc-50"}`}
                      >
                        <span className="text-sm font-medium text-zinc-900">{opt.name}</span>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className="text-xs text-zinc-400">Recipe</span>
                          <span className="text-xs bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full">Sub-Recipe</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bulk parse ────────────────────────────────────────────────────────────────
interface ParsedBulkLine { name: string; weightGrams: number; }

function parseBulkLine(line: string): ParsedBulkLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?)\s+([\d.]+)\s*(kg|g|L|ml)\s*$/i);
  if (!match) return null;
  const name = match[1].trim();
  const amount = parseFloat(match[2]);
  const rawUnit = match[3];
  if (!name || isNaN(amount) || amount <= 0) return null;
  const lu = rawUnit.toLowerCase();
  const converted = lu === "kg" ? amount * 1000 : lu === "l" ? amount * 1000 : amount;
  return { name, weightGrams: converted };
}

// ── Display helpers ───────────────────────────────────────────────────────────
function formatIngredientAmount(item: MenuItemIngredient): string {
  if (item.unit === "recipe") {
    const servings = item.weightGrams;
    return `×${servings % 1 === 0 ? servings.toFixed(0) : servings.toFixed(2)} serving${servings !== 1 ? "s" : ""}`;
  }
  return formatAmount(item.weightGrams, item.unit);
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MenuItemDetails() {
  const params = useParams<{ storeId: string; menuItemId: string }>();
  const storeId = parseInt(params.storeId || "0");
  const menuItemId = parseInt(params.menuItemId || "0");

  const queryClient = useQueryClient();
  const { data: store } = useGetStore(storeId);
  const { data: menuItems } = useListMenuItems(storeId);
  const { data: recipeIngredients, isLoading } = useListMenuItemIngredients(storeId, menuItemId);
  const { data: masterIngredients } = useListIngredients();

  const menuItem = menuItems?.find((m) => m.id === menuItemId);

  // ── Build combined searchable options (exclude self to prevent cycles) ──────
  const options = useMemo<IngredientOption[]>(() => {
    const ingOpts: IngredientOption[] = (masterIngredients ?? []).map((i) => ({
      type: "ingredient",
      id: i.id,
      name: i.name,
      unit: i.unit,
      purchaseWeightGrams: i.purchaseWeightGrams,
    }));
    const subOpts: IngredientOption[] = (menuItems ?? [])
      .filter((m) => m.id !== menuItemId)
      .map((m) => ({ type: "subRecipe", id: m.id, name: m.name }));
    return [...ingOpts, ...subOpts];
  }, [masterIngredients, menuItems, menuItemId]);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemIngredient | null>(null);
  const [selectedOption, setSelectedOption] = useState<IngredientOption | null>(null);
  const [amount, setAmount] = useState("");

  // ── Bulk add state ─────────────────────────────────────────────────────────
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const invalidateRecipe = () => {
    queryClient.invalidateQueries({ queryKey: getListMenuItemIngredientsQueryKey(storeId, menuItemId) });
    queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey(storeId) });
  };

  const { mutate: addIngredient, mutateAsync: addIngredientAsync, isPending: isAdding } = useAddMenuItemIngredient({
    mutation: { onSuccess: () => { invalidateRecipe(); closeModal(); } },
  });

  const { mutate: updateIngredient, mutateAsync: updateIngredientAsync, isPending: isUpdating } = useUpdateMenuItemIngredient({
    mutation: { onSuccess: () => { invalidateRecipe(); closeModal(); } },
  });

  const { mutate: deleteIngredient } = useDeleteMenuItemIngredient({
    mutation: { onSuccess: () => invalidateRecipe() },
  });

  useEffect(() => {
    if (editingItem) {
      setAmount(editingItem.weightGrams.toString());
      if (editingItem.type === "ingredient" && editingItem.ingredientId) {
        const found = options.find(
          (o) => o.type === "ingredient" && o.id === editingItem.ingredientId
        );
        setSelectedOption(found ?? null);
      } else if (editingItem.type === "subRecipe" && editingItem.subRecipeMenuItemId) {
        const found = options.find(
          (o) => o.type === "subRecipe" && o.id === editingItem.subRecipeMenuItemId
        );
        setSelectedOption(found ?? null);
      }
    } else {
      setSelectedOption(null);
      setAmount("");
    }
  }, [editingItem, options]);

  const openNewItem = () => { setEditingItem(null); setIsModalOpen(true); };
  const openEditItem = (item: MenuItemIngredient) => { setEditingItem(item); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditingItem(null); };
  const openBulkModal = () => { setBulkText(""); setIsBulkModalOpen(true); };
  const closeBulkModal = () => { setIsBulkModalOpen(false); setBulkText(""); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption || !amount) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const data =
      selectedOption.type === "ingredient"
        ? { ingredientId: selectedOption.id, weightGrams: parsedAmount }
        : { subRecipeMenuItemId: selectedOption.id, weightGrams: parsedAmount };

    if (editingItem) {
      updateIngredient({ storeId, id: menuItemId, rowId: editingItem.id, data: { weightGrams: parsedAmount } });
    } else {
      addIngredient({ storeId, id: menuItemId, data });
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim() || !masterIngredients) return;
    setIsBulkProcessing(true);

    const lines = bulkText.split("\n");
    const notFound: string[] = [];
    const unparseable: string[] = [];
    let addedCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = parseBulkLine(line);
      if (!parsed) { unparseable.push(line.trim()); continue; }

      const match = masterIngredients.find(
        (i) => i.name.toLowerCase() === parsed.name.toLowerCase()
      );
      if (!match) { notFound.push(parsed.name); continue; }

      try {
        const existing = recipeIngredients?.find(
          (r) => r.type === "ingredient" && r.ingredientId === match.id
        );
        if (existing) {
          await updateIngredientAsync({
            storeId,
            id: menuItemId,
            rowId: existing.id,
            data: { weightGrams: parsed.weightGrams },
          });
        } else {
          await addIngredientAsync({
            storeId,
            id: menuItemId,
            data: { ingredientId: match.id, weightGrams: parsed.weightGrams },
          });
        }
        addedCount++;
      } catch {
        notFound.push(parsed.name);
      }
    }

    invalidateRecipe();

    if (notFound.length > 0) {
      toast({
        title: `${notFound.length} ingredient${notFound.length > 1 ? "s" : ""} not found`,
        description: notFound.map((n) => `"${n}" not in Master Ingredients`).join(" · "),
        variant: "destructive",
      });
    }
    if (unparseable.length > 0) {
      toast({
        title: `${unparseable.length} line${unparseable.length > 1 ? "s" : ""} skipped`,
        description: `Could not parse: ${unparseable.map((l) => `"${l}"`).join(", ")}`,
        variant: "destructive",
      });
    }
    if (addedCount > 0) {
      toast({
        title: `${addedCount} ingredient${addedCount > 1 ? "s" : ""} added`,
        description: "Recipe and cost totals have been updated.",
      });
    }

    setIsBulkProcessing(false);
    closeBulkModal();
  };

  const handleDelete = (item: MenuItemIngredient) => {
    if (window.confirm("Remove this from the recipe?")) {
      deleteIngredient({ storeId, id: menuItemId, rowId: item.id });
    }
  };

  // ── Derive current unit label ──────────────────────────────────────────────
  const currentUnit = useMemo(() => {
    if (editingItem) return editingItem.unit;
    if (selectedOption?.type === "ingredient") return selectedOption.unit ?? "g";
    if (selectedOption?.type === "subRecipe") return "recipe";
    return "g";
  }, [editingItem, selectedOption]);

  const isSubRecipeSelected = currentUnit === "recipe";

  if (!menuItem) return null;

  const sortedIngredients = [...(recipeIngredients ?? [])].sort((a, b) =>
    a.ingredientName.localeCompare(b.ingredientName, undefined, { sensitivity: "base" })
  );

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-5">
      <div>
        <Link
          href={`/stores/${storeId}/menu`}
          className="text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center mb-2 sm:mb-4 w-fit transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" /> Back to {store?.name || "Menu"}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-zinc-900 leading-tight break-words">{menuItem.name}</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Recipe builder and cost breakdown.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={openBulkModal} size="sm" className="h-8 text-xs sm:text-sm">
              <List className="w-3.5 h-3.5 mr-1.5" /> Bulk Add
            </Button>
            <Button onClick={openNewItem} size="sm" className="h-8 text-xs sm:text-sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Ingredient
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-5">
            <p className="text-xs font-medium text-zinc-500 mb-1">Selling Price</p>
            <p className="text-lg sm:text-2xl font-display font-semibold text-zinc-900 leading-tight">{formatCurrency(menuItem.sellingPrice)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-5">
            <p className="text-xs font-medium text-zinc-500 mb-1">Total Cost</p>
            <p className="text-lg sm:text-2xl font-display font-semibold text-zinc-900 leading-tight">{formatCurrency(menuItem.totalIngredientCost)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-5 flex flex-col items-start justify-center h-full">
            <p className="text-xs font-medium text-zinc-500 mb-1.5">Food Cost %</p>
            <CostStatusBadge percentage={menuItem.foodCostPercentage} className="text-xs sm:text-sm px-2 sm:px-3 py-0.5" />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-zinc-500 text-sm">Loading recipe...</div>
        ) : sortedIngredients.length === 0 ? (
          <div className="text-center py-10 sm:py-14 px-4 bg-zinc-50/50">
            <PieChart className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-zinc-900">Recipe is empty</h3>
            <p className="text-zinc-500 mt-1 mb-4 text-sm">Add ingredients to see your cost breakdown.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button onClick={openNewItem} variant="outline" className="w-full sm:w-auto">Add First Ingredient</Button>
              <Button onClick={openBulkModal} variant="outline" className="w-full sm:w-auto">
                <List className="w-4 h-4 mr-2" /> Bulk Add
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-zinc-100">
              {sortedIngredients.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 text-sm truncate">{item.ingredientName}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-xs text-zinc-500">{formatIngredientAmount(item)}</span>
                      <span className="text-xs font-semibold text-zinc-900">{formatCurrency(item.cost)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.type === "subRecipe" && (
                        <span className="text-xs bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full border border-amber-200">Sub-Recipe</span>
                      )}
                      {item.type === "ingredient" && item.yieldPercentage != null && item.yieldPercentage < 100 && (
                        <span className="text-xs bg-orange-50 text-orange-700 font-medium px-2 py-0.5 rounded-full border border-orange-200">
                          {item.yieldPercentage}% yield
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEditItem(item)} className="h-8 w-8 text-zinc-500">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
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
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Amount Used</TableHead>
                    <TableHead>Cost per Unit</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Ingredient Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedIngredients.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900">{item.ingredientName}</span>
                          <div className="flex gap-1">
                            {item.type === "subRecipe" && (
                              <span className="text-xs bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full border border-amber-200">
                                Sub-Recipe
                              </span>
                            )}
                            {item.type === "ingredient" && item.yieldPercentage != null && item.yieldPercentage < 100 && (
                              <span
                                className="text-xs bg-orange-50 text-orange-700 font-medium px-2 py-0.5 rounded-full border border-orange-200"
                                title={`${item.yieldPercentage}% yield — cost calculated on usable weight only`}
                              >
                                {item.yieldPercentage}% yield
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-600">{formatIngredientAmount(item)}</TableCell>
                      <TableCell className="text-zinc-500">
                        {item.type === "subRecipe"
                          ? `${formatCurrency(item.costPerGram)}/serving`
                          : `${formatCurrency(item.costPerGram)}/${item.unit}`}
                      </TableCell>
                      <TableCell className="font-semibold text-zinc-900">{formatCurrency(item.cost)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditItem(item)} className="h-8 w-8 text-zinc-500">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
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

      {/* Add / Edit modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingItem ? "Edit Amount" : "Add to Recipe"}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {editingItem ? (
            <div>
              <label className="block text-sm font-medium text-zinc-500 mb-1.5">Ingredient</label>
              <div className="flex items-center gap-2 h-11 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 text-sm font-medium">
                <span>{editingItem.ingredientName}</span>
                {editingItem.type === "subRecipe" && (
                  <span className="text-xs bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full border border-amber-200">
                    Sub-Recipe
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Search Ingredients &amp; Sub-Recipes
              </label>
              <IngredientCombobox
                options={options}
                value={selectedOption}
                onChange={setSelectedOption}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              {isSubRecipeSelected ? "Servings" : `Amount Used (${currentUnit})`}
            </label>
            <Input
              type="number"
              step={isSubRecipeSelected ? "0.01" : "0.1"}
              min={isSubRecipeSelected ? "0.01" : "0.1"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={isSubRecipeSelected ? "e.g. 1.0" : "e.g. 150"}
              required
              autoFocus={!!editingItem}
            />
            {isSubRecipeSelected && (
              <p className="text-xs text-zinc-400 mt-1.5">
                1.0 = full recipe cost · 0.5 = half recipe cost
              </p>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isAdding || isUpdating || (!editingItem && !selectedOption)}>
              {editingItem ? "Save Changes" : "Add to Recipe"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk add modal */}
      <Modal isOpen={isBulkModalOpen} onClose={closeBulkModal} title="Bulk Add to Recipe">
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-zinc-600 mb-2">Enter one ingredient per line — name, then amount with unit:</p>
            <ul className="text-xs text-zinc-500 space-y-1 mb-3 bg-zinc-50 rounded-lg p-3 font-mono">
              <li>Onion 50g</li>
              <li>Chicken Breast 200g</li>
              <li>Olive Oil 30ml</li>
              <li>Stock 0.5L</li>
            </ul>
            <p className="text-xs text-zinc-400 mb-3">
              Names must match Master Ingredients exactly (not case-sensitive). Supports <strong>g</strong>, <strong>kg</strong>, <strong>ml</strong>, and <strong>L</strong>.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Ingredients</label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Onion 50g\nChicken Breast 200g\nOlive Oil 30g"}
              rows={9}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-y font-mono"
              disabled={isBulkProcessing}
              autoFocus
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
            <Button type="button" variant="ghost" onClick={closeBulkModal} disabled={isBulkProcessing}>Cancel</Button>
            <Button type="submit" disabled={!bulkText.trim() || isBulkProcessing}>
              {isBulkProcessing ? "Adding…" : "Add to Recipe"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
