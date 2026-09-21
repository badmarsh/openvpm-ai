#!/usr/bin/env python3
"""
OpenVPM AI — výpočtový model pre špecifikáciu v0.7
===================================================

Generuje *konzistentné* čísla pre:
  - Sekcia 1 (položka „Merateľná úspora času“ pri každom journey) — časový ledger L01..L36
  - Sekcia 4 (BC-01..BC-09, finančný model, payback, ROI, citlivosť)

Model nie je meranie z pilotnej kliniky. Je to *parametrický model* referenčnej
slovenskej kliniky (3 MVDr., 45 pacientov/deň) s explicitnými realizačnými
a atribučnými faktormi. Každé číslo v dokumentácii musí byť dohľadateľné sem.

Spustenie:  python3 scripts/spec-v07-financial-model.py
Výstup:     stdout (markdown) + docs/product/spec-v07/_generated/financial-model.md
"""

from __future__ import annotations

import os
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# 1. REFERENČNÝ MODEL KLINIKY
# ---------------------------------------------------------------------------

VETS = 3                    # MVDr. lekári
TECHS = 2                   # veterinárni technici / asistenti
RECEPTION_FTE = 1.5         # recepcia
ADMIN_FTE = 1.0             # prevádzková manažérka / admin

PATIENTS_PER_DAY = 45
WORKDAYS_PER_MONTH = 21.5
VISITS_PER_MONTH = PATIENTS_PER_DAY * WORKDAYS_PER_MONTH          # 967,5
VISITS_DISPLAY = round(VISITS_PER_MONTH)                          # 968
MONTHLY_HOURS_PER_FTE = 168.0

MIX_CONSULT, MIX_PREVENTIVE, MIX_PROCEDURE = 32, 8, 5
TICKET_CONSULT, TICKET_PREVENTIVE, TICKET_PROCEDURE = 38.0, 45.0, 210.0

DAILY_REVENUE = (
    MIX_CONSULT * TICKET_CONSULT
    + MIX_PREVENTIVE * TICKET_PREVENTIVE
    + MIX_PROCEDURE * TICKET_PROCEDURE
)
AVG_TICKET = DAILY_REVENUE / PATIENTS_PER_DAY
MONTHLY_REVENUE = DAILY_REVENUE * WORKDAYS_PER_MONTH
ANNUAL_REVENUE = MONTHLY_REVENUE * 12

RATE_VET, RATE_TECH, RATE_RECEPTION, RATE_ADMIN = 35.0, 28.0, 25.0, 30.0
RATE_BLENDED = 29.0
RATES = {
    "lekár": RATE_VET,
    "technik": RATE_TECH,
    "recepcia": RATE_RECEPTION,
    "admin": RATE_ADMIN,
}

# --- náklady na OpenVPM AI -------------------------------------------------
SUB_NEMOCNICA = 229.0            # Cloud Nemocnica — neobmedzená AI asistencia
SUB_KLINIKA = 119.0              # Cloud Klinika — 500 AI dopytov/mes. v cene
AI_EVENTS_PER_MONTH = 1050       # 645 diktácií + imaging/discharge/marketing/agent
AI_INCLUDED_KLINIKA = 500
AI_OVERAGE_PRICE = 0.50          # € / AI udalosť (odhad; cena je parameter Stripe)
SELFHOST_INFRA = 100.0           # VPS + zálohy + monitoring
BYOK_AI_COST = 0.18 * AI_EVENTS_PER_MONTH   # vlastný Vertex/Anthropic kľúč (~0,18 €/udalosť)
SELFHOST_IT_HOURS = 2.0          # h/mes. správy vlastnej infraštruktúry

ONETIME_MIGRATION_TRAINING = 1200.0
ONETIME_HARDWARE = 720.0
ONETIME_INTERNAL_HOURS = 42.0
ONETIME_TOTAL = (
    ONETIME_MIGRATION_TRAINING
    + ONETIME_HARDWARE
    + ONETIME_INTERNAL_HOURS * RATE_BLENDED
)

REALIZATION_Y1 = 0.55
REALIZATION_STEADY = 0.80
RAMP = [(3, 0.35), (6, 0.55), (12, 0.70), (24, 0.80), (36, 0.85)]


def sk(value: float, decimals: int = 0) -> str:
    """Slovenský numerický formát: 1 234,5"""
    return f"{value:,.{decimals}f}".replace(",", " ").replace(".", ",")


def euro(value: float, decimals: int = 0) -> str:
    return f"{sk(value, decimals)} €"


def hours(value: float) -> str:
    return f"{sk(value, 1)} h"


def pct(value: float, decimals: int = 1) -> str:
    """Slovenský formát percent: 17,8 %"""
    return f"{sk(value * 100, decimals)} %"


# ---------------------------------------------------------------------------
# 2. ČASOVÝ LEDGER — zdroj pre Sekciu 1 aj Sekciu 4
# ---------------------------------------------------------------------------


@dataclass
class Row:
    code: str
    journey: str
    role: str
    baseline: float          # unit="min": minúty na udalosť; unit="h": hodiny za mesiac
    openvpm: float
    volume: float            # počet udalostí/mes. (pri unit="h" typicky 1)
    bc: str
    unit: str = "min"
    note: str = ""

    @property
    def rate(self) -> float:
        return RATES[self.role]

    @property
    def saving(self) -> float:
        return self.baseline - self.openvpm

    @property
    def model_hours(self) -> float:
        if self.unit == "h":
            return self.saving * self.volume
        return self.saving * self.volume / 60.0

    @property
    def real_hours(self) -> float:
        return self.model_hours * REALIZATION_Y1

    @property
    def real_eur(self) -> float:
        return self.real_hours * self.rate

    @property
    def per_day_vet_min(self) -> float:
        return self.real_hours * 60 / WORKDAYS_PER_MONTH


