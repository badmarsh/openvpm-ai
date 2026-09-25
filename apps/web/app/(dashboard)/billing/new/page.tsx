"use client";

import { quantityLineTotalCents } from "@/lib/quantity";

import { useEffect, useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Trash2, ArrowLeft, Loader2, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { formatSpecies } from "@/lib/patients/species";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  pageShellClass,
  filterControlClass,
  tableHeadClass,
  tableCellClass,
  tableRowClass,
} from "@/components/layout/page-kit";
import { toast } from "sonner";
import { ServicePicker } from "@/components/billing/service-picker";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { formatCurrency } from "@/lib/locale/format";
import {
  CLIENT_SEARCH_MAX_LENGTH,
  isClientSearchInputValid,
} from "@/lib/clients/policy";
import {
  BILLING_INVOICE_LINE_DESCRIPTION_MAX_LENGTH,
  BILLING_INVOICE_LINE_QUANTITY_MAX,
  BILLING_INVOICE_LINE_QUANTITY_MIN,
  BILLING_INVOICE_MAX_ITEMS,
  BILLING_UNIT_PRICE_MAX,
  isBillingCurrencyAmountInputValid,
  isBillingInvoiceLineQuantityValid,
  isBillingInvoiceLineTotalValid,
  isBillingInvoiceSubtotalValid,
} from "@/lib/billing/policy";
import { centsToMoney, moneyToCents } from "@/lib/billing/invoice-balance";
import { tryCalculateInvoiceTaxTotals } from "@/lib/billing/invoice-tax";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  itemType: "service" | "product";
  itemId?: string;
  taxable: boolean;
}

function canManageBillingRole(role?: string | null): boolean {
  return role === "admin" || role === "front_desk";
}

function InlineQueryMessage({
  kind,
  children,
}: {
  kind: "error" | "loading" | "muted";
  children: ReactNode;
}) {
  return (
    <div
      className={
        kind === "error"
          ? "rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          : "flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      }
    >
      {kind === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </div>
  );
}

function addDateInputDays(dateInput: string, days: number): string {
  const [year, month, day] = dateInput.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function defaultDueDate(timeZone?: string | null): string {
  const today = formatDateInputForTimeZone(new Date(), timeZone);
  return addDateInputDays(today, 30);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl">
        <div className={pageShellClass}>
          <InlineQueryMessage kind="loading">
            {t("billing.new.checkingAccess", "Checking billing access...")}
          </InlineQueryMessage>
        </div>
      </div>
    );
  }

  if (!canManageBillingRole(session?.user?.role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className={pageShellClass}>
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => router.push("/billing")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("billing.new.backToBilling", "Back to Billing")}
          </Button>
          <EmptyState
            icon={FileText}
            title={t("billing.new.readOnlyTitle", "Billing actions are read-only")}
            description={t(
              "billing.new.readOnlyDesc",
              "Only admins and front desk staff can create invoices or estimates."
            )}
            action={{
              label: t("billing.new.backToBilling", "Back to Billing"),
              onClick: () => router.push("/billing"),
            }}
          />
        </div>
      </div>
    );
  }

  return <NewInvoiceForm />;
}

