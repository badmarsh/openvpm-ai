"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Coins,
  CreditCard,
  Loader2,
  Package,
  CheckCircle2,
  User,
  Percent,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { computePosTotals } from "@/lib/billing/pos-calculations";
import { useBarcodeScanner } from "@/lib/billing/use-barcode-scanner";
import { formatCurrency } from "@/lib/locale/format";
import {
  isBillingCurrencyAmountInputValid,
  BILLING_INVOICE_LINE_DESCRIPTION_MAX_LENGTH,
} from "@/lib/billing/policy";
import { CLIENT_SEARCH_MAX_LENGTH } from "@/lib/clients/policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { pageShellClass, SearchField, filterControlClass } from "@/components/layout/page-kit";
import { EmptyState } from "@/components/common/empty-state";
import { ActionConfirmationDialog } from "@/components/common/action-confirmation-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EkasaReceiptDialog,
  type EkasaReceiptModalData,
} from "@/components/ekasa/ekasa-receipt-dialog";

type VatRate = "STANDARD_23" | "REDUCED_19" | "REDUCED_5" | "ZERO";

interface CartItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: string;
  vatRate: VatRate;
  discountPercent: number;
}

interface PosProduct {
  id: string;
  name: string;
  unitPrice: string | number;
  category?: string | null;
  stockQuantity?: number | null;
  sku?: string | null;
}

function canAccessPosRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "front_desk";
}

export default function PosCheckoutPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className={pageShellClass}>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{t("billing.pos.checkingAccess", "Overovanie prístupových práv...")}</span>
        </div>
      </div>
    );
  }

  if (!canAccessPosRole(session?.user?.role)) {
    return (
      <div className={pageShellClass}>
        <div className="flex items-center justify-between">
          <Link href="/billing">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span>{t("billing.pos.backToBilling", "Späť na fakturáciu")}</span>
            </Button>
          </Link>
        </div>
        <EmptyState
          icon={ShoppingCart}
          title={t("billing.pos.readOnlyTitle", "Pultový predaj je obmedzený")}
          description={t(
            "billing.pos.readOnlyDesc",
            "K pultovému predaju majú prístup iba administrátori, veterinári a recepcia."
          )}
          action={{
            label: t("billing.pos.backToBilling", "Späť na fakturáciu"),
            onClick: () => router.push("/billing"),
          }}
        />
      </div>
    );
  }

  return <PosCheckoutForm />;
}