LEDGER: list[Row] = [
    # --- LEKÁR -------------------------------------------------------------
    Row("L01", "J1 Vyhľadanie pacienta/majiteľa (lekársky podiel 40 %)", "lekár",
        1.50, 0.42, 774, "BC-01", note="F1 / Cmd+K — 25 s namiesto 90 s"),
    Row("L02", "J2/J4 Klinická karta, anamnéza a história pred vyšetrením", "lekár",
        4.00, 2.50, VISITS_DISPLAY, "BC-01", note="alergie, vitálne, posledné lab na jednej karte"),
    Row("L03", "J3 SOAP dokumentácia — počas ordinačných hodín", "lekár",
        6.00, 2.50, 774, "BC-01", note="hlasový AI Scribe pri 80 % encounterov"),
    Row("L04", "J3 SOAP dokumentácia — po ordinačných hodinách", "lekár",
        3.50, 1.50, 774, "BC-02", note="„nočná administrativa“ po 18:00"),
    Row("L05", "J5 Clinical Guardian — interakcie, alergie, kontraindikácie", "lekár",
        2.50, 0.50, 300, "BC-01", note="deterministické pravidlá, bez LLM"),
    Row("L06", "J10 Predpis a safety check (lekárska časť)", "lekár",
        1.50, 0.50, 500, "BC-01", note="dosing.calculate + checkPrescriptionSafety"),
    Row("L07", "J12 Closeout: diagnóza, inštrukcie, follow-up", "lekár",
        2.00, 1.25, VISITS_DISPLAY, "BC-01", note="discharge draft + follow-up disposition"),
    Row("L08", "J13 Vakcinácia, certifikát, hlásenie (lekárska časť)", "lekár",
        1.50, 0.50, 350, "BC-01", note="certifikát + ŠVPS fronta automaticky"),
    Row("L09", "J16 Interpretácia lab výsledkov a záver", "lekár",
        3.00, 1.50, 220, "BC-01", note="referenčné rozsahy, trendy, review inbox"),
    Row("L10", "J17 RTG — meranie VHS a text nálezu", "lekár",
        6.00, 2.50, 120, "BC-01", note="calculateVhs + AI nález s HITL potvrdením"),
    Row("L11", "JG-C02/C03 Hospitalizácia a chirurgia — dokumentácia (v0.7)", "lekár",
        25.0, 10.0, 12, "BC-07", note="flowsheet + anestéziologický protokol"),
    Row("L12", "J29 Eutanázia/úhyn — administratíva a sympathy", "lekár",
        20.0, 8.0, 8, "BC-08", note="atomické utlmenie komunikácie, kadaver evidencia"),
    Row("L13", "J28 Legislatívny cyklus — lekársky podiel (OPL kniha, KVEPIS podpis)", "lekár",
        45.0, 15.0, 1, "BC-06", note="mesačný agregát v minútach"),
    # --- TECHNIK -----------------------------------------------------------
    Row("L14", "J2/J8 Vitálne funkcie, odbery, príprava pri pacientovi", "technik",
        6.00, 4.00, 700, "BC-01", note="tablet pri pacientovi, bez neskoršieho prepisu"),
    Row("L15", "J16 Lab import, validácia a zápis do karty", "technik",
        8.00, 2.00, 220, "BC-01", note="parser IDEXX/Fuji/Mindray + review inbox"),
    Row("L16", "J10 Výdaj lieku a účtovanie (dispense → charge queue)", "technik",
        3.00, 1.00, 500, "BC-01", note="položka na faktúre vzniká automaticky"),
    Row("L17", "JX-01 Príjem dodacieho listu (ručné prepisovanie → parser)", "technik",
        35.0, 10.0, 24, "BC-05", note="24 príjmov/mes. (Cymedica, Pharmos, Samohýl, H. Schein)"),
    Row("L18", "JX-01 Inventúra a reconciliácia skladu", "technik",
        6.0, 4.0, 1, "BC-05", unit="h"),
    Row("L19", "JX-01 Monitoring expirácií a reorder pointov", "technik",
        1.5, 0.25, 1, "BC-05", unit="h"),
    Row("L20", "J13 Asistencia pri vakcinácii, pas a čip", "technik",
        2.00, 1.00, 350, "BC-01"),
    Row("L21", "JG-C02 ICU flowsheet — záznamy na zmenách (v0.7)", "technik",
        8.0, 4.0, 90, "BC-07", note="90 zmien/mes. (3 pacienti × 3 zmeny × 10 dní)"),
    # --- RECEPCIA ----------------------------------------------------------
    Row("L22", "J7 Objednanie termínu (telefonické)", "recepcia",
        4.50, 2.50, 700, "BC-01", note="kolízna ochrana + availableSlots"),
    Row("L23", "J8 Check-in a čakáreň", "recepcia",
        1.50, 1.00, VISITS_DISPLAY, "BC-01", note="whiteboard SSE, 1 klik"),
    Row("L24", "J11 Faktúra, platba, e-Kasa doklad", "recepcia",
        5.00, 3.50, VISITS_DISPLAY, "BC-01", note="auto položky + e-Kasa doklad z platby"),
    Row("L25", "J12 Closeout (charge disposition, follow-up termín)", "recepcia",
        3.00, 2.00, VISITS_DISPLAY, "BC-01"),
    Row("L26", "J9 Zmena/zrušenie termínu a notifikácia", "recepcia",
        6.00, 3.00, 180, "BC-04", note="reschedule pod advisory zámkom + SMS"),
    Row("L27", "J9 Pripomienky na ďalší deň (ručné volania → bulk)", "recepcia",
        30.0, 10.0, WORKDAYS_PER_MONTH, "BC-04", note="30 min/deň → 10 min/deň"),
    Row("L28", "J6 Nový klient a pacient (formulár, súhlasy, duplicita)", "recepcia",
        9.00, 4.00, 45, "BC-01", note="Duplicate Shield"),
    Row("L29", "J27 Klientsky portál — odklonenie vstupných hovorov", "recepcia",
        4.0, 1.5, 1, "BC-08", unit="h", note="výsledky, faktúry, termíny, očkovací preukaz"),
    Row("L30", "J14 Recall kampaň — ručný zoznam a volania", "recepcia",
        240.0, 60.0, 1, "BC-03", note="mesačný agregát v minútach"),
    # --- ADMIN / MANAŽÉR ---------------------------------------------------
    Row("L31", "JX-02 Reporty a mesačná uzávierka", "admin",
        12.0, 3.0, 1, "BC-09", unit="h", note="Excel konsolidácia → /reports"),
    Row("L32", "J28 Legislatívny cyklus (KVEPIS XML, CRSZ export, uzávierky)", "admin",
        8.0, 2.5, 1, "BC-06", unit="h"),
    Row("L33", "J18/J19 Marketing: obsah, kampane, recenzie, suppression", "admin",
        9.0, 3.0, 1, "BC-08", unit="h"),
    Row("L34", "J15 Wellness: enrolment a cyklická fakturácia", "admin",
        3.75, 1.0, 1, "BC-03", unit="h"),
    Row("L35", "JX-01 Sklad: objednávky a kontrola", "admin",
        2.0, 0.75, 1, "BC-05", unit="h"),
    Row("L36", "JG-D06 Poistné udalosti a komunikácia s poisťovňou (v0.7)", "admin",
        4.0, 1.0, 1, "BC-07", unit="h", note="PetExpert/Generali/Union export"),
]


