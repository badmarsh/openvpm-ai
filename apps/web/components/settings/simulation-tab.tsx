"use client";

import React from "react";
import { ClinicalSimulationView } from "@/components/simulation/clinical-simulation-view";

export function SimulationTab() {
  return (
    <div className="w-full space-y-6">
      <ClinicalSimulationView />
    </div>
  );
}