function NewInvoiceForm() {
  const router = useRouter();
  const { t } = useI18n();

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  // Patient
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  // Line items
  const [items, setItems] = useState<LineItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState("");

  // Estimate toggle
  const [isEstimate, setIsEstimate] = useState(false);

  // Due date
  const [dueDate, setDueDate] = useState("");
  const [dueDateTouched, setDueDateTouched] = useState(false);
  const trimmedClientSearch = clientSearch.trim();
  const canSearchClients = isClientSearchInputValid(clientSearch);

  // Queries
  const clientResults = trpc.clients.search.useQuery(
    { query: trimmedClientSearch },
    { enabled: canSearchClients }
  );
  const clientResultsMissing =
    canSearchClients &&
    !selectedClient &&
    !clientResults.isLoading &&
    !clientResults.error &&
    !clientResults.data;
  const clientOptions =
    clientResults.data && !clientResults.error && !clientResultsMissing
      ? clientResults.data
      : [];

  const patientResults = trpc.billing.patientsByClient.useQuery(
    { clientId: selectedClient?.id ?? "" },
    { enabled: !!selectedClient }
  );
  const patientResultsMissing =
    Boolean(selectedClient) &&
    !patientResults.isLoading &&
    !patientResults.error &&
    !patientResults.data;
  const patientOptions =
    patientResults.data && !patientResults.error && !patientResultsMissing
      ? patientResults.data
      : [];

  const servicesQuery = trpc.billing.listServices.useQuery();
  const servicesMissing =
    !servicesQuery.isLoading && !servicesQuery.error && !servicesQuery.data;
  const serviceOptions =
    servicesQuery.data && !servicesQuery.error && !servicesMissing
      ? servicesQuery.data
      : [];
  const taxConfigQuery = trpc.billing.getTaxConfig.useQuery();
  const taxConfig = taxConfigQuery.data;
  const taxConfigMissing =
    !taxConfigQuery.isLoading && !taxConfigQuery.error && !taxConfig;
  const taxConfigReady = taxConfig !== undefined && !taxConfigQuery.error;

  useEffect(() => {
    if (!dueDateTouched && taxConfigReady && taxConfig) {
      setDueDate(defaultDueDate(taxConfig.timezone));
    }
  }, [dueDateTouched, taxConfig, taxConfigReady]);

  // Mutation
  const utils = trpc.useUtils();
  const createInvoice = trpc.billing.createInvoice.useMutation({
    onSuccess: () => {
      toast.success(t("billing.new.toastInvoiceCreated", "Invoice created"));
      utils.billing.listInvoices.invalidate();
      router.push("/billing");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Calculations — preview only; the server recomputes tax authoritatively
  // from the practice's configured (region-aware) rate.
  const taxPercent =
    taxConfigReady && taxConfig ? taxConfig.taxRatePercent : "0.00";
  const currency = taxConfigReady && taxConfig ? taxConfig.currency : "usd";
  const country = taxConfigReady && taxConfig ? taxConfig.country : "US";
  const fmt = (v: number | string | null | undefined) =>
    taxConfigReady ? formatCurrency(v, currency, country) : "—";
  const previewTotals = useMemo(
    () =>
      tryCalculateInvoiceTaxTotals(
        items.map((item) => ({
          lineTotalCents: quantityLineTotalCents(moneyToCents(item.unitPrice || "0"), item.quantity),
          taxable: item.taxable,
        })),
        taxPercent,
      ),
    [items, taxPercent],
  );
  const subtotal = centsToMoney(previewTotals?.subtotalCents ?? 0);
  const tax = centsToMoney(previewTotals?.taxCents ?? 0);
  const total = centsToMoney(previewTotals?.totalCents ?? 0);
  const trimmedItemDescription = itemDescription.trim();
  const isDraftLineItemValid =
    trimmedItemDescription.length > 0 &&
    trimmedItemDescription.length <=
      BILLING_INVOICE_LINE_DESCRIPTION_MAX_LENGTH &&
    isBillingInvoiceLineQuantityValid(itemQuantity) &&
    isBillingCurrencyAmountInputValid(itemUnitPrice) &&
    isBillingInvoiceLineTotalValid(itemUnitPrice, itemQuantity);
  const canAddItem =
    isDraftLineItemValid &&
    items.length < BILLING_INVOICE_MAX_ITEMS &&
    !servicesQuery.isLoading &&
    !servicesQuery.error &&
    !servicesMissing;
  const canSubmitInvoice =
    Boolean(selectedClient) &&
    dueDate.trim().length > 0 &&
    items.length > 0 &&
    items.length <= BILLING_INVOICE_MAX_ITEMS &&
    isBillingInvoiceSubtotalValid(items) &&
    Boolean(previewTotals) &&
    !createInvoice.isPending;

  function handleServiceSelect(serviceId: string) {
    setSelectedServiceId(serviceId);
    const service = serviceOptions.find((s) => s.id === serviceId);
    if (service) {
      setItemDescription(service.name);
      setItemUnitPrice(service.defaultPrice);
    }
  }

  function handleAddItem() {
    if (!canAddItem) return;
    const service = serviceOptions.find((s) => s.id === selectedServiceId);
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: trimmedItemDescription,
        quantity: itemQuantity,
        unitPrice: itemUnitPrice.trim(),
        itemType: "service",
        itemId: service?.id,
        taxable: service?.taxable ?? true,
      },
    ]);
    setSelectedServiceId("");
    setItemDescription("");
    setItemQuantity(1);
    setItemUnitPrice("");
  }

  function handleRemoveItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSubmit() {
    if (!selectedClient || items.length === 0) return;
    createInvoice.mutate({
      clientId: selectedClient.id,
      patientId: selectedPatientId || undefined,
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice.trim(),
        itemType: item.itemType,
        itemId: item.itemId,
      })),
      dueDate: dueDate || undefined,
      isEstimate,
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className={pageShellClass}>
        <PageHeader
          icon={FileText}
          title={
            isEstimate
              ? t("billing.new.titleEstimate", "New Estimate")
              : t("billing.new.titleInvoice", "New Invoice")
          }
          subtitle={
            isEstimate
              ? t(
                  "billing.new.descEstimate",
                  "Create an estimate that can be converted to an invoice later."
                )
              : t(
                  "billing.new.descInvoice",
                  "Create a new invoice for a client."
                )
          }
          actions={
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="estimate-toggle"
                  checked={isEstimate}
                  onCheckedChange={setIsEstimate}
                />
                <Label
                  htmlFor="estimate-toggle"
                  className="cursor-pointer text-xs font-medium"
                >
                  {t("billing.new.estimateCheckbox", "Estimate")}
                </Label>
              </div>

              <Link href="/billing">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>
                    {t("billing.new.backToBilling", "Back to Billing")}
                  </span>
                </Button>
              </Link>
            </div>
          }
        />

        {/* Section 1: Client & Patient */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div>
            <Label htmlFor="client-search" className="mb-1.5 block text-xs font-medium">
              {t("billing.new.clientLabel", "Client *")}
            </Label>
            {selectedClient ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                <span className="font-medium text-foreground">
                  {selectedClient.firstName} {selectedClient.lastName}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedClient(null);
                    setSelectedPatientId("");
                    setClientSearch("");
                  }}
                >
                  {t("billing.new.changeClient", "Change")}
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="client-search"
                  placeholder={t(
                    "billing.new.searchClientsPlaceholder",
                    "Search clients..."
                  )}
                  value={clientSearch}
                  maxLength={CLIENT_SEARCH_MAX_LENGTH}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-9 text-xs"
                />
                {canSearchClients &&
                  (clientResults.isLoading ||
                    clientResults.error ||
                    clientResultsMissing ||
                    clientResults.data) && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                    {clientResults.error || clientResultsMissing ? (
                      <div className="px-4 py-3 text-xs text-destructive">
                        {clientResults.error?.message ??
                          t(
                            "billing.new.searchClientsError",
                            "Unable to search clients. Please retry."
                          )}
                      </div>
                    ) : clientResults.isLoading ? (
                      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          {t("billing.new.searchingClients", "Searching clients...")}
                        </span>
                      </div>
                    ) : clientOptions.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">
                        {t("billing.new.noClientsFound", "No clients found")}
                      </div>
                    ) : (
                      clientOptions.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full border-b border-border/40 px-4 py-2 text-left text-xs transition-colors last:border-0 hover:bg-muted/50"
                          onClick={() => {
                            setSelectedClient({
                              id: client.id,
                              firstName: client.firstName,
                              lastName: client.lastName,
                            });
                            setClientSearch("");
                          }}
                        >
                          <span className="font-medium text-foreground">
                            {client.firstName} {client.lastName}
                          </span>
                          {client.email && (
                            <span className="ml-2 text-muted-foreground">
                              {client.email}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Patient Select */}
          {selectedClient && (
            <div className="space-y-1.5">
              <Label htmlFor="patient-select" className="text-xs font-medium">
                {t("billing.new.patientLabel", "Patient (optional)")}
              </Label>
              <select
                id="patient-select"
                className={cn(filterControlClass, "w-full")}
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                <option value="">
                  {t("billing.new.noPatientOption", "-- No patient --")}
                </option>
                {patientOptions.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} ({formatSpecies(patient.species, t)})
                  </option>
                ))}
              </select>
              {patientResults.error || patientResultsMissing ? (
                <InlineQueryMessage kind="error">
                  {patientResults.error
                    ? t(
                        "billing.new.loadPatientsErrorMessage",
                        "Unable to load client patients. {message}",
                        { message: patientResults.error.message }
                      )
                    : t(
                        "billing.new.loadPatientsError",
                        "Unable to load client patients. Please retry."
                      )}
                </InlineQueryMessage>
              ) : patientResults.isLoading ? (
                <InlineQueryMessage kind="loading">
                  {t("billing.new.loadingPatients", "Loading client patients...")}
                </InlineQueryMessage>
              ) : null}
            </div>
          )}
        </div>

        {/* Section 2: Line Items */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs">
          <Label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("billing.new.lineItemsLabel", "Line Items")}
          </Label>

          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3">
            {servicesQuery.error || servicesMissing ? (
              <InlineQueryMessage kind="error">
                {servicesQuery.error
                  ? t(
                      "billing.new.loadServicesErrorMessage",
                      "Unable to load billing services. {message}",
                      { message: servicesQuery.error.message }
                    )
                  : t(
                      "billing.new.loadServicesError",
                      "Unable to load billing services. Please retry."
                    )}
              </InlineQueryMessage>
            ) : servicesQuery.isLoading ? (
              <InlineQueryMessage kind="loading">
                {t("billing.new.loadingServices", "Loading billing services...")}
              </InlineQueryMessage>
            ) : null}

            <ServicePicker
              services={serviceOptions}
              value={selectedServiceId}
              onSelect={handleServiceSelect}
              disabled={
                servicesQuery.isLoading ||
                Boolean(servicesQuery.error) ||
                servicesMissing
              }
            />

            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-12">
              <div className="space-y-1 sm:col-span-6">
                <Label htmlFor="line-description" className="text-xs font-medium">
                  {t("billing.new.colDescription", "Description")}
                </Label>
                <Input
                  id="line-description"
                  value={itemDescription}
                  maxLength={BILLING_INVOICE_LINE_DESCRIPTION_MAX_LENGTH}
                  placeholder={t(
                    "billing.new.descriptionPlaceholder",
                    "Description"
                  )}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="line-quantity" className="text-xs font-medium">
                  {t("billing.new.colQty", "Qty")}
                </Label>
                <Input
                  id="line-quantity"
                  type="number"
                  step="0.001"
                  min={BILLING_INVOICE_LINE_QUANTITY_MIN}
                  max={BILLING_INVOICE_LINE_QUANTITY_MAX}
                  placeholder={t("billing.new.qtyPlaceholder", "Qty")}
                  value={itemQuantity}
                  onChange={(e) =>
                    setItemQuantity(parseFloat(e.target.value) || 0)
                  }
                  className="h-9 text-xs tabular-nums"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="line-unit-price" className="text-xs font-medium">
                  {t("billing.new.colUnitPrice", "Unit Price")}
                </Label>
                <Input
                  id="line-unit-price"
                  type="number"
                  step="0.01"
                  min={0}
                  max={BILLING_UNIT_PRICE_MAX}
                  placeholder={t("billing.new.unitPricePlaceholder", "Unit Price")}
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                  className="h-9 text-xs tabular-nums"
                />
              </div>

              <div className="sm:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddItem}
                  disabled={!canAddItem}
                  className="h-9 w-full text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("billing.new.addButton", "Add")}
                </Button>
              </div>
            </div>
          </div>

          {/* Table of items */}
          {items.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {t("billing.new.noItemsAdded", "No line items added yet.")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className={cn(tableHeadClass, "w-[45%]")}>
                      {t("billing.new.colDescription", "Description")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("billing.new.colQty", "Qty")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("billing.new.colUnitPrice", "Unit Price")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("billing.new.colTotal", "Total")}
                    </th>
                    <th className={cn(tableHeadClass, "w-10 text-right")}>
                      <span className="sr-only">{t("common.actions", "Actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={tableRowClass}>
                      <td className={tableCellClass}>
                        <span className="font-medium text-foreground">
                          {item.description}
                        </span>
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {item.taxable
                            ? t("billing.new.taxable", "Taxable")
                            : t("billing.new.notTaxable", "Not taxable")}
                        </span>
                      </td>
                      <td className={cn(tableCellClass, "text-right tabular-nums")}>
                        {item.quantity}
                      </td>
                      <td className={cn(tableCellClass, "text-right tabular-nums")}>
                        {fmt(item.unitPrice)}
                      </td>
                      <td className={cn(tableCellClass, "text-right tabular-nums")}>
                        {fmt(centsToMoney(quantityLineTotalCents(moneyToCents(item.unitPrice), item.quantity)))}
                      </td>
                      <td className={cn(tableCellClass, "text-right")}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={t(
                            "billing.new.removeLineItem",
                            "Remove {description}",
                            { description: item.description }
                          )}
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: Totals */}
        {items.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-xs shadow-xs">
            {!previewTotals && taxConfigReady ? (
              <div className="mb-2">
                <InlineQueryMessage kind="error">
                  {t(
                    "billing.new.taxRateError",
                    "Set the practice tax rate between 0 and 100% and keep the invoice total within the supported currency range before creating this invoice."
                  )}
                </InlineQueryMessage>
              </div>
            ) : taxConfigQuery.error || taxConfigMissing ? (
              <div className="mb-2">
                <InlineQueryMessage kind="error">
                  {t(
                    "billing.new.loadTaxError",
                    "Unable to load practice tax settings. Preview totals omit tax until settings load."
                  )}
                </InlineQueryMessage>
              </div>
            ) : taxConfigQuery.isLoading ? (
              <div className="mb-2">
                <InlineQueryMessage kind="loading">
                  {t(
                    "billing.new.loadingTax",
                    "Loading practice tax settings..."
                  )}
                </InlineQueryMessage>
              </div>
            ) : null}

            <div className="flex justify-between text-muted-foreground">
              <span>{t("billing.new.subtotal", "Subtotal")}</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t("billing.new.taxWithPercent", `Tax (${taxPercent}%)`, {
                  taxPercent,
                })}
              </span>
              <span className="tabular-nums">{fmt(tax)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
              <span>{t("billing.new.total", "Total")}</span>
              <span className="tabular-nums">{fmt(total)}</span>
            </div>
          </div>
        )}

        {/* Section 4: Due Date & Actions */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="space-y-1.5">
            <Label htmlFor="due-date" className="text-xs font-medium">
              {t("billing.new.dueDateLabel", "Due Date")}
            </Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDateTouched(true);
                setDueDate(e.target.value);
              }}
              className="h-9 text-xs"
            />
            {!dueDate && taxConfigQuery.isLoading ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "billing.new.loadingDateSettings",
                  "Loading practice date settings..."
                )}
              </p>
            ) : null}
            {!dueDate && (taxConfigQuery.error || taxConfigMissing) ? (
              <p className="mt-1 text-xs text-destructive">
                {t(
                  "billing.new.manualDueDateError",
                  "Choose a due date manually. Practice settings could not load."
                )}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={
              !canSubmitInvoice
              }
            >
              {createInvoice.isPending
                ? t("billing.new.creatingButton", "Creating...")
                : isEstimate
                ? t("billing.new.createEstimateButton", "Create Estimate")
                : t("billing.new.createInvoiceButton", "Create Invoice")}
            </Button>
            <Button variant="outline" onClick={() => router.push("/billing")}>
              {t("billing.new.cancelButton", "Cancel")}
            </Button>
          </div>

          {createInvoice.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {createInvoice.error.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