# ---------------------------------------------------------------------------
# 3. VÝNOSOVÉ PÁKY (hard cash)
# ---------------------------------------------------------------------------

SCHEDULED_PER_MONTH = 1100
NOSHOW_BASELINE, NOSHOW_TARGET = 0.12, 0.06
NOSHOW_REFILL_RATE = 0.70
NOSHOW_ATTRIBUTION = 0.60        # podiel zlepšenia pripísateľný systému (nie trhu/sezóne)

ACTIVE_PATIENT_BASE = VISITS_PER_MONTH * 12 / 2.6
RECALL_UPLIFT_VISITS = 14
RECALL_ATTRIBUTION = 0.70

WELLNESS_PLANS_Y1, WELLNESS_PRICE, WELLNESS_RAMP = 60, 25.0, 0.50
WELLNESS_ATTRIBUTION = 0.50

COGS_SHARE = 0.25
SPOILAGE_BASELINE, SPOILAGE_REDUCTION = 0.018, 0.60
STOCKOUT_LOSS_MONTHLY = 90.0
INVENTORY_ATTRIBUTION = 0.70

AR_BAD_DEBT_SHARE, AR_BAD_DEBT_REDUCTION = 0.003, 0.60
AR_ATTRIBUTION = 0.50


@dataclass
class Lever:
    code: str
    name: str
    gross_monthly: float
    realization: float
    attribution: float
    bc: str
    note: str = ""

    @property
    def net_monthly(self) -> float:
        return self.gross_monthly * self.realization * self.attribution


noshow_recovered = SCHEDULED_PER_MONTH * (NOSHOW_BASELINE - NOSHOW_TARGET)
noshow_refilled = noshow_recovered * NOSHOW_REFILL_RATE
noshow_revenue = noshow_refilled * AVG_TICKET
recall_revenue = RECALL_UPLIFT_VISITS * TICKET_PREVENTIVE
cogs = MONTHLY_REVENUE * COGS_SHARE
spoilage_saved = cogs * SPOILAGE_BASELINE * SPOILAGE_REDUCTION
inventory_revenue = spoilage_saved + STOCKOUT_LOSS_MONTHLY
bad_debt_saved = MONTHLY_REVENUE * AR_BAD_DEBT_SHARE * AR_BAD_DEBT_REDUCTION

LEVERS = [
    Lever("R1", "Zníženie no-show a doplnenie slotov (pripomienky + waitlist)",
          noshow_revenue, 1.0, NOSHOW_ATTRIBUTION, "BC-04",
          f"{noshow_recovered:.0f} uvoľnených termínov/mes. × obsadenosť {pct(NOSHOW_REFILL_RATE, 0)} "
          f"= {noshow_refilled:.0f} návštev × {euro(AVG_TICKET)}"),
    Lever("R2", "Automatizovaný recall / revakcinácie",
          recall_revenue, 1.0, RECALL_ATTRIBUTION, "BC-03",
          f"+{RECALL_UPLIFT_VISITS} revakcinácií/mes. × {euro(TICKET_PREVENTIVE)}"),
    Lever("R3", "Wellness (preventívne) plány — recurring",
          WELLNESS_PLANS_Y1 * WELLNESS_PRICE, WELLNESS_RAMP, WELLNESS_ATTRIBUTION, "BC-03",
          f"{WELLNESS_PLANS_Y1} plánov × {euro(WELLNESS_PRICE)}/mes.; rampa roku 1 {pct(WELLNESS_RAMP, 0)}"),
    Lever("R4", "Zníženie strát v zásobách (exspirácie + stockouty)",
          inventory_revenue, 1.0, INVENTORY_ATTRIBUTION, "BC-05",
          f"COGS {euro(cogs)}/mes. × {pct(SPOILAGE_BASELINE)} × {pct(SPOILAGE_REDUCTION, 0)} "
          f"+ stockouty {euro(STOCKOUT_LOSS_MONTHLY)}"),
    Lever("R5", "Zníženie odpisov pohľadávok (DSO, online platby)",
          bad_debt_saved, 1.0, AR_ATTRIBUTION, "BC-09",
          f"tržby {euro(MONTHLY_REVENUE)} × {pct(AR_BAD_DEBT_SHARE)} × {pct(AR_BAD_DEBT_REDUCTION, 0)}"),
]

