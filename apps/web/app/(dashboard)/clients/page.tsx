"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Users, Phone, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { TableSkeleton } from "@/components/common/loading";
import { PageHeader } from "@/components/layout/page-header";
import {
  DataTableFrame,
  PageToolbar,
  SearchField,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from "@/components/layout/page-kit";
import { cn } from "@/lib/utils";
import { CLIENT_SEARCH_MAX_LENGTH } from "@/lib/clients/policy";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import { useI18n } from "@/lib/i18n";

function canManageClientsRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();
  const hasSearch = trimmedSearch.length > 0;
  const canManageClients = canManageClientsRole(session?.user?.role);

  const { data, isLoading, error } = trpc.clients.list.useQuery({
    search: hasSearch ? trimmedSearch : undefined,
    limit: 25,
    offset: 0,
  });
  const clientsMissing = !isLoading && !error && !data;
  const verifiedClientList = error || clientsMissing || !data ? null : data;
  const clientListTimeZone = verifiedClientList
    ? verifiedClientList.timezone
    : null;

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Users}
        title={t("clients.title", "Clients")}
        subtitle={t("clients.subtitle", "Manage client information")}
        actions={
          canManageClients ? (
            <Button
              size="sm"
              onClick={() => router.push("/clients/new")}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("clients.new_client", "New Client")}
            </Button>
          ) : null
        }
      />

      <PageToolbar>
        <SearchField
          value={search}
          maxLength={CLIENT_SEARCH_MAX_LENGTH}
          placeholder={t("clients.search_placeholder", "Search clients...")}
          onChange={setSearch}
        />
        {verifiedClientList && (
          <p className="text-xs text-muted-foreground sm:ml-auto sm:shrink-0">
            {verifiedClientList.total === 1
              ? t("clients.plural_one", "1 client", {
                  count: verifiedClientList.total,
                })
              : verifiedClientList.total >= 2 && verifiedClientList.total <= 4
                ? t(
                    "clients.plural_few",
                    `${verifiedClientList.total} clients`,
                    { count: verifiedClientList.total },
                  )
                : t(
                    "clients.plural_other",
                    `${verifiedClientList.total} clients`,
                    { count: verifiedClientList.total },
                  )}
          </p>
        )}
      </PageToolbar>

      {error || clientsMissing ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message ??
            t("common.error_retry", "Unable to load clients. Please retry.")}
        </div>
      ) : isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : verifiedClientList && verifiedClientList.items.length > 0 ? (
        <>
          <div className="space-y-3 sm:hidden">
            {verifiedClientList.items.map((client) => {
              const fullName = `${client.firstName} ${client.lastName}`;

              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => router.push(`/clients/${client.id}`)}
                  aria-label={t("clients.openClient", "Open client {name}", {
                    name: fullName,
                  })}
                  className="min-h-11 w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {fullName}
                  </span>
                  <span className="mt-2 block min-w-0 space-y-1 text-sm text-muted-foreground">
                    <span className="block truncate">
                      {client.phone ||
                        t("clients.noPhone", "No phone on file")}
                    </span>
                    <span className="block truncate">
                      {client.email ||
                        t("clients.noEmail", "No email on file")}
                    </span>
                    <span className="flex min-w-0 items-center justify-between gap-3 text-xs">
                      <span className="truncate">
                        {client.city ||
                          t("clients.cityNotListed", "City not listed")}
                      </span>
                      <span className="shrink-0">
                        {t("clients.addedPrefix", "Added {date}", {
                          date: formatClinicalDate(
                            client.createdAt,
                            clientListTimeZone,
                            "—",
                          ),
                        })}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <DataTableFrame className="hidden sm:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className={tableHeadClass}>
                    {t("clients.column_name", "Name")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("clients.column_email", "Email")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("clients.column_phone", "Phone")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("clients.column_city", "City")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("clients.column_created", "Created")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {verifiedClientList.items.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className={cn("cursor-pointer", tableRowClass)}
                  >
                    <td className={tableCellClass}>
                      <div className="font-medium text-foreground">{client.firstName} {client.lastName}</div>
                      {(client.patientCount > 0 || client.city) && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {[
                            client.patientCount > 0
                              ? t(
                                  client.patientCount === 1
                                    ? "patients.plural_one"
                                    : client.patientCount >= 2 && client.patientCount <= 4
                                    ? "patients.plural_few"
                                    : "patients.plural_other",
                                  client.patientCount === 1 ? "{count} patient" : "{count} patients",
                                  { count: client.patientCount },
                                )
                              : null,
                            client.city || null,
                          ].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className={cn(tableCellClass, "text-muted-foreground")}>
                      {client.email ? (
                        <a
                          href={`mailto:${client.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 text-muted-foreground hover:text-primary transition-colors group"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                          <span className="text-xs group-hover:underline truncate max-w-[160px]">{client.email}</span>
                        </a>
                      ) : "\u2014"}
                    </td>
                    <td className={cn(tableCellClass, "text-muted-foreground")}>
                      {client.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <a
                            href={`tel:${client.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 text-muted-foreground hover:text-primary transition-colors group"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                            <span className="font-mono tabular-nums text-xs group-hover:underline">{client.phone}</span>
                          </a>
                          {client.smsConsent && (
                            <Badge variant="success" className="text-[10px] px-1 py-0">SMS</Badge>
                          )}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className={cn(tableCellClass, "text-muted-foreground")}>
                      {client.city || "\u2014"}
                    </td>
                    <td className={cn(tableCellClass, "text-muted-foreground")}>
                      {formatClinicalDate(
                        client.createdAt,
                        clientListTimeZone,
                        "\u2014",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        </>
      ) : (
        <EmptyState
          icon={Users}
          title={
            hasSearch
              ? t(
                  "clients.empty_search_title",
                  "No clients match your search",
                )
              : t("clients.empty_title", "No clients yet")
          }
          description={
            hasSearch
              ? t(
                  "clients.empty_search_desc",
                  "Try a different name, phone number, or email address.",
                )
              : t(
                  "clients.empty_desc",
                  "Create a client record before adding patients, appointments, or invoices.",
                )
          }
          action={
            !hasSearch && canManageClients
              ? {
                  label: t("clients.empty_action", "Add your first client"),
                  onClick: () => router.push("/clients/new"),
                  icon: Plus,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
