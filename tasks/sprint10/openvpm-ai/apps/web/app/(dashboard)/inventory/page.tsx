"use client";

import { TableSkeleton } from "@/components/ui/skeleton";
import { MarkupInput } from "@/components/inventory/markup-input";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Package,
  Plus,
  Minus,
  Pencil,
  Truck,
  X,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  DataTableFrame,
  KpiCard,
  KpiGrid,
  PageToolbar,
  SearchField,
  filterControlClass,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import { WholesalerImportDialog } from "@/components/inventory/wholesaler-import-dialog";
import {
  INVENTORY_ADJUSTMENT_QUANTITY_MIN,
  INVENTORY_ADJUSTMENT_REASON_MAX_LENGTH,
  INVENTORY_MONEY_AMOUNT_MAX,
  INVENTORY_MONEY_AMOUNT_MIN,
  INVENTORY_PRODUCT_CATEGORY_MAX_LENGTH,
  INVENTORY_PRODUCT_LOT_NUMBER_MAX_LENGTH,
  INVENTORY_PRODUCT_NAME_MAX_LENGTH,
  INVENTORY_PRODUCT_SEARCH_MAX_LENGTH,
  INVENTORY_PRODUCT_SKU_MAX_LENGTH,
  INVENTORY_STOCK_QUANTITY_MAX,
  INVENTORY_STOCK_QUANTITY_MIN,
  INVENTORY_SUPPLIER_ADDRESS_MAX_LENGTH,
  INVENTORY_SUPPLIER_EMAIL_MAX_LENGTH,
  INVENTORY_SUPPLIER_NAME_MAX_LENGTH,
  INVENTORY_SUPPLIER_NOTES_MAX_LENGTH,
  INVENTORY_SUPPLIER_PHONE_MAX_LENGTH,
  isInventoryCurrencyAmountInputValid,
  isInventoryNonnegativeIntegerInputValid,
  isInventoryOptionalCurrencyAmountInputValid,
  isInventoryOptionalEmailInputValid,
  isInventoryOptionalExpirationDateInputValid,
  isInventoryOptionalTextInputValid,
  isInventoryPositiveIntegerInputValid,
  isInventoryRequiredTextInputValid,
} from "@/lib/inventory/policy";

const CATEGORIES = [
  { key: "all", label: "All Categories", value: "" },
  { key: "medication", label: "Medication", value: "medication" },
  { key: "vaccine", label: "Vaccines", value: "vaccine" },
  { key: "preventive", label: "Preventive", value: "preventive" },
  { key: "supplement", label: "Supplement", value: "supplement" },
  { key: "food", label: "Food", value: "food" },
  { key: "supply", label: "Supply", value: "supply" },
] as const;

const ALERT_FILTERS = [
  { key: "all", label: "All", value: "all" },
  { key: "attention", label: "Needs Attention", value: "attention" },
  { key: "lowStock", label: "Low Stock", value: "low_stock" },
  { key: "expired", label: "Expired", value: "expired" },
  { key: "expiringSoon", label: "Expiring Soon", value: "expiring_soon" },
] as const;

type AlertFilter = (typeof ALERT_FILTERS)[number]["value"];

function stockBadge(
  status: string,
  t: (key: string, fallback?: string) => string
) {
  if (status === "not_tracked") {
    return {
      label: t("inventory.stock.notTracked", "Stock not tracked"),
      className: "bg-slate-100 text-slate-700",
    };
  }
  if (status === "out") {
    return {
      label: t("inventory.stock.out", "Out"),
      className: "bg-red-100 text-red-700",
    };
  }
  if (status === "low") {
    return {
      label: t("inventory.stock.lowStock", "Low Stock"),
      className: "bg-amber-100 text-amber-700",
    };
  }
  return {
    label: t("inventory.stock.inStock", "In Stock"),
    className: "bg-green-100 text-green-700",
  };
}

function expirationBadge(
  status: string,
  t: (key: string, fallback?: string) => string
) {
  if (status === "expired") {
    return {
      label: t("inventory.expiration.expired", "Expired"),
      className: "bg-red-100 text-red-700",
    };
  }
  if (status === "expiring_soon") {
    return {
      label: t("inventory.expiration.expiringSoon", "Expiring Soon"),
      className: "bg-orange-100 text-orange-700",
    };
  }
  return null;
}

function formatProductCategory(
  category: string | null | undefined,
  t: (key: string, fallback?: string) => string
): string {
  if (!category) return "\u2014";
  const normalized = category.toLowerCase().trim();
  const key =
    normalized === "supplies"
      ? "supply"
      : normalized === "medications"
        ? "medication"
        : normalized === "foods"
          ? "food"
          : normalized;
  return t(`inventory.categories.${key}`, category);
}

const trimmedOrUndefined = (value: string) => value.trim() || undefined;
const trimmedOrNull = (value: string) => value.trim() || null;

function canManageInventoryRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function formatDateOnly(value: string): string {
  if (!isInventoryOptionalExpirationDateInputValid(value)) {
    return value;
  }
  return formatClinicalDate(value, "UTC", value);
}

// --- Add Product Form ---