V07_STAYS, V07_STAY_REVENUE = 3, 380.0
V07_PROCEDURES, V07_PROCEDURE_REVENUE = 4, 180.0
V07_REALIZATION, V07_ATTRIBUTION = 0.50, 0.70
v07_gross = V07_STAYS * V07_STAY_REVENUE + V07_PROCEDURES * V07_PROCEDURE_REVENUE
LEVER_V07 = Lever(
    "R6", "Hospitalizácia + chirurgia + urgent (moduly C-02/C-03/C-04, v0.7)",
    v07_gross, V07_REALIZATION, V07_ATTRIBUTION, "BC-07",
    f"{V07_STAYS} hospitalizácie × {euro(V07_STAY_REVENUE)} + {V07_PROCEDURES} zákroky "
    f"× {euro(V07_PROCEDURE_REVENUE)}",
)

THROUGHPUT_OPTION_SLOTS = VETS * 1 * WORKDAYS_PER_MONTH     # +1 slot/lekár/deň
THROUGHPUT_OPTION_FILL = 0.40
THROUGHPUT_OPTION_REVENUE = THROUGHPUT_OPTION_SLOTS * THROUGHPUT_OPTION_FILL * AVG_TICKET


# ---------------------------------------------------------------------------
# 4. AGREGÁCIE
# ---------------------------------------------------------------------------

def by_role(role: str) -> list[Row]:
    return [r for r in LEDGER if r.role == role]


def role_totals(role: str) -> tuple[float, float, float]:
    rows = by_role(role)
    return (
        sum(r.model_hours for r in rows),
        sum(r.real_hours for r in rows),
        sum(r.real_eur for r in rows),
    )


def bc_totals(bc: str) -> tuple[float, float]:
    rows = [r for r in LEDGER if r.bc == bc]
    return sum(r.real_hours for r in rows), sum(r.real_eur for r in rows)


def rows_for_journey(prefix: str) -> list[Row]:
    return [r for r in LEDGER if r.journey.startswith(prefix)]


TOTAL_MODEL_H = sum(r.model_hours for r in LEDGER)
TOTAL_REAL_H = sum(r.real_hours for r in LEDGER)
TOTAL_CAPACITY_VALUE = sum(r.real_eur for r in LEDGER)
TOTAL_STAFF_HOURS = (VETS + TECHS + RECEPTION_FTE + ADMIN_FTE) * MONTHLY_HOURS_PER_FTE
REVENUE_GROSS = sum(l.net_monthly for l in LEVERS)

COST_SCENARIOS = [
    ("Cloud Nemocnica (neobmedzená AI)", SUB_NEMOCNICA,
     "Odporúčané pre 45 pacientov/deň: AI objem ~1 050 udalostí/mes. presahuje limit 500 v tieri Klinika."),
    ("Cloud Klinika + AI overage", SUB_KLINIKA + max(0, AI_EVENTS_PER_MONTH - AI_INCLUDED_KLINIKA) * AI_OVERAGE_PRICE,
     f"{AI_EVENTS_PER_MONTH - AI_INCLUDED_KLINIKA} AI udalostí nad limit × {euro(AI_OVERAGE_PRICE)} "
     "(cena overage je parameter `STRIPE_PRICE_AI_OVERAGE`, nie je v repozitári fixná)."),
    ("Self-hosted (AGPLv3) + BYO AI kľúč", SELFHOST_INFRA + BYOK_AI_COST + SELFHOST_IT_HOURS * RATE_VET,
     f"infraštruktúra {euro(SELFHOST_INFRA)} + AI {euro(BYOK_AI_COST)} "
     f"+ {SELFHOST_IT_HOURS:g} h IT času lekára/konateľa."),
]
PRIMARY_COST = COST_SCENARIOS[0][1]
NET_MONTHLY = REVENUE_GROSS - PRIMARY_COST
PAYBACK_CASH = ONETIME_TOTAL / NET_MONTHLY if NET_MONTHLY > 0 else float("inf")
ROI_MULTIPLE_CASH = REVENUE_GROSS / PRIMARY_COST
ROI_MULTIPLE_TOTAL = (REVENUE_GROSS + TOTAL_CAPACITY_VALUE) / PRIMARY_COST


def cumulative_36m() -> tuple[list[tuple[int, float, float]], float]:
    out, cum = [], -ONETIME_TOTAL
    for m in range(1, 37):
        factor = RAMP[-1][1]
        for until, value in RAMP:
            if m <= until:
                factor = value
                break
        capacity = TOTAL_CAPACITY_VALUE / REALIZATION_Y1 * factor
        cum += REVENUE_GROSS + capacity - PRIMARY_COST
        out.append((m, factor, cum))
    return out, cum


CUM_ROWS, CUM_36 = cumulative_36m()

