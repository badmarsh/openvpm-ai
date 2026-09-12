"use client";

import { useState } from "react";
import { Plus, Loader2, Trash2, Stethoscope } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "sonner";

const CONDITIONS = [
  "HEALTHY",
  "MISSING",
  "FRACTURED",
  "DECAYED",
  "MOBILE",
  "ABRADED",
  "CROWNED",
  "OTHER",
] as const;

export function DentalChartTab({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [toothCode, setToothCode] = useState("");
  const [chartedAt, setChartedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [condition, setCondition] = useState<
    (typeof CONDITIONS)[number]
  >("HEALTHY");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");

  const listQuery = trpc.extensions.dental.list.useQuery({ patientId });

  const createMutation = trpc.extensions.dental.create.useMutation({
    onSuccess: () => {
      toast.success(t("dental.createdSuccess", "Zubný záznam uložený"));
      setShowForm(false);
      setToothCode("");
      setTreatment("");
      setNotes("");
      utils.extensions.dental.list.invalidate({ patientId });
    },
    onError: (err) => {
      toast.error(err.message || t("dental.saveError", "Chyba pri ukladaní"));
    },
  });

  const removeMutation = trpc.extensions.dental.remove.useMutation({
    onSuccess: () => {
      toast.success(t("dental.removedSuccess", "Zubný záznam odstránený"));
      utils.extensions.dental.list.invalidate({ patientId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const conditionLabel = (value: string) => {
    const key = `dental.condition.${value.toLowerCase()}`;
    return t(key, value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toothCode.trim()) {
      toast.error(t("dental.toothRequired", "Zadajte kód zuba"));
      return;
    }
    createMutation.mutate({
      patientId,
      toothCode: toothCode.trim(),
      chartedAt,
      condition,
      treatment: treatment.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("dental.addEntry", "Pridať zubný záznam")}
        </Button>
      </div>

      {showForm && (
        <form
          className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("dental.toothLabel", "Zub (FDI) *")}
              </label>
              <Input
                required
                value={toothCode}
                maxLength={16}
                onChange={(e) => setToothCode(e.target.value)}
                placeholder={t("dental.toothPlaceholder", "napr. 104")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("dental.dateLabel", "Dátum *")}
              </label>
              <Input
                type="date"
                required
                value={chartedAt}
                onChange={(e) => setChartedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("dental.conditionLabel", "Stav")}
              </label>
              <select
                value={condition}
                onChange={(e) =>
                  setCondition(e.target.value as (typeof CONDITIONS)[number])
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {conditionLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("dental.treatmentLabel", "Ošetrenie")}
              </label>
              <Input
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                placeholder={t("dental.treatmentPlaceholder", "napr. Extrakcia")}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("dental.notesLabel", "Poznámky")}
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("dental.notesPlaceholder", "Ďalšie poznámky")}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              {createMutation.isPending
                ? t("records.common.saving", "Saving...")
                : t("records.common.save", "Save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              {t("records.common.cancel", "Cancel")}
            </Button>
          </div>
        </form>
      )}

      {listQuery.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={t("dental.emptyTitle", "Žiadne zubné záznamy")}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("dental.toothColumn", "Zub")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("dental.conditionColumn", "Stav")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("dental.treatmentColumn", "Ošetrenie")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("dental.dateColumn", "Dátum")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("dental.vetColumn", "Veterinár")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t("dental.actionsColumn", "Akcie")}
                </th>
              </tr>
            </thead>
            <tbody>
              {listQuery.data.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono font-semibold">
                    {entry.toothCode}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {conditionLabel(entry.condition)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.treatment ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(entry.chartedAt).toLocaleDateString("sk-SK")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.veterinarian?.name ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate({ id: entry.id })}
                      disabled={removeMutation.isPending}
                      className="text-muted-foreground hover:text-destructive"
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
  );
}