function AddProductForm({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const createMutation = trpc.inventory.create.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
      toast.success(t("inventory.form.toastProductAdded", "Product added"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    unitPrice: "",
    taxable: true,
    costPrice: "",
    stockQuantity: 0,
    reorderPoint: 10,
    lotNumber: "",
    expirationDate: "",
  });

  const canSubmit =
    isInventoryRequiredTextInputValid(
      form.name,
      INVENTORY_PRODUCT_NAME_MAX_LENGTH
    ) &&
    isInventoryOptionalTextInputValid(
      form.sku,
      INVENTORY_PRODUCT_SKU_MAX_LENGTH
    ) &&
    isInventoryOptionalTextInputValid(
      form.category,
      INVENTORY_PRODUCT_CATEGORY_MAX_LENGTH
    ) &&
    isInventoryCurrencyAmountInputValid(form.unitPrice) &&
    isInventoryOptionalCurrencyAmountInputValid(form.costPrice) &&
    isInventoryNonnegativeIntegerInputValid(form.stockQuantity) &&
    isInventoryNonnegativeIntegerInputValid(form.reorderPoint) &&
    isInventoryOptionalTextInputValid(
      form.lotNumber,
      INVENTORY_PRODUCT_LOT_NUMBER_MAX_LENGTH
    ) &&
    isInventoryOptionalExpirationDateInputValid(form.expirationDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate({
      name: form.name.trim(),
      sku: trimmedOrUndefined(form.sku),
      category: trimmedOrUndefined(form.category),
      unitPrice: form.unitPrice.trim(),
      taxable: form.taxable,
      costPrice: trimmedOrUndefined(form.costPrice),
      stockQuantity: form.stockQuantity,
      reorderPoint: form.reorderPoint,
      lotNumber: trimmedOrUndefined(form.lotNumber),
      expirationDate: trimmedOrUndefined(form.expirationDate),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <h3 className="font-medium text-sm">
        {t("inventory.form.titleAddProduct", "Add Product")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t(
          "inventory.form.unitHint",
          "Use one consistent inventory unit. For medication dispensed as tablets, enter stock and price per tablet—not per bottle or package. Prescription quantities, stock deductions, and invoice totals all use this unit."
        )}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input
          placeholder={t("inventory.form.namePlaceholder", "Name *")}
          value={form.name}
          maxLength={INVENTORY_PRODUCT_NAME_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder={t("inventory.form.skuPlaceholder", "SKU")}
          value={form.sku}
          maxLength={INVENTORY_PRODUCT_SKU_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className={filterControlClass}
        >
          <option value="">
            {t("inventory.form.categoryPlaceholder", "Category")}
          </option>
          {CATEGORIES.slice(1).map((c) => (
            <option key={c.value} value={c.value}>
              {t(`inventory.categories.${c.key}`, c.label)}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={INVENTORY_MONEY_AMOUNT_MIN}
          max={INVENTORY_MONEY_AMOUNT_MAX}
          step="0.01"
          placeholder={t("inventory.form.unitPricePlaceholder", "Price per unit *")}
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          required
        />
        <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-xs">
          <input
            type="checkbox"
            checked={form.taxable}
            onChange={(event) =>
              setForm({ ...form, taxable: event.target.checked })
            }
          />
          {t("inventory.form.taxableLabel", "Taxable")}
        </label>
        <Input
          type="number"
          min={INVENTORY_MONEY_AMOUNT_MIN}
          max={INVENTORY_MONEY_AMOUNT_MAX}
          step="0.01"
          placeholder={t("inventory.form.costPricePlaceholder", "Cost Price")}
          value={form.costPrice}
          onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
        />
        <MarkupInput cost={form.costPrice} onApply={(unitPrice) => setForm({ ...form, unitPrice })} />
        <Input
          type="number"
          min={INVENTORY_STOCK_QUANTITY_MIN}
          max={INVENTORY_STOCK_QUANTITY_MAX}
          step={1}
          placeholder={t("inventory.form.stockUnitsPlaceholder", "Stock units")}
          value={form.stockQuantity}
          onChange={(e) =>
            setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })
          }
        />
        <Input
          type="number"
          min={INVENTORY_STOCK_QUANTITY_MIN}
          max={INVENTORY_STOCK_QUANTITY_MAX}
          step={1}
          placeholder={t(
            "inventory.form.reorderPointPlaceholder",
            "Reorder Point"
          )}
          value={form.reorderPoint}
          onChange={(e) =>
            setForm({ ...form, reorderPoint: parseInt(e.target.value) || 0 })
          }
        />
        <Input
          placeholder={t("inventory.form.lotNumberPlaceholder", "Lot Number")}
          value={form.lotNumber}
          maxLength={INVENTORY_PRODUCT_LOT_NUMBER_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
        />
        <Input
          type="date"
          placeholder={t(
            "inventory.form.expirationDatePlaceholder",
            "Expiration Date"
          )}
          value={form.expirationDate}
          aria-invalid={
            !isInventoryOptionalExpirationDateInputValid(form.expirationDate) ||
            undefined
          }
          onChange={(e) =>
            setForm({ ...form, expirationDate: e.target.value })
          }
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit || createMutation.isPending}
        >
          {createMutation.isPending
            ? t("inventory.form.addingButton", "Adding...")
            : t("inventory.form.addProductButton", "Add Product")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("inventory.form.cancelButton", "Cancel")}
        </Button>
      </div>
      {createMutation.error && (
        <p className="text-sm text-destructive">
          {createMutation.error.message}
        </p>
      )}
    </form>
  );
}

// --- Edit Product Form ---

function EditProductRow({
  product,
  onClose,
}: {
  product: {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    unitPrice: string;
    taxable: boolean;
    costPrice: string | null;
    inventoryTracked: boolean;
    stockQuantity: number;
    reorderPoint: number | null;
    lotNumber: string | null;
    expirationDate: string | null;
  };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const updateMutation = trpc.inventory.update.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
      toast.success(t("inventory.edit.toastProductUpdated", "Product updated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState({
    name: product.name,
    sku: product.sku ?? "",
    category: product.category ?? "",
    unitPrice: product.unitPrice,
    taxable: product.taxable,
    costPrice: product.costPrice ?? "",
    reorderPoint: product.reorderPoint ?? 10,
    lotNumber: product.lotNumber ?? "",
    expirationDate: product.expirationDate ?? "",
  });

  const canSave =
    isInventoryRequiredTextInputValid(
      form.name,
      INVENTORY_PRODUCT_NAME_MAX_LENGTH
    ) &&
    isInventoryOptionalTextInputValid(
      form.sku,
      INVENTORY_PRODUCT_SKU_MAX_LENGTH
    ) &&
    isInventoryOptionalTextInputValid(
      form.category,
      INVENTORY_PRODUCT_CATEGORY_MAX_LENGTH
    ) &&
    isInventoryCurrencyAmountInputValid(form.unitPrice) &&
    isInventoryOptionalCurrencyAmountInputValid(form.costPrice) &&
    (!product.inventoryTracked ||
      (isInventoryNonnegativeIntegerInputValid(form.reorderPoint) &&
        isInventoryOptionalTextInputValid(
          form.lotNumber,
          INVENTORY_PRODUCT_LOT_NUMBER_MAX_LENGTH
        ) &&
        isInventoryOptionalExpirationDateInputValid(form.expirationDate)));

  const handleSave = () => {
    if (!canSave) return;
    updateMutation.mutate({
      id: product.id,
      name: form.name.trim(),
      sku: trimmedOrUndefined(form.sku),
      category: trimmedOrUndefined(form.category),
      unitPrice: form.unitPrice.trim(),
      taxable: form.taxable,
      costPrice: trimmedOrUndefined(form.costPrice),
      ...(product.inventoryTracked
        ? {
            reorderPoint: form.reorderPoint,
            lotNumber: trimmedOrUndefined(form.lotNumber),
            expirationDate: trimmedOrNull(form.expirationDate),
          }
        : {}),
    });
  };

  return (
    <tr className={cn(tableRowClass, "bg-muted/20")}>
      <td className={tableCellClass}>
        <Input
          value={form.name}
          maxLength={INVENTORY_PRODUCT_NAME_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8 text-xs"
        />
      </td>
      <td className={tableCellClass}>
        <Input
          value={form.sku}
          maxLength={INVENTORY_PRODUCT_SKU_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          className="h-8 text-xs"
        />
      </td>
      <td className={tableCellClass}>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className={cn(filterControlClass, "h-8 w-full px-2")}
        >
          <option value="">--</option>
          {form.category &&
            !CATEGORIES.some((category) => category.value === form.category) && (
              <option value={form.category}>{form.category}</option>
            )}
          {CATEGORIES.slice(1).map((c) => (
            <option key={c.value} value={c.value}>
              {t(`inventory.categories.${c.key}`, c.label)}
            </option>
          ))}
        </select>
      </td>
      <td className={tableCellClass}>
        <Input
          type="number"
          min={INVENTORY_MONEY_AMOUNT_MIN}
          max={INVENTORY_MONEY_AMOUNT_MAX}
          step="0.01"
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          className="h-8 text-xs tabular-nums text-right"
        />
      </td>
      <td className={tableCellClass}>
        <label className="flex items-center justify-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.taxable}
            onChange={(event) =>
              setForm({ ...form, taxable: event.target.checked })
            }
          />
          {t("inventory.form.taxableLabel", "Taxable")}
        </label>
      </td>
      <td className={tableCellClass}>
        <Input
          type="number"
          min={INVENTORY_MONEY_AMOUNT_MIN}
          max={INVENTORY_MONEY_AMOUNT_MAX}
          step="0.01"
          value={form.costPrice}
          onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
          className="h-8 text-xs tabular-nums text-right"
        />
        <MarkupInput cost={form.costPrice} onApply={(unitPrice) => setForm({ ...form, unitPrice })} />
      </td>
      <td className={cn(tableCellClass, "text-right tabular-nums")}>
        {product.inventoryTracked ? product.stockQuantity : "—"}
      </td>
      <td className={tableCellClass}>
        <Input
          type="number"
          min={INVENTORY_STOCK_QUANTITY_MIN}
          max={INVENTORY_STOCK_QUANTITY_MAX}
          step={1}
          value={form.reorderPoint}
          disabled={!product.inventoryTracked}
          onChange={(e) =>
            setForm({ ...form, reorderPoint: parseInt(e.target.value) || 0 })
          }
          className="h-8 w-20 text-xs tabular-nums text-right"
        />
      </td>
      <td className={tableCellClass}>
        <div className="space-y-1">
          <Input
            value={form.lotNumber}
            disabled={!product.inventoryTracked}
            maxLength={INVENTORY_PRODUCT_LOT_NUMBER_MAX_LENGTH}
            onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
            className="h-8 text-xs"
            placeholder={t("inventory.edit.lotPlaceholder", "Lot")}
          />
          <Input
            type="date"
            value={form.expirationDate}
            disabled={!product.inventoryTracked}
            aria-invalid={
              !isInventoryOptionalExpirationDateInputValid(
                form.expirationDate
              ) || undefined
            }
            onChange={(e) =>
              setForm({ ...form, expirationDate: e.target.value })
            }
            className="h-8 text-xs"
          />
        </div>
      </td>
      <td className={tableCellClass} />
      <td className={tableCellClass}>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            aria-label={t("inventory.actions.saveProduct", "Save product")}
            onClick={handleSave}
            disabled={!canSave || updateMutation.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// --- Start Stock Tracking Popover ---

function StartTrackingPopover({
  productId,
  productName,
  onClose,
}: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [stockQuantity, setStockQuantity] = useState(0);
  const [reorderPoint, setReorderPoint] = useState(10);
  const mutation = trpc.inventory.startTracking.useMutation({
    onSuccess: async () => {
      await utils.inventory.list.invalidate();
      onClose();
      toast.success(
        t("inventory.tracking.toastStarted", "Stock tracking started")
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const valid =
    isInventoryNonnegativeIntegerInputValid(stockQuantity) &&
    isInventoryNonnegativeIntegerInputValid(reorderPoint);

  return (
    <div className="absolute right-0 top-9 z-20 w-72 rounded-lg border border-border bg-popover p-4 shadow-lg">
      <p className="text-sm font-medium">
        {t("inventory.tracking.title", `Start tracking ${productName}`, {
          name: productName,
        })}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "inventory.tracking.desc",
          "Enter a reviewed opening quantity. Imported source stock and lots are not assumed."
        )}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs">
          {t("inventory.tracking.openingUnits", "Opening units")}
          <Input
            type="number"
            min={0}
            step={1}
            value={stockQuantity}
            onChange={(event) =>
              setStockQuantity(Number.parseInt(event.target.value, 10) || 0)
            }
            className="mt-1"
          />
        </label>
        <label className="text-xs">
          {t("inventory.tracking.reorderPoint", "Reorder point")}
          <Input
            type="number"
            min={0}
            step={1}
            value={reorderPoint}
            onChange={(event) =>
              setReorderPoint(Number.parseInt(event.target.value, 10) || 0)
            }
            className="mt-1"
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          {t("inventory.tracking.cancel", "Cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!valid || mutation.isPending}
          onClick={() =>
            mutation.mutate({ id: productId, stockQuantity, reorderPoint })
          }
        >
          {t("inventory.tracking.start", "Start tracking")}
        </Button>
      </div>
    </div>
  );
}

// --- Stock Adjust Popover ---

function StockAdjustPopover({
  productId,
  productName,
  productStockQuantity,
  onClose,
}: {
  productId: string;
  productName: string;
  productStockQuantity: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const adjustMutation = trpc.inventory.adjustStock.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
      toast.success(t("inventory.adjust.toastAdjusted", "Stock adjusted"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const maxAddition = Math.max(
    0,
    INVENTORY_STOCK_QUANTITY_MAX - productStockQuantity
  );
  const hasValidAdjustmentReason = isInventoryRequiredTextInputValid(
    reason,
    INVENTORY_ADJUSTMENT_REASON_MAX_LENGTH
  );
  const hasValidAdjustmentQuantity = isInventoryPositiveIntegerInputValid(qty);
  const canAddStock =
    hasValidAdjustmentQuantity &&
    qty <= maxAddition &&
    hasValidAdjustmentReason &&
    !adjustMutation.isPending;
  const canRemoveStock =
    hasValidAdjustmentQuantity &&
    qty <= productStockQuantity &&
    hasValidAdjustmentReason &&
    !adjustMutation.isPending;

  const handleAdjust = (direction: 1 | -1) => {
    if (direction === 1 ? !canAddStock : !canRemoveStock) return;
    adjustMutation.mutate({
      id: productId,
      adjustment: qty * direction,
      reason: reason.trim(),
    });
  };

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        {t("inventory.adjust.title", `Adjust stock: ${productName}`, {
          name: productName,
        })}
      </p>
      <Input
        type="number"
        min={INVENTORY_ADJUSTMENT_QUANTITY_MIN}
        max={INVENTORY_STOCK_QUANTITY_MAX}
        step={1}
        value={qty}
        onChange={(e) => {
          const next = parseInt(e.target.value, 10);
          setQty(
            Number.isFinite(next)
              ? Math.min(
                  INVENTORY_STOCK_QUANTITY_MAX,
                  Math.max(INVENTORY_ADJUSTMENT_QUANTITY_MIN, next)
                )
              : INVENTORY_ADJUSTMENT_QUANTITY_MIN
          );
        }}
        className="h-8 text-xs mb-2"
        placeholder={t("inventory.adjust.quantityPlaceholder", "Quantity")}
      />
      <Input
        value={reason}
        maxLength={INVENTORY_ADJUSTMENT_REASON_MAX_LENGTH}
        onChange={(e) => setReason(e.target.value)}
        className="h-8 text-xs mb-2"
        placeholder={t("inventory.adjust.reasonPlaceholder", "Reason *")}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-xs"
          onClick={() => handleAdjust(1)}
          disabled={!canAddStock}
        >
          <Plus className="h-3 w-3 mr-1" /> {t("inventory.adjust.add", "Add")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-xs"
          onClick={() => handleAdjust(-1)}
          disabled={!canRemoveStock}
        >
          <Minus className="h-3 w-3 mr-1" /> {t("inventory.adjust.remove", "Remove")}
        </Button>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="mt-2 w-full h-7 text-xs"
        onClick={onClose}
      >
        {t("inventory.adjust.cancel", "Cancel")}
      </Button>
      {adjustMutation.error && (
        <p className="text-xs text-destructive mt-1">
          {adjustMutation.error.message}
        </p>
      )}
    </div>
  );
}

// --- Add Supplier Form ---

function AddSupplierForm({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const createMutation = trpc.inventory.createSupplier.useMutation({
    onSuccess: () => {
      utils.inventory.listSuppliers.invalidate();
      onClose();
      toast.success(t("inventory.supplier.toastAdded", "Supplier added"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    phone: "",
    address: "",
    notes: "",
  });

  const canSubmit =
    isInventoryRequiredTextInputValid(
      form.name,
      INVENTORY_SUPPLIER_NAME_MAX_LENGTH
    ) &&
    isInventoryOptionalEmailInputValid(form.contactEmail) &&
    isInventoryOptionalTextInputValid(
      form.phone,
      INVENTORY_SUPPLIER_PHONE_MAX_LENGTH
    ) &&
    isInventoryOptionalTextInputValid(
      form.address,
      INVENTORY_SUPPLIER_ADDRESS_MAX_LENGTH
    ) &&
    isInventoryOptionalTextInputValid(
      form.notes,
      INVENTORY_SUPPLIER_NOTES_MAX_LENGTH
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate({
      name: form.name.trim(),
      contactEmail: trimmedOrUndefined(form.contactEmail)?.toLowerCase(),
      phone: trimmedOrUndefined(form.phone),
      address: trimmedOrUndefined(form.address),
      notes: trimmedOrUndefined(form.notes),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <h3 className="font-medium text-sm">
        {t("inventory.supplier.titleAdd", "Add Supplier")}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Input
          placeholder={t("inventory.supplier.namePlaceholder", "Name *")}
          value={form.name}
          maxLength={INVENTORY_SUPPLIER_NAME_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder={t("inventory.supplier.emailPlaceholder", "Email")}
          type="email"
          value={form.contactEmail}
          maxLength={INVENTORY_SUPPLIER_EMAIL_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        />
        <Input
          placeholder={t("inventory.supplier.phonePlaceholder", "Phone")}
          value={form.phone}
          maxLength={INVENTORY_SUPPLIER_PHONE_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Input
          placeholder={t("inventory.supplier.addressPlaceholder", "Address")}
          value={form.address}
          maxLength={INVENTORY_SUPPLIER_ADDRESS_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="col-span-2"
        />
        <Input
          placeholder={t("inventory.supplier.notesPlaceholder", "Notes")}
          value={form.notes}
          maxLength={INVENTORY_SUPPLIER_NOTES_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit || createMutation.isPending}
        >
          {createMutation.isPending
            ? t("inventory.form.addingButton", "Adding...")
            : t("inventory.supplier.titleAdd", "Add Supplier")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("inventory.form.cancelButton", "Cancel")}
        </Button>
      </div>
      {createMutation.error && (
        <p className="text-sm text-destructive">
          {createMutation.error.message}
        </p>
      )}
    </form>
  );
}

// --- Edit Supplier Form ---

function EditSupplierRow({
  supplier,
  onClose,
}: {
  supplier: {
    id: string;
    name: string;
    contactEmail: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const updateMutation = trpc.inventory.updateSupplier.useMutation({
    onSuccess: () => {
      utils.inventory.listSuppliers.invalidate();
      onClose();
      toast.success(
        t("inventory.supplier.toastUpdated", "Supplier updated")
      );
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState({
    name: supplier.name,
    contactEmail: supplier.contactEmail ?? "",
    phone: supplier.phone ?? "",
    address: supplier.address ?? "",
    notes: supplier.notes ?? "",
  });

  const canSave =
    isInventoryRequiredTextInputValid(
      form.name,
      INVENTORY_SUPPLIER_NAME_MAX_LENGTH
    ) &&
    isInventoryOptionalEmailInputValid(form.contactEmail) &&
    isInventoryOptionalTextInputValid(
      form.phone,
      INVENTORY_SUPPLIER_PHONE_MAX_LENGTH
    ) &&
    isInventoryOptionalTextInputValid(
      form.address,
      INVENTORY_SUPPLIER_ADDRESS_MAX_LENGTH
    ) &&
    isInventoryOptionalTextInputValid(
      form.notes,
      INVENTORY_SUPPLIER_NOTES_MAX_LENGTH
    );

  const handleSave = () => {
    if (!canSave) return;
    const contactEmail = trimmedOrNull(form.contactEmail);
    updateMutation.mutate({
      id: supplier.id,
      name: form.name.trim(),
      contactEmail: contactEmail ? contactEmail.toLowerCase() : null,
      phone: trimmedOrNull(form.phone),
      address: trimmedOrNull(form.address),
      notes: trimmedOrNull(form.notes),
    });
  };

  return (
    <tr className={cn(tableRowClass, "bg-muted/20")}>
      <td className={tableCellClass}>
        <Input
          value={form.name}
          maxLength={INVENTORY_SUPPLIER_NAME_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8 text-xs"
        />
      </td>
      <td className={tableCellClass}>
        <Input
          type="email"
          value={form.contactEmail}
          maxLength={INVENTORY_SUPPLIER_EMAIL_MAX_LENGTH}
          onChange={(e) =>
            setForm({ ...form, contactEmail: e.target.value })
          }
          className="h-8 text-xs"
        />
      </td>
      <td className={tableCellClass}>
        <Input
          value={form.phone}
          maxLength={INVENTORY_SUPPLIER_PHONE_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="h-8 text-xs"
        />
      </td>
      <td className={tableCellClass}>
        <Input
          value={form.address}
          maxLength={INVENTORY_SUPPLIER_ADDRESS_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="h-8 text-xs"
        />
      </td>
      <td className={tableCellClass}>
        <Input
          value={form.notes}
          maxLength={INVENTORY_SUPPLIER_NOTES_MAX_LENGTH}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="h-8 text-xs"
        />
      </td>
      <td className={tableCellClass}>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={handleSave}
            disabled={!canSave || updateMutation.isPending}
            title={t("inventory.supplier.saveTitle", "Save supplier")}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClose}
            title={t("inventory.supplier.cancelTitle", "Cancel")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {updateMutation.error && (
          <p className="mt-1 text-xs text-destructive">
            {updateMutation.error.message}
          </p>
        )}
      </td>
    </tr>
  );
}

// --- Main Page ---

/**
 * Opens the dialog requested by a command-palette deep link
 * (`/inventory?new=1`, `/inventory?import=1`). Kept in its own Suspense
 * boundary because `useSearchParams()` opts the page into client rendering.
 */
function InventoryDeepLink({
  enabled,
  onNewProduct,
  onGoodsReceipt,
}: {
  enabled: boolean;
  onNewProduct: () => void;
  onGoodsReceipt: () => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!enabled) return;
    if (searchParams.get("new") === "1") onNewProduct();
    if (searchParams.get("import") === "1") onGoodsReceipt();
  }, [enabled, onGoodsReceipt, onNewProduct, searchParams]);

  return null;
}

export default function InventoryPage() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const formatCurrency = useCurrencyFormatter();
  const [tab, setTab] = useState<"products" | "suppliers">("products");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [belowMinimum, setBelowMinimum] = useState(false);
  const supplierOptions = trpc.extensions.inventoryMetadata.suppliers.useQuery();
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(
    null
  );
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const searchFilter = search.trim();
  const canManageInventory = canManageInventoryRole(session?.user?.role);

  useEffect(() => {
    setPage(1);
  }, [searchFilter, category, alertFilter, supplierName, belowMinimum]);

  const productsQuery = trpc.inventory.list.useQuery(
    {
      search: searchFilter || undefined,
      category: category || undefined,
      alert: alertFilter,
      supplierName: supplierName || undefined,
      belowMinimum,
      expiryWindowDays: 29,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
    { enabled: tab === "products" }
  );

  const suppliersQuery = trpc.inventory.listSuppliers.useQuery(undefined, {
    enabled: tab === "suppliers",
  });
  const productsMissing =
    tab === "products" &&
    !productsQuery.isLoading &&
    !productsQuery.error &&
    !productsQuery.data;
  const suppliersMissing =
    tab === "suppliers" &&
    !suppliersQuery.isLoading &&
    !suppliersQuery.error &&
    !suppliersQuery.data;

  return (
    <div className={pageShellClass}>
      {/* Deep links from the command palette ("Nový produkt" / "Príjem tovaru")
          open the matching dialog instead of landing on a bare product list. */}
      <Suspense fallback={null}>
        <InventoryDeepLink
          enabled={canManageInventory}
          onNewProduct={() => setShowAddProduct(true)}
          onGoodsReceipt={() => setShowImportDialog(true)}
        />
      </Suspense>

      <PageHeader
        icon={Package}
        title={t("inventory.page.title", "Inventory")}
        subtitle={t(
          "inventory.page.subtitle",
          "Products, stock management, and suppliers"
        )}
        actions={
          canManageInventory ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowImportDialog(true)}
              >
                <Truck className="h-4 w-4 mr-1.5" />
                {t("inventory.page.btnImportWholesaler", "Import dodacieho listu")}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddProduct(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />{" "}
                {t("inventory.page.btnAddProduct", "Add Product")}
              </Button>
            </div>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "products" | "suppliers")}
      >
        <TabsList className={underlineTabsListClass}>
          <TabsTrigger value="products" className={underlineTabsTriggerClass}>
            <Package className="h-3.5 w-3.5" />
            {t("inventory.tabs.products", "Products")}
          </TabsTrigger>
          <TabsTrigger value="suppliers" className={underlineTabsTriggerClass}>
            <Truck className="h-3.5 w-3.5" />
            {t("inventory.tabs.suppliers", "Suppliers")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Products Tab */}
      {tab === "products" && (
        <>
          <PageToolbar>
            <SearchField
              value={search}
              maxLength={INVENTORY_PRODUCT_SEARCH_MAX_LENGTH}
              placeholder={t(
                "inventory.page.searchPlaceholder",
                "Search by name or SKU..."
              )}
              onChange={setSearch}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={filterControlClass}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {t(`inventory.categories.${cat.key}`, cat.label)}
                </option>
              ))}
            </select>
            <select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value as AlertFilter)}
              className={filterControlClass}
            >
              {ALERT_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {t(`inventory.alerts.${filter.key}`, filter.label)}
                </option>
              ))}
            </select>
            <select
              className={filterControlClass}
              value={supplierName}
              aria-label={t("inventory.page.supplierFilter")}
              onChange={(e) => setSupplierName(e.target.value)}
            >
              <option value="">{t("inventory.page.allSuppliers")}</option>
              {(supplierOptions.data ?? []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <label className={cn(filterControlClass, "inline-flex items-center gap-2")}>
              <input type="checkbox" checked={belowMinimum} onChange={(e) => setBelowMinimum(e.target.checked)} />
              {t("inventory.page.onlyBelowMinimum")}
            </label>
            {productsQuery.data && (
              <p className="text-xs text-muted-foreground sm:ml-auto">
                {productsQuery.data.total === 1
                  ? t("inventory.page.plural_one", "{count} product", {
                      count: productsQuery.data.total,
                    })
                  : productsQuery.data.total >= 2 &&
                    productsQuery.data.total <= 4
                  ? t("inventory.page.plural_few", "{count} products", {
                      count: productsQuery.data.total,
                    })
                  : t("inventory.page.plural_other", "{count} products", {
                      count: productsQuery.data.total,
                    })}
              </p>
            )}
          </PageToolbar>

          <WholesalerImportDialog
            open={showImportDialog}
            onOpenChange={setShowImportDialog}
            onSuccess={() => productsQuery.refetch()}
          />

          {canManageInventory && showAddProduct && (
            <AddProductForm onClose={() => setShowAddProduct(false)} />
          )}

          {productsQuery.data && (
            <KpiGrid>
              <KpiCard
                active={alertFilter === "attention"}
                onClick={() => setAlertFilter("attention")}
                icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                label={t("inventory.page.alertAttention", "Needs attention")}
                value={productsQuery.data.alertCounts.attention}
              />
              <KpiCard
                active={alertFilter === "low_stock"}
                onClick={() => setAlertFilter("low_stock")}
                label={t("inventory.page.alertLowStock", "Low stock")}
                value={productsQuery.data.alertCounts.lowStock}
              />
              <KpiCard
                active={alertFilter === "expired"}
                onClick={() => setAlertFilter("expired")}
                label={t("inventory.page.alertExpired", "Expired")}
                value={productsQuery.data.alertCounts.expired}
              />
              <KpiCard
                active={alertFilter === "expiring_soon"}
                onClick={() => setAlertFilter("expiring_soon")}
                label={t("inventory.page.alertExpiringSoon", "Expiring soon")}
                value={productsQuery.data.alertCounts.expiringSoon}
              />
            </KpiGrid>
          )}

          {productsQuery.error || productsMissing ? (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {productsQuery.error?.message ??
                t(
                  "inventory.page.loadError",
                  "Unable to load inventory products. Please retry."
                )}
            </div>
          ) : productsQuery.isLoading ? (
            <div role="status" aria-label={t("inventory.page.loading")}><TableSkeleton columns={11} /></div>
          ) : productsQuery.data && productsQuery.data.items.length > 0 ? (
            <DataTableFrame>
                <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={tableHeadClass}>
                      {t("inventory.table.colName", "Name")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.table.colSku", "SKU")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.table.colCategory", "Category")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("inventory.table.colPriceUnit", "Price / unit")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.table.colTax", "Tax")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("inventory.table.colCost", "Cost")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("inventory.table.colStockUnits", "Stock units")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("inventory.table.colReorderPoint", "Reorder Pt")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.table.colLotExpiry", "Lot / Expiry")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.table.colStatus", "Status")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.table.colActions", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productsQuery.data.items.map((product) => {
                    if (canManageInventory && editingId === product.id) {
                      return (
                        <EditProductRow
                          key={product.id}
                          product={product}
                          onClose={() => setEditingId(null)}
                        />
                      );
                    }

                    const stock = stockBadge(product.stockStatus, t);
                    const expiration = expirationBadge(
                      product.expirationStatus,
                      t
                    );

                    return (
                      <tr
                        key={product.id}
                        className={tableRowClass}
                      >
                        <td className={cn(tableCellClass, "font-medium")}>
                          {product.name}
                        </td>
                        <td className={cn(tableCellClass, "font-mono text-muted-foreground")}>
                          {product.sku || "\u2014"}
                        </td>
                        <td className={cn(tableCellClass, "text-muted-foreground")}>
                          {formatProductCategory(product.category, t)}
                        </td>
                        <td className={cn(tableCellClass, "text-right tabular-nums")}>
                          {formatCurrency(product.unitPrice)}
                        </td>
                        <td className={cn(tableCellClass, "text-muted-foreground")}>
                          {product.vatRate != null ? `${Number(product.vatRate)}%` : product.taxable ? t("inventory.table.taxable", "Taxable") : t("inventory.table.notTaxable", "Not taxable")}
                        </td>
                        <td className={cn(tableCellClass, "text-right tabular-nums text-muted-foreground")}>
                          {product.costPrice
                            ? formatCurrency(product.costPrice)
                            : "\u2014"}
                        </td>
                        <td className={cn(tableCellClass, "text-right tabular-nums")}>
                          {product.inventoryTracked
                            ? product.stockQuantity
                            : "—"}
                        </td>
                        <td className={cn(tableCellClass, "text-right tabular-nums text-muted-foreground")}>
                          {product.reorderPoint ?? "\u2014"}
                        </td>
                        <td className={cn(tableCellClass, "text-muted-foreground")}>
                          <span className="block">
                            {product.lotNumber
                              ? t("inventory.table.lotPrefix", `Lot ${product.lotNumber}`, { number: product.lotNumber })
                              : "\u2014"}
                          </span>
                          {product.expirationDate && (
                            <span className="block text-xs">
                              {t("inventory.table.expPrefix", `Exp ${formatDateOnly(product.expirationDate)}`, { date: formatDateOnly(product.expirationDate) })}
                            </span>
                          )}
                        </td>
                        <td className={tableCellClass}>
                          <div className="flex flex-wrap gap-1">
                            <span
                              className={cn(
                                "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                                stock.className
                              )}
                            >
                              {stock.label}
                            </span>
                            {expiration && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  expiration.className
                                )}
                              >
                                {expiration.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          {canManageInventory ? (
                            <div className="relative flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingId(product.id)}
                                title={t("inventory.table.btnEdit", "Edit")}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  setAdjustingId(
                                    adjustingId === product.id
                                      ? null
                                      : product.id
                                  )
                                }
                                title={
                                  product.inventoryTracked
                                    ? t("inventory.table.adjustStock", "Adjust stock")
                                    : t("inventory.table.startTracking", "Start stock tracking")
                                }
                                aria-label={
                                  product.inventoryTracked
                                    ? t("inventory.adjustStockAria", "Upraviť zásoby pre {name}", { name: product.name })
                                    : t("inventory.startTrackingAria", "Spustiť sledovanie zásob pre {name}", { name: product.name })
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              {adjustingId === product.id && (
                                product.inventoryTracked ? (
                                  <StockAdjustPopover
                                    productId={product.id}
                                    productName={product.name}
                                    productStockQuantity={product.stockQuantity}
                                    onClose={() => setAdjustingId(null)}
                                  />
                                ) : (
                                  <StartTrackingPopover
                                    productId={product.id}
                                    productName={product.name}
                                    onClose={() => setAdjustingId(null)}
                                  />
                                )
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("inventory.table.readOnly", "Read-only")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

            {/* Products Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <div>
                {t(
                  "inventory.pagination.showing",
                  `Showing ${Math.min((page - 1) * pageSize + 1, productsQuery.data.total)}–${Math.min(page * pageSize, productsQuery.data.total)} of ${productsQuery.data.total}`,
                  {
                    start: Math.min((page - 1) * pageSize + 1, productsQuery.data.total),
                    end: Math.min(page * pageSize, productsQuery.data.total),
                    total: productsQuery.data.total,
                  }
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || productsQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t("inventory.pagination.previous", "Previous")}
                </Button>
                <span className="text-sm tabular-nums font-medium text-foreground">
                  {page} / {Math.max(1, Math.ceil(productsQuery.data.total / pageSize))}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    page >= Math.max(1, Math.ceil(productsQuery.data.total / pageSize)) ||
                    productsQuery.isFetching
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t("inventory.pagination.next", "Next")}
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            </DataTableFrame>
        ) : (
            <EmptyState
              icon={Package}
              title={
                alertFilter !== "all"
                  ? t(
                      "inventory.empty.filterAlertTitle",
                      "No products match this alert filter"
                    )
                  : search || category || supplierName || belowMinimum
                    ? t(
                        "inventory.empty.filterSearchTitle",
                        "No products match your filters"
                      )
                    : t("inventory.empty.noProductsTitle", "No products yet")
              }
              description={
                alertFilter !== "all"
                  ? t(
                      "inventory.empty.filterAlertDesc",
                      "Clear the alert filter to see all inventory items."
                    )
                  : search || category || supplierName || belowMinimum
                    ? t(
                        "inventory.empty.filterSearchDesc",
                        "Clear the search or category filter to broaden the list."
                      )
                    : t(
                        "inventory.empty.noProductsDesc",
                        "Add medications, supplies, food, and other inventory before dispensing or invoicing stock-backed items."
                      )
              }
              action={
                canManageInventory &&
                alertFilter === "all" &&
                !search &&
                !category && !supplierName && !belowMinimum
                  ? {
                      label: t(
                        "inventory.empty.addFirstProduct",
                        "Add first product"
                      ),
                      onClick: () => setShowAddProduct(true),
                      icon: Plus,
                    }
                  : undefined
              }
            />
          )}
        </>
      )}

      {/* Suppliers Tab */}
      {tab === "suppliers" && (
        <>
          <PageToolbar>
            {suppliersQuery.data && (
              <p className="text-xs text-muted-foreground">
                {suppliersQuery.data.length === 1
                  ? t("inventory.suppliersTab.plural_one", "{count} supplier", {
                      count: suppliersQuery.data.length,
                    })
                  : suppliersQuery.data.length >= 2 &&
                    suppliersQuery.data.length <= 4
                  ? t("inventory.suppliersTab.plural_few", "{count} suppliers", {
                      count: suppliersQuery.data.length,
                    })
                  : t("inventory.suppliersTab.plural_other", "{count} suppliers", {
                      count: suppliersQuery.data.length,
                    })}
              </p>
            )}
            {canManageInventory && (
              <Button
                size="sm"
                onClick={() => setShowAddSupplier(true)}
                className="sm:ml-auto"
              >
                <Plus className="h-4 w-4 mr-1" />{" "}
                {t("inventory.suppliersTab.btnAddSupplier", "Add Supplier")}
              </Button>
            )}
          </PageToolbar>

          {canManageInventory && showAddSupplier && (
            <AddSupplierForm onClose={() => setShowAddSupplier(false)} />
          )}

          {suppliersQuery.error || suppliersMissing ? (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {suppliersQuery.error?.message ??
                t(
                  "inventory.suppliersTab.loadError",
                  "Unable to load inventory suppliers. Please retry."
                )}
            </div>
          ) : suppliersQuery.isLoading ? (
            <div role="status" aria-label={t("inventory.suppliersTab.loading")}><TableSkeleton columns={6} /></div>
          ) : suppliersQuery.data && suppliersQuery.data.length > 0 ? (
            <DataTableFrame>
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={tableHeadClass}>
                      {t("inventory.suppliersTab.colName", "Name")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.suppliersTab.colEmail", "Email")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.suppliersTab.colPhone", "Phone")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.suppliersTab.colAddress", "Address")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.suppliersTab.colNotes", "Notes")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("inventory.suppliersTab.colActions", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersQuery.data.map((supplier) => {
                    if (
                      canManageInventory &&
                      editingSupplierId === supplier.id
                    ) {
                      return (
                        <EditSupplierRow
                          key={supplier.id}
                          supplier={supplier}
                          onClose={() => setEditingSupplierId(null)}
                        />
                      );
                    }

                    return (
                      <tr
                        key={supplier.id}
                        className={tableRowClass}
                      >
                        <td className={cn(tableCellClass, "font-medium")}>
                          {supplier.name}
                        </td>
                        <td className={cn(tableCellClass, "text-muted-foreground")}>
                          {supplier.contactEmail || "\u2014"}
                        </td>
                        <td className={cn(tableCellClass, "text-muted-foreground")}>
                          {supplier.phone || "\u2014"}
                        </td>
                        <td className={cn(tableCellClass, "text-muted-foreground")}>
                          {supplier.address || "\u2014"}
                        </td>
                        <td
                          className={cn(tableCellClass, "max-w-xs truncate text-muted-foreground")}
                          title={supplier.notes ?? undefined}
                        >
                          {supplier.notes || "\u2014"}
                        </td>
                        <td className={tableCellClass}>
                          {canManageInventory ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingSupplierId(supplier.id)}
                              title={t(
                                "inventory.supplier.editTitle",
                                "Edit supplier"
                              )}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("inventory.table.readOnly", "Read-only")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableFrame>
          ) : (
            <EmptyState
              icon={Truck}
              title={t("inventory.suppliersTab.emptyTitle", "No suppliers yet")}
              description={t(
                "inventory.suppliersTab.emptyDesc",
                "Add supplier contact details so reorder workflows have the right vendor information at hand."
              )}
              action={
                canManageInventory
                  ? {
                      label: t(
                        "inventory.suppliersTab.addFirstSupplier",
                        "Add first supplier"
                      ),
                      onClick: () => setShowAddSupplier(true),
                      icon: Plus,
                    }
                  : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}