BC_NAMES = {
    "BC-01": "Klinická priepustnosť a uvoľnená kapacita",
    "BC-02": "Eliminácia nočnej administratívy",
    "BC-03": "Retencia cez preventívne plány a recall",
    "BC-04": "Zníženie no-show a prázdnych slotov",
    "BC-05": "Zabránenie stratám v zásobách",
    "BC-06": "Legislatívna bezpečnosť a eliminácia pokút",
    "BC-07": "Hospitalizácia, chirurgia a urgent (v0.7)",
    "BC-08": "Klientska skúsenosť, portál a reputácia",
    "BC-09": "Finančná disciplína, reporting a uzávierka",
}
BC_LEVERS = {
    "BC-01": [], "BC-02": [], "BC-03": ["R2", "R3"], "BC-04": ["R1"],
    "BC-05": ["R4"], "BC-06": [], "BC-07": ["R6"], "BC-08": [], "BC-09": ["R5"],
}

# Rizikové (nie cash) efekty — kvantifikované ako očakávaná hodnota
RISK_ITEMS = [
    ("Pokuta za porušenie e-Kasa povinností (§ 289/2008 Z. z.)", 3000.0, 0.02,
     "minimálna sadzba; pravdepodobnosť zistenia pri kontrole FR SR 2 %/rok"),
    ("Pokuta / náprava pri kontrole ŠVPS (zákon 39/2007 Z. z.)", 1500.0, 0.05,
     "chyby v ambulantnej knihe a hláseniach"),
    ("Škoda z chýbajúcej evidencie OPL (zákon 139/1998 Z. z.)", 5000.0, 0.01,
     "nesprávne vedená kniha opiátov, chýbajúci svedok"),
    ("Regres poisťovne / náhrada škody pri dokumentačnom pochybení", 8000.0, 0.01,
     "neúplná dokumentácia pri poistnej udalosti"),
    ("Pokuta GDPR (čl. 83) pri úniku / nesprávnom súhlase", 4000.0, 0.005,
     "reálne sankcie vo veterinárnom sektore sú nižšie, ide o konzervatívny odhad"),
]
RISK_ANNUAL = sum(amount * prob for _, amount, prob, _ in RISK_ITEMS)


# ---------------------------------------------------------------------------
# 5. MARKDOWN
# ---------------------------------------------------------------------------