function PosCheckoutForm() {
  const { t } = useI18n();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<EkasaReceiptModalData | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const clientPickerRef = useRef<HTMLDivElement>(null);

  // Close client dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        clientPickerRef.current &&
        !clientPickerRef.current.contains(event.target as Node)
      ) {
        setClientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const vatRateOptions: Array<{ value: VatRate; label: string }> = [
    {
      value: "STANDARD_23",
      label: t("billing.pos.vatRate_STANDARD_23", "23 % (Štandard)"),
    },
    {
      value: "REDUCED_19",
      label: t("billing.pos.vatRate_REDUCED_19", "19 % (Krmivá/potraviny)"),
    },
    {
      value: "REDUCED_5",
      label: t("billing.pos.vatRate_REDUCED_5", "5 % (Lieky)"),
    },
    {
      value: "ZERO",
      label: t("billing.pos.vatRate_ZERO", "0 % (Oslobodené)"),
    },
  ];

  // Queries
  const { data: productsData, isLoading: isLoadingProducts } =
    trpc.inventory.list.useQuery({
      search: search || undefined,
      limit: 100,
    });

  const {
    data: clientsData,
    isLoading: isLoadingClients,
    error: clientsError,
  } = trpc.clients.list.useQuery(
    { search: clientSearch },
    { enabled: clientSearch.length >= 2 }
  );

  const createPosSale = trpc.extensions.ekasa.createPosSale.useMutation({
    onSuccess: (data) => {
      toast.success(
        t("billing.pos.toastSuccess", "Doklad úspešne vystavený a zaevidovaný v e-Kase")
      );
      setCompletedReceipt({
        receiptId: data.receiptId,
        receiptNumber: data.receiptNumber,
        amountTotal: data.amountTotal,
        status: data.status,
        uid: data.uid,
        okp: data.okp,
        qrUrl: data.qrUrl,
        html: data.html,
      });
      setReceiptDialogOpen(true);
      setCart([]);
      setSelectedClient(null);
      setClientSearch("");
    },
    onError: (err) => {
      toast.error(
        err.message ||
          t("billing.pos.toastErrorFallback", "Nepodarilo sa zaevidovať doklad v e-Kase")
      );
    },
  });

  // Filtered products
  const products: PosProduct[] = useMemo(() => {
    if (!productsData?.items) return [];
    if (selectedCategory === "all") return productsData.items;
    return productsData.items.filter((p) => p.category === selectedCategory);
  }, [productsData, selectedCategory]);

  const categories = useMemo<string[]>(() => {
    if (!productsData?.items) return ["all"];
    const cats = new Set<string>();
    productsData.items.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return ["all", ...Array.from(cats)];
  }, [productsData]);

  // Cart actions
  const addToCart = (product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      let defaultVat: VatRate = "STANDARD_23";
      const cat = (product.category || "").toLowerCase();
      if (cat.includes("diet") || cat.includes("krmiv") || cat.includes("food")) {
        defaultVat = "REDUCED_19";
      } else if (cat.includes("liek") || cat.includes("med") || cat.includes("pharma")) {
        defaultVat = "REDUCED_5";
      }

      return [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          productId: product.id,
          description: product.name,
          quantity: 1,
          unitPrice: String(product.unitPrice ?? "0"),
          vatRate: defaultVat,
          discountPercent: 0,
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateVatRate = (id: string, vatRate: VatRate) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, vatRate } : item))
    );
  };

  const updateDiscount = (id: string, percent: number) => {
    const clamped = Math.max(0, Math.min(100, percent));
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, discountPercent: clamped } : item
      )
    );
  };

  const addCustomItem = () => {
    setCart((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        description: t(
          "billing.pos.defaultItemDescription",
          "Pultová položka / Služba"
        ),
        quantity: 1,
        unitPrice: "5.00",
        vatRate: "STANDARD_23",
        discountPercent: 0,
      },
    ]);
  };

  // Calculations
  const { subtotal, discount, total: cartTotal } = useMemo(
    () =>
      computePosTotals(
        cart.map((item) => ({
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice) || 0,
          discountPercent: item.discountPercent,
        }))
      ),
    [cart]
  );

  const isCartValid =
    cart.length > 0 &&
    cart.every(
      (item) =>
        item.description.trim().length > 0 &&
        isBillingCurrencyAmountInputValid(item.unitPrice)
    );

  // USB barcode scanner
  useBarcodeScanner({
    enabled: true,
    minLength: 3,
    onScan: (barcode) => {
      if (!productsData?.items) return;
      const exact = productsData.items.find(
        (p) =>
          p.sku?.toLowerCase() === barcode.toLowerCase() ||
          p.name.toLowerCase().includes(barcode.toLowerCase())
      );
      if (exact) {
        addToCart({
          id: exact.id,
          name: exact.name,
          unitPrice: exact.unitPrice,
          category: exact.category,
          stockQuantity: exact.stockQuantity,
          sku: exact.sku,
        });
        toast.success(
          t("billing.pos.scannerAdded", "{name} pridaný do košíka", {
            name: exact.name,
          })
        );
      } else {
        toast.error(
          t("billing.pos.scannerNotFound", "Produkt pre kód {code} nenájdený", {
            code: barcode,
          })
        );
      }
    },
  });

  const handleCheckout = (paymentMethod: "CASH" | "CARD") => {
    if (!isCartValid || cart.length === 0) {
      toast.error(
        cart.length === 0
          ? t("billing.pos.toastEmptyCart", "Košík je prázdny")
          : t("billing.pos.toastInvalidCart", "Košík obsahuje neplatné položky")
      );
      return;
    }

    createPosSale.mutate({
      items: cart.map((item) => ({
        productId: item.productId,
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice.trim(),
        vatRate: item.vatRate,
        discountPercent: item.discountPercent,
      })),
      paymentMethod,
      clientId: selectedClient?.id,
      paperWidth,
    });
  };

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={ShoppingCart}
        title={t("billing.pos.title", "Pultový predaj (Rýchla pokladňa)")}
        subtitle={t(
          "billing.pos.subtitle",
          "Okamžitý predaj antiparazitík, krmív a liečiv s automatickým bločkom a odpisom zo skladu"
        )}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className="border-brand/30 bg-brand/15 text-xs text-brand"
            >
              {t("billing.pos.badgeEkasa", "e-Kasa Zero-Touch")}
            </Badge>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{t("billing.pos.printerLabel", "Tlačiareň:")}</span>
              <Tabs
                value={paperWidth}
                onValueChange={(val) =>
                  setPaperWidth(val as "58mm" | "80mm")
                }
              >
                <TabsList
                  className="h-8 p-0.5"
                  aria-label={t(
                    "billing.pos.printerWidthAria",
                    "Šírka pásky tlačiarne"
                  )}
                >
                  <TabsTrigger value="80mm" className="h-7 px-2.5 text-xs">
                    80 mm
                  </TabsTrigger>
                  <TabsTrigger value="58mm" className="h-7 px-2.5 text-xs">
                    58 mm
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Link href="/billing">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>
                  {t("billing.pos.backToBilling", "Späť na fakturáciu")}
                </span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* Main Grid: Catalog on left, Cart & Payment on right */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Product Catalog (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchField
              id="pos-catalog-search"
              inputRef={searchInputRef}
              value={search}
              onChange={setSearch}
              placeholder={t(
                "billing.pos.searchPlaceholder",
                "Hľadať tovar (názov, SKU, Bravecto, granule...)"
              )}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addCustomItem}
              className="h-9 gap-1.5 whitespace-nowrap text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("billing.pos.customItemButton", "Voľná položka")}</span>
            </Button>
          </div>

          {/* Categories pills */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat === "all"
                    ? t("billing.pos.categoryAll", "Všetok tovar")
                    : cat}
                </button>
              ))}
            </div>
          )}

          {/* Products List / Grid */}
          <div className="rounded-lg border border-border bg-card p-2 shadow-xs">
            {isLoadingProducts ? (
              <div className="grid gap-2 p-1 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex h-24 animate-pulse flex-col justify-between rounded-lg border border-border/80 bg-background/50 p-3"
                  >
                    <div className="space-y-2">
                      <div className="h-3 w-3/4 rounded bg-muted" />
                      <div className="h-2.5 w-1/2 rounded bg-muted" />
                    </div>
                    <div className="flex items-center justify-between border-t border-border/40 pt-2">
                      <div className="h-4 w-12 rounded bg-muted" />
                      <div className="h-3 w-16 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                icon={Package}
                title={
                  search.trim() || selectedCategory !== "all"
                    ? t(
                        "billing.pos.catalogNoResults",
                        "Nenašli sa žiadne produkty podľa zadaných kritérií"
                      )
                    : t(
                        "billing.pos.catalogEmpty",
                        "V sklade sa nenachádzajú žiadne produkty"
                      )
                }
                description={t(
                  "billing.pos.catalogEmptyDesc",
                  "Pridajte tovar v správe skladu alebo použite voľnú položku."
                )}
                className="py-12"
              />
            ) : (
              <div className="grid max-h-[calc(100vh-280px)] min-h-[320px] gap-2 overflow-y-auto p-1 sm:grid-cols-2">
                {products.map((p) => {
                  const stock = p.stockQuantity;
                  const isSoldOut =
                    stock !== null && stock !== undefined && stock <= 0;
                  const isLowStock =
                    !isSoldOut &&
                    stock !== null &&
                    stock !== undefined &&
                    stock <= 2;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="group flex flex-col justify-between rounded-lg border border-border/80 bg-background p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/30"
                    >
                      <div>
                        <div className="line-clamp-1 text-xs font-semibold group-hover:text-primary">
                          {p.name}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {p.category ||
                            t(
                              "billing.pos.defaultCategory",
                              "Skladová položka"
                            )}{" "}
                          {p.sku ? `• ${p.sku}` : ""}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                        <span className="font-bold tabular-nums text-foreground">
                          {formatCurrency(p.unitPrice)}
                        </span>
                        {isSoldOut ? (
                          <span className="rounded border border-destructive/30 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                            {t("billing.pos.soldOut", "Vypredané ({count} ks)", {
                              count: stock ?? 0,
                            })}
                          </span>
                        ) : isLowStock ? (
                          <span className="rounded border border-warning/30 bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                            {t(
                              "billing.pos.lowStockCount",
                              "Nízky stav: {count} ks",
                              { count: stock ?? 0 }
                            )}
                          </span>
                        ) : (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {stock !== null && stock !== undefined
                              ? t("billing.pos.stockCount", "Sklad: {count} ks", {
                                  count: stock,
                                })
                              : t("billing.pos.inStock", "Na sklade")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cart & Checkout (5 cols) */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:col-span-5 lg:self-start">
          {/* Client picker (optional) */}
          <div
            ref={clientPickerRef}
            className="space-y-2 rounded-lg border border-border bg-card p-3 text-xs shadow-xs"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <User className="h-3.5 w-3.5" />
                <span>
                  {t("billing.pos.clientSectionLabel", "Zákazník:")}
                </span>
              </span>
              {selectedClient ? (
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="text-[11px] text-primary hover:underline"
                >
                  {t(
                    "billing.pos.clientChangeToAnonymous",
                    "Zmeniť na anonymný"
                  )}
                </button>
              ) : null}
            </div>

            {selectedClient ? (
              <div
                className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/10 p-2 font-medium text-primary"
                aria-label={t(
                  "billing.pos.clientSelectedAria",
                  "Vybraný klient: {name}",
                  { name: selectedClient.name }
                )}
              >
                <span>{selectedClient.name}</span>
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder={t(
                    "billing.pos.clientSearchPlaceholder",
                    "Pultový zákazník (alebo píšte meno pre priradenie)..."
                  )}
                  value={clientSearch}
                  maxLength={CLIENT_SEARCH_MAX_LENGTH}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (clientSearch.length >= 2) setClientDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setClientDropdownOpen(false);
                  }}
                  aria-label={t(
                    "billing.pos.clientSearchLabel",
                    "Hľadať zákazníka"
                  )}
                  className="h-9 text-xs"
                />

                {clientDropdownOpen && clientSearch.length >= 2 && (
                  <div
                    role="listbox"
                    aria-label={t(
                      "billing.pos.clientResultsListAria",
                      "Zoznam nájdených klientov"
                    )}
                    className="absolute left-0 right-0 top-10 z-20 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
                  >
                    {isLoadingClients ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          {t(
                            "billing.pos.clientSearchLoading",
                            "Vyhľadávanie klientov..."
                          )}
                        </span>
                      </div>
                    ) : clientsError ? (
                      <div className="px-3 py-2 text-xs text-destructive">
                        {clientsError.message ||
                          t(
                            "billing.pos.clientSearchError",
                            "Chyba pri hľadaní klientov"
                          )}
                      </div>
                    ) : !clientsData?.items ||
                      clientsData.items.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        {t(
                          "billing.pos.clientSearchNoResults",
                          "Nenašli sa žiadni klienti"
                        )}
                      </div>
                    ) : (
                      clientsData.items.map((c) => {
                        const fullName = `${c.firstName || ""} ${c.lastName}`.trim();
                        return (
                          <button
                            key={c.id}
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => {
                              setSelectedClient({
                                id: c.id,
                                name: fullName,
                              });
                              setClientSearch("");
                              setClientDropdownOpen(false);
                            }}
                            className="w-full border-b border-border/40 px-3 py-2 text-left text-xs transition-colors last:border-0 hover:bg-muted"
                          >
                            <span className="font-medium text-foreground">
                              {fullName}
                            </span>
                            {c.phone && (
                              <span className="ml-2 text-muted-foreground">
                                ({c.phone})
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart items list */}
          <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ShoppingCart className="h-4 w-4" />
                <span>
                  {t("billing.pos.cartTitle", "Košík ({count})", {
                    count: cart.length,
                  })}
                </span>
              </span>
              {cart.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setClearDialogOpen(true)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  {t("billing.pos.clearCart", "Vyprázdniť")}
                </Button>
              )}
            </div>

            {cart.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title={t("billing.pos.emptyCartTitle", "Košík je prázdny")}
                description={t(
                  "billing.pos.emptyCartDesc",
                  "Vyberte položky zo skladu kliknutím vľavo alebo použite čítačku čiarových kódov."
                )}
                className="py-8"
              />
            ) : (
              <div className="max-h-[calc(100vh-420px)] min-h-[160px] space-y-3 overflow-y-auto pr-1">
                {cart.map((item) => {
                  const isPriceValid = isBillingCurrencyAmountInputValid(
                    item.unitPrice
                  );
                  const isDescValid = item.description.trim().length > 0;
                  const lineTotal = computePosTotals([
                    {
                      quantity: item.quantity,
                      unitPrice: Number(item.unitPrice) || 0,
                      discountPercent: item.discountPercent,
                    },
                  ]).total;

                  return (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Input
                          value={item.description}
                          maxLength={BILLING_INVOICE_LINE_DESCRIPTION_MAX_LENGTH}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((it) =>
                                it.id === item.id
                                  ? { ...it, description: e.target.value }
                                  : it
                              )
                            )
                          }
                          aria-label={t(
                            "billing.pos.itemDescription",
                            "Názov položky"
                          )}
                          className={cn(
                            "h-8 text-xs font-medium",
                            !isDescValid &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromCart(item.id)}
                          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={t(
                            "billing.pos.removeItem",
                            "Odstrániť {name} z košíka",
                            { name: item.description }
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Quantity controls: h-10 w-10 touch targets */}
                        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="h-10 w-10 shrink-0"
                            aria-label={t(
                              "billing.pos.decreaseQuantity",
                              "Znížiť množstvo položky {name}",
                              { name: item.description }
                            )}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="min-w-[28px] px-1 text-center font-semibold tabular-nums text-foreground">
                            {item.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="h-10 w-10 shrink-0"
                            aria-label={t(
                              "billing.pos.increaseQuantity",
                              "Zvýšiť množstvo položky {name}",
                              { name: item.description }
                            )}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* VAT selector */}
                        <select
                          value={item.vatRate}
                          onChange={(e) =>
                            updateVatRate(item.id, e.target.value as VatRate)
                          }
                          aria-label={t(
                            "billing.pos.vatRateLabel",
                            "Sadzba DPH"
                          )}
                          className={cn(filterControlClass, "h-9 text-xs")}
                        >
                          {vatRateOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {/* Price input */}
                        <div className="flex items-center gap-1 font-bold text-foreground">
                          <Input
                            inputMode="decimal"
                            value={item.unitPrice}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((it) =>
                                  it.id === item.id
                                    ? { ...it, unitPrice: e.target.value }
                                    : it
                                )
                              )
                            }
                            aria-invalid={!isPriceValid}
                            aria-label={t(
                              "billing.pos.unitPriceLabel",
                              "Jednotková cena"
                            )}
                            className={cn(
                              "h-9 w-20 text-right text-xs font-bold tabular-nums",
                              !isPriceValid &&
                                "border-destructive text-destructive focus-visible:ring-destructive"
                            )}
                          />
                        </div>

                        {/* Line total */}
                        <div className="min-w-16 text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>

                      {/* Line discount */}
                      <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-xs">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Percent className="h-3 w-3" />
                          <span>{t("billing.pos.discount", "Zľava")}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={item.discountPercent}
                            onChange={(e) =>
                              updateDiscount(
                                item.id,
                                Number(e.target.value)
                              )
                            }
                            className="h-8 w-16 text-right text-xs tabular-nums"
                            aria-label={t("billing.pos.discount", "Zľava")}
                          />
                          <span className="text-[11px] text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Totals Breakdown */}
            <div className="space-y-1.5 border-t border-border pt-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>{t("billing.pos.subtotal", "Medzisúčet")}</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("billing.pos.discount", "Zľava")}</span>
                  <span className="text-destructive tabular-nums">
                    -{formatCurrency(discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-dashed border-border pt-1 text-base font-bold text-foreground">
                <span>{t("billing.pos.totalDue", "Spolu k úhrade")}:</span>
                <span className="tabular-nums text-foreground">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
            </div>

            {!isCartValid && cart.length > 0 && (
              <p className="text-center text-xs text-destructive">
                {t(
                  "billing.pos.invalidCartHint",
                  "Skontrolujte, či všetky položky majú platný názov a správnu jednotkovú cenu."
                )}
              </p>
            )}

            {/* Action Payment Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="default"
                size="lg"
                onClick={() => handleCheckout("CASH")}
                disabled={!isCartValid || createPosSale.isPending}
                aria-busy={createPosSale.isPending}
                className="h-12 gap-2 text-sm font-semibold"
              >
                {createPosSale.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Coins className="h-5 w-5" />
                )}
                <span>
                  {t("billing.pos.payCash", "Hotovosť ({amount})", {
                    amount: formatCurrency(cartTotal),
                  })}
                </span>
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={() => handleCheckout("CARD")}
                disabled={!isCartValid || createPosSale.isPending}
                aria-busy={createPosSale.isPending}
                className="h-12 gap-2 text-sm font-semibold"
              >
                {createPosSale.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5" />
                )}
                <span>
                  {t("billing.pos.payCard", "Platobná karta ({amount})", {
                    amount: formatCurrency(cartTotal),
                  })}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <EkasaReceiptDialog
        open={receiptDialogOpen}
        receipt={completedReceipt}
        onClose={() => {
          setReceiptDialogOpen(false);
          searchInputRef.current?.focus();
        }}
      />

      {/* Clear Cart Confirmation Dialog */}
      <ActionConfirmationDialog
        open={clearDialogOpen}
        title={t(
          "billing.pos.clearCartDialogTitle",
          "Vyprázdniť nákupný košík?"
        )}
        description={t(
          "billing.pos.clearCartDialogDesc",
          "Všetky položky budú odstránené z košíka. Túto akciu nie je možné vrátiť späť."
        )}
        confirmLabel={t("billing.pos.clearCartConfirm", "Vyprázdniť")}
        cancelLabel={t("billing.pos.clearCartCancel", "Zrušiť")}
        confirmVariant="destructive"
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={() => {
          setCart([]);
          setClearDialogOpen(false);
        }}
      />
    </div>
  );
}
