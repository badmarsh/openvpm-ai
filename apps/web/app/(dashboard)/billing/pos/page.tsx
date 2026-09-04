"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Search,
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
  Barcode,
  Printer,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  EkasaReceiptDialog,
  type EkasaReceiptModalData,
} from "@/components/ekasa/ekasa-receipt-dialog";

interface CartItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: string;
  vatRate: "STANDARD_23" | "REDUCED_19" | "REDUCED_5" | "ZERO";
}

const VAT_RATE_OPTIONS = [
  { value: "STANDARD_23" as const, label: "23 % (Štandard)" },
  { value: "REDUCED_19" as const, label: "19 % (Krmivá/potraviny)" },
  { value: "REDUCED_5" as const, label: "5 % (Lieky)" },
  { value: "ZERO" as const, label: "0 % (Oslobodené)" },
];

export default function PosCheckoutPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = useSession();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Completed receipt dialog state
  const [completedReceipt, setCompletedReceipt] = useState<EkasaReceiptModalData | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  // Queries
  const { data: productsData, isLoading: isLoadingProducts } =
    trpc.inventory.list.useQuery({
      search: search || undefined,
      limit: 100,
    });

  const { data: clientsData } = trpc.clients.list.useQuery(
    { search: clientSearch },
    { enabled: clientSearch.length >= 2 }
  );

  const createPosSale = trpc.ekasa.createPosSale.useMutation({
    onSuccess: (data) => {
      toast.success("Doklad úspešne vystavený a zaevidovaný v e-Kase");
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
      toast.error(err.message || "Nepodarilo sa zaevidovať doklad v e-Kase");
    },
  });

  // Filtered products
  const products = useMemo(() => {
    if (!productsData?.items) return [];
    if (selectedCategory === "all") return productsData.items;
    return productsData.items.filter((p: { category?: string | null }) => p.category === selectedCategory);
  }, [productsData, selectedCategory]);

  const categories = useMemo<string[]>(() => {
    if (!productsData?.items) return ["all"];
    const cats = new Set<string>();
    for (const p of productsData.items) {
      if (p.category) cats.add(p.category);
    }
    return ["all", ...Array.from(cats)];
  }, [productsData]);

  // Cart actions
  const addToCart = (product: {
    id: string;
    name: string;
    unitPrice: string | number;
    category?: string | null;
  }) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      // Default VAT rate based on category / type
      let defaultVat: "STANDARD_23" | "REDUCED_19" | "REDUCED_5" | "ZERO" =
        "STANDARD_23";
      const cat = (product.category || "").toLowerCase();
      if (cat.includes("diet") || cat.includes("krmiv") || cat.includes("food")) {
        defaultVat = "REDUCED_19";
      } else if (cat.includes("med") || cat.includes("liek")) {
        defaultVat = "REDUCED_5";
      }

      return [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          productId: product.id,
          description: product.name,
          quantity: 1,
          unitPrice: Number(product.unitPrice).toFixed(2),
          vatRate: defaultVat,
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
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateVatRate = (
    id: string,
    vatRate: "STANDARD_23" | "REDUCED_19" | "REDUCED_5" | "ZERO"
  ) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, vatRate } : item))
    );
  };

  // Add custom manual item
  const addCustomItem = () => {
    setCart((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        description: "Pultová položka / Služba",
        quantity: 1,
        unitPrice: "5.00",
        vatRate: "STANDARD_23",
      },
    ]);
  };

  // Calculations
  const cartTotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0
    );
  }, [cart]);

  const handleCheckout = (paymentMethod: "CASH" | "CARD") => {
    if (cart.length === 0) {
      toast.error("Košík je prázdny");
      return;
    }

    createPosSale.mutate({
      items: cart.map((item) => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      })),
      paymentMethod,
      clientId: selectedClient?.id,
      paperWidth,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href="/billing">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span>Späť na fakturáciu</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span>Pultový predaj (Rýchla pokladňa)</span>
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                e-Kasa Zero-Touch
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Okamžitý predaj antiparazitík, krmív a liečiv s automatickým bločkom a odpisom zo skladu
            </p>
          </div>
        </div>

        {/* Paper width selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tlačiareň:</span>
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPaperWidth("80mm")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                paperWidth === "80mm"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              80 mm
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth("58mm")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                paperWidth === "58mm"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              58 mm
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Catalog on left, Cart & Payment on right */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Product Catalog (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hľadať tovar (názov, SKU, Bravecto, granule...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addCustomItem}
              className="gap-1.5 whitespace-nowrap text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Voľná položka</span>
            </Button>
          </div>

          {/* Categories pills */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat: string) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat === "all" ? "Všetok tovar" : cat}
                </button>
              ))}
            </div>
          )}

          {/* Products List / Grid */}
          <div className="rounded-lg border border-border bg-card p-2">
            {isLoadingProducts ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenašli sa žiadne produkty podľa zadaných kritérií.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 max-h-[520px] overflow-y-auto p-1">
                {products.map((p: any) => {
                  const stock = (p as any).stockQuantity;
                  const price = Number(p.unitPrice || 0).toFixed(2);
                  const isLowStock = stock !== null && stock !== undefined && stock <= 2;

                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="flex flex-col justify-between p-3 rounded-lg border border-border/80 bg-background text-left hover:border-primary/50 hover:bg-muted/30 transition-all group"
                    >
                      <div>
                        <div className="font-semibold text-xs line-clamp-1 group-hover:text-primary">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {(p as any).category || "Skladová položka"} {p.sku ? `• ${p.sku}` : ""}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                        <span className="font-bold text-sm text-foreground">
                          {price} €
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            isLowStock
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "text-muted-foreground"
                          }`}
                        >
                          {stock !== null && stock !== undefined
                            ? `Sklad: ${stock} ks`
                            : "Na sklade"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cart & Checkout (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Client picker (optional) */}
          <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Zákazník:
              </span>
              {selectedClient ? (
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-primary hover:underline text-[11px]"
                >
                  Zmeniť na anonymný
                </button>
              ) : null}
            </div>

            {selectedClient ? (
              <div className="flex items-center justify-between p-2 rounded bg-muted/40 font-medium text-foreground">
                <span>{selectedClient.name}</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Pultový zákazník (alebo píšte meno pre priradenie)..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                {clientsData && clientsData.items && clientsData.items.length > 0 && (
                  <div className="absolute top-9 left-0 right-0 z-20 rounded-md border border-border bg-card shadow-lg max-h-36 overflow-y-auto">
                    {clientsData.items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient({
                            id: c.id,
                            name: `${c.firstName || ""} ${c.lastName}`.trim(),
                          });
                          setClientSearch("");
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-muted text-xs border-b border-border/40 last:border-0"
                      >
                        {c.firstName} {c.lastName} {c.phone ? `(${c.phone})` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart items list */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-semibold text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Košík ({cart.length})
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Vyprázdniť
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                Košík je prázdny. Vyberte položky zo skladu kliknutím vľavo.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((it) =>
                              it.id === item.id
                                ? { ...it, description: e.target.value }
                                : it
                            )
                          )
                        }
                        className="font-medium text-foreground bg-transparent border-0 p-0 focus:ring-0 w-full"
                      />
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-1.5 rounded border border-border bg-card px-1.5 py-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-semibold px-1 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* VAT selector */}
                      <select
                        value={item.vatRate}
                        onChange={(e) =>
                          updateVatRate(item.id, e.target.value as any)
                        }
                        className="rounded border border-border bg-card px-1.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {VAT_RATE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {/* Price input */}
                      <div className="flex items-center gap-1 font-bold text-foreground">
                        <input
                          type="text"
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
                          className="w-16 text-right rounded border border-border bg-card px-1.5 py-0.5 font-bold"
                        />
                        <span>€</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totals Breakdown */}
            <div className="border-t border-border pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-dashed border-border">
                <span>Spolu k úhrade:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {cartTotal.toFixed(2)} €
                </span>
              </div>
            </div>

            {/* Action Payment Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="default"
                size="lg"
                onClick={() => handleCheckout("CASH")}
                disabled={cart.length === 0 || createPosSale.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-12 text-sm font-semibold"
              >
                {createPosSale.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Coins className="h-5 w-5" />
                )}
                <span>Hotovosť</span>
              </Button>

              <Button
                variant="default"
                size="lg"
                onClick={() => handleCheckout("CARD")}
                disabled={cart.length === 0 || createPosSale.isPending}
                className="gap-2 bg-blue-600 hover:bg-blue-700 h-12 text-sm font-semibold"
              >
                {createPosSale.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5" />
                )}
                <span>Platobná karta</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Ekasa Receipt Modal Dialog */}
      <EkasaReceiptDialog
        open={receiptDialogOpen}
        receipt={completedReceipt}
        onClose={() => setReceiptDialogOpen(false)}
      />
    </div>
  );
}