def md_ledger() -> str:
    lines = [
        "| L# | Journey / aktivita | Rola | Baseline | OpenVPM AI | Úspora | Objem/mes. | Model h/mes. | Real. h/mes. | Real. €/mes. | BC |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in LEDGER:
        unit = "" if r.unit == "min" else " h"
        lines.append(
            f"| {r.code} | {r.journey} | {r.role} | {sk(r.baseline, 2)}{unit} | {sk(r.openvpm, 2)}{unit} "
            f"| {sk(r.saving, 2)}{unit} | {sk(r.volume, 1)} | {hours(r.model_hours)} | {hours(r.real_hours)} "
            f"| {euro(r.real_eur)} | {r.bc} |"
        )
    lines.append(
        f"| **Σ** | — | — | — | — | — | — | **{hours(TOTAL_MODEL_H)}** | **{hours(TOTAL_REAL_H)}** "
        f"| **{euro(TOTAL_CAPACITY_VALUE)}** | — |"
    )
    return "\n".join(lines)


def md_role_summary() -> str:
    lines = [
        "| Rola | FTE | Kapacita h/mes. | Model úspory | Realizované (55 %) | % kapacity | Sadzba | Hodnota €/mes. | Na deň/človeka |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for role, fte in [("lekár", VETS), ("technik", TECHS),
                      ("recepcia", RECEPTION_FTE), ("admin", ADMIN_FTE)]:
        model, real, eur = role_totals(role)
        cap = fte * MONTHLY_HOURS_PER_FTE
        per_day = real * 60 / fte / WORKDAYS_PER_MONTH
        lines.append(
            f"| {role} | {sk(fte, 1)} | {hours(cap)} | {hours(model)} | {hours(real)} "
            f"| {pct(real / cap)} | {euro(RATES[role])}/h | {euro(eur)} | {per_day:.0f} min |"
        )
    per_day_all = TOTAL_REAL_H * 60 / (VETS + TECHS + RECEPTION_FTE + ADMIN_FTE) / WORKDAYS_PER_MONTH
    lines.append(
        f"| **Spolu** | {sk(VETS + TECHS + RECEPTION_FTE + ADMIN_FTE, 1)} | {hours(TOTAL_STAFF_HOURS)} "
        f"| **{hours(TOTAL_MODEL_H)}** | **{hours(TOTAL_REAL_H)}** | **{pct(TOTAL_REAL_H / TOTAL_STAFF_HOURS)}** "
        f"| — | **{euro(TOTAL_CAPACITY_VALUE)}** | {per_day_all:.0f} min |"
    )
    return "\n".join(lines)


def md_levers() -> str:
    lines = [
        "| # | Výnosová páka | Hrubý efekt | Realizácia | Atribúcia systému | Započítané €/mes. | BC | Odvodenie |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for l in LEVERS:
        lines.append(
            f"| {l.code} | {l.name} | {euro(l.gross_monthly)} | {pct(l.realization, 0)} | {pct(l.attribution, 0)} "
            f"| {euro(l.net_monthly)} | {l.bc} | {l.note} |"
        )
    lines.append(
        f"| **Σ v0.6** | — | **{euro(sum(l.gross_monthly for l in LEVERS))}** | — | — "
        f"| **{euro(REVENUE_GROSS)}** | — | hard cash, vstupuje do paybacku |"
    )
    lines.append(
        f"| {LEVER_V07.code} | {LEVER_V07.name} | {euro(LEVER_V07.gross_monthly)} "
        f"| {pct(LEVER_V07.realization, 0)} | {pct(LEVER_V07.attribution, 0)} | {euro(LEVER_V07.net_monthly)} "
        f"| {LEVER_V07.bc} | {LEVER_V07.note} — **mimo základného paybacku** |"
    )
    lines.append(
        f"| R7 | *Voliteľná* konverzia uvoľnenej kapacity na nové termíny "
        f"| {euro(THROUGHPUT_OPTION_REVENUE)} | {THROUGHPUT_OPTION_FILL:.0%} | — "
        f"| {euro(THROUGHPUT_OPTION_REVENUE * THROUGHPUT_OPTION_FILL)} | BC-01 "
        f"| +1 slot/lekár/deň = {THROUGHPUT_OPTION_SLOTS:.0f} slotov/mes.; **nezapočítava sa**, "
        f"aby nedošlo k dvojitému započítaniu s R1 |"
    )
    return "\n".join(lines)


def md_bc_allocation() -> str:
    lines = [
        "| BC | Názov | Kapacitné h (real.) | Hodnota kapacít €/mes. | Páky | Hard cash €/mes. | Spolu €/mes. |",
        "|---|---|---|---|---|---|---|",
    ]
    total_h = total_cap = total_cash = 0.0
    for bc in sorted(BC_NAMES):
        h, e = bc_totals(bc)
        codes = BC_LEVERS[bc]
        cash = LEVER_V07.net_monthly if bc == "BC-07" else sum(
            l.net_monthly for l in LEVERS if l.code in codes
        )
        total_h += h
        total_cap += e
        total_cash += cash
        lines.append(
            f"| {bc} | {BC_NAMES[bc]} | {hours(h)} | {euro(e)} | {', '.join(codes) or '—'} "
            f"| {euro(cash)} | {euro(e + cash)} |"
        )
    lines.append(
        f"| **Σ v0.6** | — | **{hours(total_h - bc_totals('BC-07')[0])}** "
        f"| **{euro(total_cap - bc_totals('BC-07')[1])}** | — "
        f"| **{euro(total_cash - LEVER_V07.net_monthly)}** "
        f"| **{euro(total_cap + total_cash - LEVER_V07.net_monthly - bc_totals('BC-07')[1])}** |"
    )
    lines.append(
        f"| **Σ vrátane v0.7** | — | **{hours(total_h)}** | **{euro(total_cap)}** | — "
        f"| **{euro(total_cash)}** | **{euro(total_cap + total_cash)}** |"
    )
    lines.append("")
    lines.append(
        f"> Kontrola dvojitého započítania: Σ kapacitných hodín = Σ ledger ({hours(TOTAL_REAL_H)}), "
        f"Σ hard cash v0.6 = Σ pák R1–R5 ({euro(REVENUE_GROSS)}). R6 (v0.7) a R7 (voliteľná konverzia "
        "kapacity) sú uvedené oddelene a do základného paybacku **nevstupujú**."
    )
    return "\n".join(lines)


def md_costs() -> str:
    lines = [
        "| Scenár nákladov | €/mesiac | Poznámka |",
        "|---|---|---|",
    ]
    for name, cost, note in COST_SCENARIOS:
        lines.append(f"| {name} | {euro(cost)} | {note} |")
    return "\n".join(lines)


def md_sensitivity() -> str:
    lines = [
        "| Scenár | Realizácia kapacít | Realizácia cash pák | Hard cash €/mes. | Kapacita €/mes. | Náklad €/mes. | Čistý efekt (cash) | Payback (cash) | Payback (cash+kapacita) |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    scenarios = [
        ("Stresový — adopcia zlyháva", 0.25, 0.35),
        ("Pesimistický", 0.40, 0.60),
        ("Konzervatívny (základ rozhodovania)", REALIZATION_Y1, 1.00),
        ("Steady-state (rok 2+, vrátane v0.7 pák)", REALIZATION_STEADY, 1.15),
    ]
    for name, real_factor, cash_factor in scenarios:
        cap = TOTAL_CAPACITY_VALUE / REALIZATION_Y1 * real_factor
        cash = REVENUE_GROSS * cash_factor
        net_cash = cash - PRIMARY_COST
        net_total = cash + cap - PRIMARY_COST
        pb_cash = ONETIME_TOTAL / net_cash if net_cash > 0 else float("inf")
        pb_total = ONETIME_TOTAL / net_total if net_total > 0 else float("inf")
        lines.append(
            f"| {name} | {pct(real_factor, 0)} | {pct(cash_factor, 0)} | {euro(cash)} | {euro(cap)} "
            f"| {euro(PRIMARY_COST)} | {euro(net_cash)} | {sk(pb_cash, 1)} mes. | {sk(pb_total, 1)} mes. |"
        )
    return "\n".join(lines)


def md_ramp() -> str:
    lines = [
        "| Mesiac | Realizačný faktor | Kumulatívny čistý efekt (cash + kapacita − náklady − jednorazové) |",
        "|---|---|---|",
    ]
    for m in (1, 2, 3, 4, 6, 9, 12, 18, 24, 36):
        row = next(r for r in CUM_ROWS if r[0] == m)
        lines.append(f"| {m} | {pct(row[1], 0)} | {euro(row[2])} |")
    return "\n".join(lines)


def md_risk() -> str:
    lines = [
        "| Riziko | Sadzba / škoda | Pravdepodobnosť ročne | Očakávaná hodnota €/rok | Ako to OpenVPM AI znižuje |",
        "|---|---|---|---|---|",
    ]
    mitigations = {
        0: "idempotentné doklady, offline fronta, denná uzávierka, OKP/PKP evidencia",
        1: "KVEPIS XSD validátor, ambulantná kniha, hlásenia nákaz, auditný reťazec",
        2: "zero AI prefill, povinný svedok, trezorová bilancia, immutable log",
        3: "HITL finalizácia, nemennosť záznamu, korekcie cez addendum/replacement",
        4: "RLS izolácia, consent gate, suppression centrum, sympathy gate",
    }
    for i, (name, amount, prob, note) in enumerate(RISK_ITEMS):
        lines.append(
            f"| {name} | {euro(amount)} | {pct(prob)} | {euro(amount * prob)} | {mitigations[i]} ({note}) |"
        )
    lines.append(f"| **Σ** | — | — | **{euro(RISK_ANNUAL)}** | ≈ {euro(RISK_ANNUAL / 12)}/mes. |")
    return "\n".join(lines)


JOURNEY_MAP: list[tuple[str, list[str]]] = [
    ("J1 — Hľadanie pacienta/majiteľa", ["L01"]),
    ("J2 — Klinická karta a hlasové diktovanie", ["L02", "L03", "L04", "L14"]),
    ("J3 — Nový SOAP z encounteru", ["L03", "L04"]),
    ("J4 — Anamnéza a história", ["L02"]),
    ("J5 — Clinical Guardian", ["L05"]),
    ("J6 — Nový klient a pacient", ["L28"]),
    ("J7 — Objednanie termínu", ["L22"]),
    ("J8 — Check-in, čakáreň, whiteboard", ["L23", "L14"]),
    ("J9 — Zmena/zrušenie a pripomienky", ["L26", "L27"]),
    ("J10 — Predpis, výdaj, účtovanie liečiva", ["L06", "L16"]),
    ("J11 — Faktúra, platba, e-Kasa", ["L24"]),
    ("J12 — Closeout a odovzdanie klientovi", ["L07", "L25"]),
    ("J13 — Očkovanie a hlásenie besnoty", ["L08", "L20"]),
    ("J14 — Recall a revakcinácia", ["L30"]),
    ("J15 — Wellness plán", ["L34"]),
    ("J16 — Laboratórne výsledky", ["L09", "L15"]),
    ("J17 — RTG / VHS a AI nález", ["L10"]),
    ("J18/J19 — Marketing a reputácia", ["L33"]),
    ("J27 — Klientsky portál", ["L29"]),
    ("J28 — Legislatívny cyklus", ["L13", "L32"]),
    ("J29 — Eutanázia a sympathy gate", ["L12"]),
    ("JX-01 — Skladové hospodárstvo", ["L17", "L18", "L19", "L35"]),
    ("JX-02 — Manažérske reporty", ["L31"]),
    ("JG-C02/C03 — Hospitalizácia a chirurgia (v0.7)", ["L11", "L21"]),
    ("JG-D06 — Poistné udalosti (v0.7)", ["L36"]),
]


def md_journey_map() -> str:
    lines = [
        "| Journey (Sekcia 1) | Ledger riadky | Poznámka |",
        "|---|---|---|",
    ]
    by_code = {r.code: r for r in LEDGER}
    for label, codes in JOURNEY_MAP:
        rows = [by_code[c] for c in codes if c in by_code]
        if not rows:
            continue
        detail = "; ".join(
            f"{r.code}: {hours(r.real_hours)} / {euro(r.real_eur)} ({r.role})" for r in rows
        )
        lines.append(f"| {label} | {', '.join(codes)} | {detail} |")
    lines.append("")
    lines.append(
        "> Niektoré ledger riadky sú zdieľané viacerými journey (napr. L03 patrí J2 aj J3, "
        "L14 patrí J2 aj J8) — v súčtoch BC sa každý riadok započítava **práve raz** podľa stĺpca BC."
    )
    return "\n".join(lines)


def build() -> str:
    vet_model, vet_real, vet_eur = role_totals("lekár")
    out: list[str] = []
    w = out.append
    w("<!-- GENEROVANÉ skriptom scripts/spec-v07-financial-model.py — NEUPRAVOVAŤ RUČNE -->")
    w("")
    w("# Finančný model OpenVPM AI — referenčná klinika (3 MVDr., 45 pacientov/deň)")
    w("")
    w("> **Status:** parametrický model, nie meranie z produkcie. Všetky vstupy sú explicitné;")
    w("> zmenu predpokladov robte výhradne v skripte a generujte znova.")
    w("")
    w("**Metodika**")
    w("")
    w("1. **Kapacitná hodnota** (časový ledger) = ušetrené hodiny × hodinová sadzba. Nie je to cash-flow,")
    w("   kým sa čas nekonvertuje na ďalšie výkony alebo sa nezníži počet FTE. Preto sa v ROI vykazujú")
    w("   *dva* paybacky: iba hard cash (konzervatívny) a cash + kapacita (plná hodnota).")
    w("2. **Realizačný faktor** (rok 1: 55 %) pokrýva learning curve, čiastočnú adopciu a prípady,")
    w("   kde automatizácia nefunguje (offline, výnimky, kontrola). Steady-state rok 2+: 80 %.")
    w("3. **Atribúcia systému** pri výnosových pákach (35–70 %) oddeľuje efekt systému od trhových,")
    w("   sezónnych a personálnych vplyvov — bez nej by model pripisoval OpenVPM AI celý rast tržieb.")
    w("4. **Žiadne dvojité započítanie:** každý ledger riadok má práve jeden BC; R1 (no-show) a R7")
    w("   (konverzia kapacity na nové termíny) sa vzájomne vylučujú — započítava sa len R1.")
    w("5. **Rizikové efekty** (pokuty, regresy) sú vykázané ako očakávaná hodnota, nie ako mesačný cash.")
    w("")
    w("## A. Referenčný model kliniky")
    w("")
    w("| Parameter | Hodnota | Odvodenie |")
    w("|---|---|---|")
    w(f"| Pacienti / deň | {PATIENTS_PER_DAY} | {MIX_CONSULT} konzultácií + {MIX_PREVENTIVE} preventívnych + {MIX_PROCEDURE} procedúr |")
    w(f"| Pracovné dni / mesiac | {sk(WORKDAYS_PER_MONTH, 1)} | vrátane 2 sobôt z 3 |")
    w(f"| Návštevy / mesiac | {VISITS_DISPLAY} | {PATIENTS_PER_DAY} × {sk(WORKDAYS_PER_MONTH, 1)} |")
    w(f"| Priemerný účet | {euro(AVG_TICKET, 2)} | vážený mix ({euro(TICKET_CONSULT)} / {euro(TICKET_PREVENTIVE)} / {euro(TICKET_PROCEDURE)}) |")
    w(f"| Obrat / deň | {euro(DAILY_REVENUE)} | — |")
    w(f"| Obrat / mesiac | {euro(MONTHLY_REVENUE)} | — |")
    w(f"| Obrat / rok | {euro(ANNUAL_REVENUE)} | — |")
    w(f"| Personál | {VETS} MVDr. + {TECHS} technici + {sk(RECEPTION_FTE, 1)} FTE recepcia + {sk(ADMIN_FTE, 1)} FTE admin | — |")
    w(f"| Kapacita personálu | {hours(TOTAL_STAFF_HOURS)}/mes. | 168 h × FTE |")
    w(f"| Sadzby (pásmo 25–35 €/h) | lekár {euro(RATE_VET)}, technik {euro(RATE_TECH)}, recepcia {euro(RATE_RECEPTION)}, admin {euro(RATE_ADMIN)} | horná hranica pre lekára, spodná pre recepciu |")
    w(f"| Aktívna kmeňová báza | ~{sk(ACTIVE_PATIENT_BASE)} pacientov | {VISITS_DISPLAY} × 12 / 2,6 návštevy/rok |")
    w("")
    w("## B. Časový ledger (L01–L36)")
    w("")
    w(md_ledger())
    w("")
    w("## C. Úspory podľa rolí")
    w("")
    w(md_role_summary())
    w("")
    w(f"**Lekári:** model {hours(vet_model)} → realizované {hours(vet_real)} "
      f"= {vet_real * 60 / VETS / WORKDAYS_PER_MONTH:.0f} min/deň/lekár = {euro(vet_eur)}/mes.")
    w("")
    w("## D. Mapa journey → ledger (podklad pre Sekciu 1)")
    w("")
    w(md_journey_map())
    w("")
    w("## E. Výnosové páky (hard cash)")
    w("")
    w(md_levers())
    w("")
    w("## F. Alokácia na business cases (bez dvojitého započítania)")
    w("")
    w(md_bc_allocation())
    w("")
    w("## G. Náklady")
    w("")
    w(md_costs())
    w("")
    w("| Jednorazová investícia | Hodnota |")
    w("|---|---|")
    w(f"| Migrácia dát + školenie (partner) | {euro(ONETIME_MIGRATION_TRAINING)} |")
    w(f"| Hardvér (tablet, mikrofón, tlačiareň dokladov) | {euro(ONETIME_HARDWARE)} |")
    w(f"| Interný čas školenia ({ONETIME_INTERNAL_HOURS:g} h × {euro(RATE_BLENDED)}) | {euro(ONETIME_INTERNAL_HOURS * RATE_BLENDED)} |")
    w(f"| **Spolu** | **{euro(ONETIME_TOTAL)}** |")
    w("")
    w("## H. Payback a ROI (základný scenár: Cloud Nemocnica)")
    w("")
    w("| Metrika | Hodnota |")
    w("|---|---|")
    w(f"| Hard cash prínos | {euro(REVENUE_GROSS)}/mes. |")
    w(f"| Kapacitná hodnota (nie cash, kým sa nekonvertuje) | {euro(TOTAL_CAPACITY_VALUE)}/mes. |")
    w(f"| Prevádzkový náklad | {euro(PRIMARY_COST)}/mes. |")
    w(f"| Čistý mesačný cash efekt | {euro(NET_MONTHLY)}/mes. |")
    w(f"| **Payback jednorazových nákladov (iba hard cash)** | **{sk(PAYBACK_CASH, 1)} mesiaca** |")
    w(f"| **Payback (cash + kapacitná hodnota)** | **{sk(ONETIME_TOTAL / (NET_MONTHLY + TOTAL_CAPACITY_VALUE), 1)} mesiaca** |")
    w(f"| Násobok návratnosti predplatného (iba cash) | {sk(ROI_MULTIPLE_CASH, 1)}× |")
    w(f"| Násobok návratnosti predplatného (cash + kapacita) | {sk(ROI_MULTIPLE_TOTAL, 1)}× |")
    w(f"| Ročný čistý cash efekt | {euro(NET_MONTHLY * 12)} |")
    w(f"| Kumulatívny efekt za 36 mesiacov | {euro(CUM_36)} |")
    w("")
    w("## I. Citlivosť")
    w("")
    w(md_sensitivity())
    w("")
    w("## J. Rampa adopcie a kumulatívny efekt")
    w("")
    w(md_ramp())
    w("")
    w("## K. Rizikové (ne-cash) efekty — očakávaná hodnota")
    w("")
    w(md_risk())
    w("")
    return "\n".join(out)


if __name__ == "__main__":
    doc = build()
    target = "docs/product/spec-v07/_generated/financial-model.md"
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "w", encoding="utf-8") as fh:
        fh.write(doc)
    print(doc)
    print(f"[OK] zapísané do {target}")
