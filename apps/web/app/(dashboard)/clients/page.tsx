"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Plus, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { TableSkeleton } from "@/components/common/loading";
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
    <div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {t("clients.title", "Clients")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("clients.subtitle", "Manage client information")}
          </p>
        </div>
        {canManageClients && (
          <Button
            onClick={() => router.push("/clients/new")}
            className="h-11 w-full sm:h-10 sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("clients.new_client", "New Client")}
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative w-full min-w-0 sm:max-w-sm sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("clients.search_placeholder", "Search clients...")}
            value={search}
            maxLength={CLIENT_SEARCH_MAX_LENGTH}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9 sm:h-10"
          />
        </div>
        {verifiedClientList && (
          <p className="text-sm text-muted-foreground sm:shrink-0">
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
      </div>

      {error || clientsMissing ? (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message ??
            t("common.error_retry", "Unable to load clients. Please retry.")}
        </div>
      ) : isLoading ? (
        <TableSkeleton rows={8} cols={5} className="mt-6" />
      ) : verifiedClientList && verifiedClientList.items.length > 0 ? (
        <>
          <div className="mt-6 space-y-3 sm:hidden">
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

          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t("clients.column_name", "Name")}
                  </th>
                  <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t("clients.column_email", "Email")}
                  </th>
                  <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t("clients.column_phone", "Phone")}
                  </th>
                  <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t("clients.column_city", "City")}
                  </th>
                  <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t("clients.column_created", "Created")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {verifiedClientList.items.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {client.firstName} {client.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client.email || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client.phone || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client.city || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
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
          </div>
        </>
      ) : (
        <EmptyState
          className="mt-6"
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
