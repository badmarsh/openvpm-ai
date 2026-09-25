# Tasks / Golden Tickets

Tento adresár slúži na ukladanie schválených špecifikácií úloh (Golden Tickets) vytvorených pomocou skillu [\
ew-task\](../.agents/skills/new-task/SKILL.md).

## Štruktúra súboru úlohy
Každá úloha sa ukladá ako samostatný markdown súbor v tvare \	asks/<kratky-nazov-funkcie>.md\.

## Životný cyklus úlohy
1. **[STATUS: PROPOSED]** — Úloha je navrhnutá, čaká na pripomienky alebo akceptáciu človekom.
2. **[STATUS: READY_FOR_IMPLEMENTATION]** — Úloha má schválené acceptance criteria, ohraničený scope a je pripravená na kódovanie (WIP = 1).
3. **[STATUS: IN_PROGRESS]** — Na úlohe aktuálne pracuje vývojár alebo AI agent.
4. **[STATUS: IN_REVIEW]** — Kód je napísaný, acceptance criteria odškrtnuté, testy overené.
5. **[STATUS: DONE]** — Zmeny sú mergnuté a otestované v prostredí.
