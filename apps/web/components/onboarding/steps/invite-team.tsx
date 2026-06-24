"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/lib/utils";
import { toast } from "sonner";
import type { StepHandle } from "../journey-types";

type Role = "admin" | "veterinarian" | "technician" | "front_desk" | "viewer";

const ROLES: { value: Role; label: string }[] = [
  { value: "front_desk", label: "Front desk" },
  { value: "veterinarian", label: "Veterinarian" },
  { value: "technician", label: "Technician" },
  { value: "viewer", label: "Viewer (read only)" },
  { value: "admin", label: "Admin" },
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface Row {
  email: string;
  role: Role;
}

const EMPTY_ROWS: Row[] = [
  { email: "", role: "front_desk" },
  { email: "", role: "front_desk" },
  { email: "", role: "front_desk" },
];

/**
 * Step 3: invite up to three teammates by email. Continue sends one invite per
 * valid email and reports a short summary.
 */
export function InviteTeamStep({ register }: { register: (h: StepHandle) => void }) {
  const inviteStaff = trpc.settings.inviteStaff.useMutation();
  const [rows, setRows] = useState<Row[]>(EMPTY_ROWS);

  useEffect(() => {
    register({
      async onContinue() {
        const toInvite = rows.filter((r) => isValidEmail(r.email));
        if (toInvite.length === 0) return true;

        let sent = 0;
        for (const row of toInvite) {
          try {
            await inviteStaff.mutateAsync({
              email: row.email.trim().toLowerCase(),
              role: row.role,
            });
            sent += 1;
          } catch (err) {
            toast.error(
              err instanceof Error
                ? `Could not invite ${row.email}: ${err.message}`
                : `Could not invite ${row.email}`
            );
          }
        }
        if (sent > 0) {
          toast.success(
            sent === 1 ? "Sent 1 invite" : `Sent ${sent} invites`
          );
        }
        return true;
      },
    });
  }, [register, rows, inviteStaff]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        Add the people you work with. We will email them a link to set up their
        own login. You only pay for staff who actually use it.
      </p>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
            <Input
              type="email"
              value={row.email}
              onChange={(e) => update(i, { email: e.target.value })}
              placeholder="teammate@clinic.com"
              aria-label={`Teammate email ${i + 1}`}
            />
            <select
              className={selectClass}
              value={row.role}
              onChange={(e) => update(i, { role: e.target.value as Role })}
              aria-label={`Teammate role ${i + 1}`}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
