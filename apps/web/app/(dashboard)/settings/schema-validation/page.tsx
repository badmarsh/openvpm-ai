"use client";

import { useMemo, useState } from "react";
import { FileJson, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DataTableFrame,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageHeader,
  PageToolbar,
  SearchField,
  TableSkeleton,
  filterControlClass,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from "@/components/layout/page-kit";
import { formatDateTimeToDisplay } from "@/lib/date-display";

const PLAYGROUND_SAMPLES: Record<string, string> = {
  "openvpm.client-registration": JSON.stringify(
    {
      firstName: "Jana",
      lastName: "Kováčová",
      email: "jana.kovac@example.com",
      phone: "+421901234567",
      marketingConsent: false,
      origin: { source: "manual" },
    },
    null,
    2,
  ),
  "openvpm.prescription-order": JSON.stringify(
    {
      patientId: "6f9c1c2a-0000-4000-8000-000000000001",
      medication: "Ketamín 100 mg/ml",
      dosage: "0,5 ml IV",
      frequency: "jednorazovo",
      quantity: 1,
      status: "draft",
      origin: { source: "ai-prefill" },
    },
    null,
    2,
  ),
  "openvpm.care-reminder": JSON.stringify(
    {
      patientId: "6f9c1c2a-0000-4000-8000-000000000001",
      title: "Kontrola po ošetrení",
      dueDate: "2026-10-05",
      automated: true,
      channels: ["email"],
      patientStatus: "deceased",
      origin: { source: "manual" },
    },
    null,
    2,
  ),
  "openvpm.ai-clinical-suggestion": JSON.stringify(
    {
      patientId: "6f9c1c2a-0000-4000-8000-000000000001",
      suggestionType: "treatment_plan",
      content: "Odporúčaný postup: …",
      status: "draft",
      modelId: "openvpm-copilot-1",
      confidence: 0.87,
      origin: { source: "ai" },
    },
    null,
    2,
  ),
};

export default function SchemaValidationPage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [contractSearch, setContractSearch] = useState("");
  const [eventResult, setEventResult] = useState<"all" | "passed" | "rejected">(
    "all",
  );
  const [guardrailOnly, setGuardrailOnly] = useState(false);
  const [playgroundContract, setPlaygroundContract] = useState(
    "openvpm.prescription-order",
  );
  const [playgroundPayload, setPlaygroundPayload] = useState(
    PLAYGROUND_SAMPLES["openvpm.prescription-order"] ?? "",
  );

  const statsQuery = trpc.extensions.schemaValidation.stats.useQuery({
    days: 30,
  });
  const contractsQuery = trpc.extensions.schemaValidation.listContracts.useQuery();
  const eventsQuery = trpc.extensions.schemaValidation.listEvents.useQuery({
    result: eventResult === "all" ? undefined : eventResult,
    guardrailOnly,
    limit: 50,
  });
  const validateMutation = trpc.extensions.schemaValidation.validatePayload.useMutation(
    {
      onSuccess: (data) => {
        if (data.ok) {
          toast.success(t("schemaValidation.playground.resultPassed"));
        } else {
          toast.warning(t("schemaValidation.playground.resultRejected"));
        }
      },
      onError: (error) => {
        toast.error(
          t("schemaValidation.playground.loadError", undefined, {
            message: error.message,
          }),
        );
      },
    },
  );

  const filteredContracts = useMemo(() => {
    const needle = contractSearch.trim().toLowerCase();
    const contracts = contractsQuery.data ?? [];
    if (!needle) return contracts;
    return contracts.filter(
      (contract) =>
        contract.id.toLowerCase().includes(needle) ||
        contract.title.toLowerCase().includes(needle) ||
        contract.description.toLowerCase().includes(needle),
    );
  }, [contractsQuery.data, contractSearch]);

  const stats = statsQuery.data;
  const events = eventsQuery.data ?? [];

  function handleRunPlayground() {
    let payload: unknown;
    try {
      payload = JSON.parse(playgroundPayload);
    } catch {
      toast.error(t("schemaValidation.playground.invalidJson"));
      return;
    }
    validateMutation.mutate({ contractId: playgroundContract, payload });
  }

  function handlePlaygroundContractChange(value: string) {
    setPlaygroundContract(value);
    const sample = PLAYGROUND_SAMPLES[value];
    if (sample) setPlaygroundPayload(sample);
  }

  const playgroundOutcome = validateMutation.data;

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={ShieldCheck}
        title={t("schemaValidation.title")}
        subtitle={t("schemaValidation.subtitle")}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void utils.extensions.schemaValidation.invalidate();
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t("schemaValidation.refresh")}
          </Button>
        }
      />

      <KpiGrid>
        <KpiCard
          label={t("schemaValidation.kpi.total")}
          value={stats ? stats.total : "…"}
          icon={FileJson}
        />
        <KpiCard
          label={t("schemaValidation.kpi.passRate")}
          value={stats && stats.passRate !== null ? `${stats.passRate} %` : "—"}
          tone="primary"
        />
        <KpiCard
          label={t("schemaValidation.kpi.rejected")}
          value={stats ? stats.rejected : "…"}
          tone="warning"
        />
        <KpiCard
          label={t("schemaValidation.kpi.guardrailBlocks")}
          value={stats ? stats.guardrailBlocks : "…"}
          icon={ShieldAlert}
          tone="destructive"
        />
      </KpiGrid>

      <section className="space-y-3">
        <PageToolbar>
          <SearchField
            value={contractSearch}
            onChange={setContractSearch}
            placeholder={t("schemaValidation.contracts.search")}
          />
          <span className="ml-auto text-xs text-muted-foreground">
            {t("schemaValidation.contracts.count", undefined, {
              count: filteredContracts.length,
            })}
            {" · "}
            {t("schemaValidation.registrySource")}:{" "}
            <span className="font-mono">
              {t("schemaValidation.registrySourceValue")}
            </span>
          </span>
        </PageToolbar>

        {contractsQuery.isLoading ? (
          <DataTableFrame>
            <TableSkeleton rows={4} />
          </DataTableFrame>
        ) : filteredContracts.length === 0 ? (
          <DataTableFrame>
            <EmptyState
              icon={FileJson}
              title={t("schemaValidation.contracts.emptyTitle")}
              description={t("schemaValidation.contracts.emptyDesc")}
            />
          </DataTableFrame>
        ) : (
          <DataTableFrame>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.contracts.colContract")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.contracts.colVersion")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.contracts.colRisk")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.contracts.colGuardrails")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.contracts.colSchemaBytes")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((contract) => (
                  <tr key={contract.id} className={tableRowClass}>
                    <td className={tableCellClass}>
                      <div className="font-medium text-foreground">
                        {contract.title}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {contract.id}
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <span className="font-mono tabular-nums">
                        {contract.version}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <Badge variant="secondary">
                        {t(`schemaValidation.contracts.risk.${contract.riskClass}`)}
                      </Badge>
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap gap-1">
                        {contract.guardrails.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          contract.guardrails.map((guardrail) => (
                            <Badge key={guardrail} variant="warning">
                              <ShieldAlert
                                className="mr-1 h-3 w-3"
                                aria-hidden="true"
                              />
                              {t(`schemaValidation.guardrails.${guardrail}`)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <span className="font-mono tabular-nums">
                        {contract.schemaBytes} B
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        )}
      </section>

      <section className="space-y-3">
        <PageToolbar>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("schemaValidation.events.title")}
          </span>
          <select
            className={`${filterControlClass} w-44`}
            value={eventResult}
            onChange={(event) =>
              setEventResult(event.target.value as typeof eventResult)
            }
            aria-label={t("schemaValidation.events.filterLabel")}
          >
            <option value="all">{t("schemaValidation.events.filterAll")}</option>
            <option value="passed">
              {t("schemaValidation.events.filterPassed")}
            </option>
            <option value="rejected">
              {t("schemaValidation.events.filterRejected")}
            </option>
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={guardrailOnly}
              onChange={(event) => setGuardrailOnly(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {t("schemaValidation.events.guardrailOnly")}
          </label>
        </PageToolbar>

        {eventsQuery.isLoading ? (
          <DataTableFrame>
            <TableSkeleton rows={4} />
          </DataTableFrame>
        ) : events.length === 0 ? (
          <DataTableFrame>
            <EmptyState
              icon={ShieldCheck}
              title={t("schemaValidation.events.emptyTitle")}
              description={t("schemaValidation.events.emptyDesc")}
            />
          </DataTableFrame>
        ) : (
          <DataTableFrame>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.events.colTime")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.events.colContract")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.events.colResult")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.events.colGuardrail")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.events.colIssues")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.events.colOrigin")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("schemaValidation.events.colActor")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className={tableRowClass}>
                    <td className={tableCellClass}>
                      <span className="font-mono tabular-nums">
                        {formatDateTimeToDisplay(event.createdAt)}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <div className="font-mono text-[11px] text-foreground">
                        {event.contractId}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        v{event.schemaVersion}
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <Badge
                        variant={event.result === "passed" ? "success" : "destructive"}
                      >
                        {t(
                          event.result === "passed"
                            ? "schemaValidation.events.resultPassed"
                            : "schemaValidation.events.resultRejected",
                        )}
                      </Badge>
                    </td>
                    <td className={tableCellClass}>
                      {event.guardrail ? (
                        <div className="flex flex-wrap gap-1">
                          {event.guardrail.split(", ").map((code) => (
                            <Badge key={code} variant="warning">
                              <ShieldAlert
                                className="mr-1 h-3 w-3"
                                aria-hidden="true"
                              />
                              {t(`schemaValidation.guardrails.${code}`, code)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <span className="font-mono tabular-nums">
                        {event.issueCount}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <Badge variant="outline">
                        {t(`schemaValidation.events.origin.${event.origin}`)}
                      </Badge>
                    </td>
                    <td className={tableCellClass}>
                      {event.actorName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("schemaValidation.playground.title")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("schemaValidation.playground.description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className={`${filterControlClass} sm:w-72`}
              value={playgroundContract}
              onChange={(event) =>
                handlePlaygroundContractChange(event.target.value)
              }
              aria-label={t("schemaValidation.playground.contract")}
            >
              {(contractsQuery.data ?? []).map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.title} ({contract.id})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleRunPlayground}
              disabled={validateMutation.isPending}
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {validateMutation.isPending
                ? t("schemaValidation.playground.running")
                : t("schemaValidation.playground.run")}
            </Button>
          </div>

          <Textarea
            value={playgroundPayload}
            onChange={(event) => setPlaygroundPayload(event.target.value)}
            rows={10}
            spellCheck={false}
            className="font-mono text-xs"
            aria-label={t("schemaValidation.playground.payload")}
          />

          {playgroundOutcome ? (
            <div className="space-y-2">
              <Badge
                variant={playgroundOutcome.ok ? "success" : "destructive"}
              >
                {playgroundOutcome.ok
                  ? t("schemaValidation.playground.resultPassed")
                  : t("schemaValidation.playground.resultRejected")}
              </Badge>
              {playgroundOutcome.issues.length > 0 && (
                <DataTableFrame>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={tableHeadClass}>
                          {t("schemaValidation.playground.colField")}
                        </th>
                        <th className={tableHeadClass}>
                          {t("schemaValidation.playground.colCode")}
                        </th>
                        <th className={tableHeadClass}>
                          {t("schemaValidation.playground.colMessage")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {playgroundOutcome.issues.map((issue, index) => (
                        <tr key={`${issue.field}-${issue.code}-${index}`} className={tableRowClass}>
                          <td className={tableCellClass}>
                            <span className="font-mono text-[11px]">
                              {issue.field}
                            </span>
                          </td>
                          <td className={tableCellClass}>
                            {issue.guardrail ? (
                              <Badge variant="warning">
                                <ShieldAlert
                                  className="mr-1 h-3 w-3"
                                  aria-hidden="true"
                                />
                                {t(
                                  `schemaValidation.guardrails.${issue.guardrail}`,
                                )}
                              </Badge>
                            ) : (
                              <span className="font-mono text-[11px]">
                                {issue.code}
                              </span>
                            )}
                          </td>
                          <td className={tableCellClass}>
                            {t(issue.messageKey, undefined, issue.params)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableFrame>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
