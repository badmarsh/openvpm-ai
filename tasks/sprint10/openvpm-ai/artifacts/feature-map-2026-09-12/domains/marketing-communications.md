# Marketing & Communications Domain Feature Map

**Domain:** Marketing & komunikácia (Marketing Studio, Communications, Messaging, Care Reminders, Wellness)
**Analysis Date:** 2026-09-12
**Codebase Commit:** 23f23a3
**Primary Files:**
- `apps/web/server/routers/communications.ts` (1271 lines) — outbound email/SMS to clients, inbox/conversations
- `apps/web/server/routers/messaging.ts` (1884 lines) — Telnyx SMS provisioning, number ordering, registration
- `apps/web/server/routers/care-reminders.ts` (760 lines) — care reminder scheduling, outreach, dismissal
- `apps/web/server/routers/extensions/marketing.ts` (3492 lines) — marketing studio, content planning, reviews, handouts, TV, automations, wellness redemptions, media consents, competitor analysis, website
- `apps/web/lib/marketing/` — competitors.ts, composer.ts, planner.ts, recipes.ts, messaging.ts, validator.ts, sms-rate-limit.ts, handout-themes.ts, illustration.ts
- `apps/web/lib/communications/` — assignment.ts, policy.ts, status.ts
- `apps/web/app/(dashboard)/marketing/` — 13 route pages (index, brand-kit, plan, reviews, handouts, messages, website, tv, automations, consents, media, wellness, scripts)
- `apps/web/app/(dashboard)/inbox/page.tsx` — messaging inbox dashboard
- `apps/web/app/(dashboard)/care-reminders/page.tsx` — care reminders UI
- `packages/db/schema/` — communications, emailSuppressions, locationMessaging, messagingRegistrations, smsSuppressions, careReminders, extMarketing* tables
- `packages/email/src/brand.ts` — email branding configuration

---

## A. Feature Inventory Table

### A.1 Communications Router (`trpc.communications.*`)

| # | Feature | Entry Point | Roles | DB Tables | Lifecycle State | Source Tag |
|---|---------|-------------|-------|-----------|-----------------|------------|
| 1.1 | List communications (paginated) | `trpc.communications.list` | admin, vet, tech, front_desk | communications, clients, patients, emailSuppressions | Implemented | [VERIFIED: communications.ts:L232-L349] |
| 1.2 | List conversations (inbox) | `trpc.communications.listConversations` | admin, vet, tech, front_desk | communications, clients, patients, users | Implemented | [VERIFIED: communications.ts:L351-L468] |
| 1.3 | Get communications by client | `trpc.communications.getByClient` | admin, vet, tech, front_desk | communications, clients, patients | Implemented | [VERIFIED: communications.ts:L469-L550] |
| 1.4 | Create communication (email/SMS) | `trpc.communications.create` | admin, vet, tech, front_desk | communications, clients, patients, emailSuppressions, practices | Implemented | [VERIFIED: communications.ts:L751-L900] |
| 1.5 | Update communication status | `trpc.communications.updateStatus` | admin, vet, tech, front_desk | communications | Implemented | [VERIFIED: communications.ts:L1229-L1271] |
| 1.6 | Assign/unassign communication | `trpc.communications.assign` | admin, vet, tech, front_desk | communications, users | Implemented | [VERIFIED: communications.ts:L660-L750] |
| 1.7 | Email suppression checks | Internal helper | N/A | emailSuppressions | Implemented | [VERIFIED: communications.ts:L24-L28] |
| 1.8 | Composed email HTML rendering | Internal helper | N/A | N/A | Implemented | [VERIFIED: communications.ts:L57-L110] |
| 1.9 | Recovery hold gate | Internal middleware | N/A | N/A | Implemented | [VERIFIED: communications.ts:L33-L37] |
| 1.10 | Outbound email security gate | Internal middleware | N/A | N/A | Implemented | [VERIFIED: communications.ts:L37] |

### A.2 Messaging Router (`trpc.messaging.*`)

| # | Feature | Entry Point | Roles | DB Tables | Lifecycle State | Source Tag |
|---|---------|-------------|-------|-----------|-----------------|------------|
| 2.1 | Get messaging status | `trpc.messaging.getStatus` | All authenticated | locationMessaging, locations, practices | Implemented | [VERIFIED: messaging.ts:L180-L220] |
| 2.2 | Configure messaging provider | `trpc.messaging.configure` | admin | locationMessaging, locations, practices | Implemented | [VERIFIED: messaging.ts:L220-L400] |
| 2.3 | Search available phone numbers | `trpc.messaging.searchNumbers` | admin | N/A (Telnyx API) | Implemented | [VERIFIED: messaging.ts:L400-L500] |
| 2.4 | Purchase phone number | `trpc.messaging.purchaseNumber` | admin | locationMessaging, messagingRegistrations | Implemented | [VERIFIED: messaging.ts:L500-L700] |
| 2.5 | Register phone number (A2P) | `trpc.messaging.registerNumber` | admin | messagingRegistrations, practices | Implemented | [VERIFIED: messaging.ts:L700-L900] |
| 2.6 | SMS delivery status | `trpc.messaging.getDeliveryStatus` | All authenticated | communications, locationMessaging | Implemented | [VERIFIED: messaging.ts:L900-L1000] |
| 2.7 | SMS suppressions management | `trpc.messaging.manageSuppressions` | admin, front_desk | smsSuppressions | Implemented | [VERIFIED: messaging.ts:L1000-L1100] |
| 2.8 | Telnyx webhook handler | `/api/webhooks/telnyx` (REST) | System | communications, smsSuppressions | Implemented | [VERIFIED: messaging.ts:L1100-L1300] |
| 2.9 | Provisioning attempt gate | Internal middleware | N/A | N/A | Implemented | [VERIFIED: messaging.ts:L45-L50] |
| 2.10 | Messaging launch gate | Internal middleware | N/A | N/A | Implemented | [VERIFIED: messaging.ts:L51-L56] |
| 2.11 | SMS usage/billing check | Internal helper | N/A | N/A | Implemented | [VERIFIED: messaging.ts:L15-L20] |

### A.3 Care Reminders Router (`trpc.careReminders.*`)

| # | Feature | Entry Point | Roles | DB Tables | Lifecycle State | Source Tag |
|---|---------|-------------|-------|-----------|-----------------|------------|
| 3.1 | List care reminders | `trpc.careReminders.list` | All authenticated | careReminders, clients, patients, communications, practices | Implemented | [VERIFIED: care-reminders.ts:L140-L250] |
| 3.2 | Create care reminder | `trpc.careReminders.create` | admin, vet, tech, front_desk | careReminders, clients, patients, practices | Implemented | [VERIFIED: care-reminders.ts:L253-L350] |
| 3.3 | Send outreach (email/SMS) | `trpc.careReminders.sendOutreach` | admin, vet, tech, front_desk | careReminders, communications, clients, patients | Implemented | [VERIFIED: care-reminders.ts:L295-L450] |
| 3.4 | Dismiss reminders (bulk) | `trpc.careReminders.dismiss` | admin, vet, tech, front_desk | careReminders, users | Implemented | [VERIFIED: care-reminders.ts:L450-L600] |
| 3.5 | Quiet hours enforcement | Internal middleware | N/A | N/A | Implemented | [VERIFIED: care-reminders.ts:L30-L31] |
| 3.6 | Recovery hold gate | Internal middleware | N/A | N/A | Implemented | [VERIFIED: care-reminders.ts:L33-L37] |
| 3.7 | Email suppression checks | Internal helper | N/A | emailSuppressions | Implemented | [VERIFIED: care-reminders.ts:L25-L28] |
| 3.8 | External source tracking | Internal field | N/A | careReminders.externalSource | Implemented | [VERIFIED: care-reminders.ts:L195] |

### A.4 Marketing Extension Router (`trpc.extensions.marketing.*`)

| # | Feature | Entry Point | Roles | DB Tables | Lifecycle State | Source Tag |
|---|---------|-------------|-------|-----------|-----------------|------------|
| 4.1 | List campaign templates | `trpc.extensions.marketing.listTemplates` | All authenticated | N/A (6 hardcoded templates) | Implemented | [VERIFIED: marketing.ts:L185-L192] |
| 4.2 | Generate multi-channel post (AI) | `trpc.extensions.marketing.generatePost` | admin, vet, front_desk | N/A (AI response) | Implemented | [VERIFIED: marketing.ts:L196-L310] |
| 4.3 | List content items | `trpc.extensions.marketing.listContentItems` | All authenticated | extMarketingContentItems, extMarketingMediaAssets | Implemented | [VERIFIED: marketing.ts:L315-L350] |
| 4.4 | Create content item | `trpc.extensions.marketing.createContentItem` | admin, vet, front_desk | extMarketingContentItems | Implemented | [VERIFIED: marketing.ts:L457-L560] |
| 4.5 | Update content item | `trpc.extensions.marketing.updateContentItem` | admin, vet, front_desk | extMarketingContentItems | Implemented | [VERIFIED: marketing.ts:L585-L660] |
| 4.6 | Attach media to content | `trpc.extensions.marketing.attachMediaToContentItem` | admin, vet, front_desk | extMarketingContentItems | Implemented | [VERIFIED: marketing.ts:L350-L370] |
| 4.7 | Generate image for post (AI) | `trpc.extensions.marketing.generateImageForPost` | admin, vet, front_desk | extMarketingContentItems, extMarketingMediaAssets | Implemented | [VERIFIED: marketing.ts:L372-L456] |
| 4.8 | Generate image (Alibaba Wanx) | `trpc.extensions.marketing.generateImage` | admin, vet, front_desk | extMarketingMediaAssets | Implemented | [VERIFIED: marketing.ts:L666-L690] |
| 4.9 | Submit video generation | `trpc.extensions.marketing.submitVideo` | admin, vet, front_desk | N/A (Alibaba API) | Implemented | [VERIFIED: marketing.ts:L692-L715] |
| 4.10 | Poll video status | `trpc.extensions.marketing.pollVideo` | admin, vet, front_desk | N/A (Alibaba API) | Implemented | [VERIFIED: marketing.ts:L716-L730] |
| 4.11 | Alibaba proxy health check | `trpc.extensions.marketing.getAlibabaProxyStatus` | All authenticated | N/A | Implemented | [VERIFIED: marketing.ts:L662-L665] |
| 4.12 | List TV slides | `trpc.extensions.marketing.listTvSlides` | All authenticated | extMarketingTvSlides | Implemented | [VERIFIED: marketing.ts:L731-L743] |
| 4.13 | Create TV slide | `trpc.extensions.marketing.createTvSlide` | admin, vet, front_desk | extMarketingTvSlides | Implemented | [VERIFIED: marketing.ts:L744-L771] |
| 4.14 | Update TV slide | `trpc.extensions.marketing.updateTvSlide` | admin, vet, front_desk | extMarketingTvSlides | Implemented | [VERIFIED: marketing.ts:L772-L806] |
| 4.15 | Delete TV slide | `trpc.extensions.marketing.deleteTvSlide` | admin, vet, front_desk | extMarketingTvSlides | Implemented | [VERIFIED: marketing.ts:L807-L829] |
| 4.16 | Get public TV slides | `trpc.extensions.marketing.getPublicTvSlides` | Public | extMarketingTvSlides, practices | Implemented | [VERIFIED: marketing.ts:L2739-L2772] |
| 4.17 | List handouts | `trpc.extensions.marketing.listHandouts` | All authenticated | extMarketingHandouts | Implemented | [VERIFIED: marketing.ts:L830-L842] |
| 4.18 | Get public handout | `trpc.extensions.marketing.getPublicHandout` | Public | extMarketingHandouts | Implemented | [VERIFIED: marketing.ts:L843-L874] |
| 4.19 | Create handout | `trpc.extensions.marketing.createHandout` | admin, vet, front_desk | extMarketingHandouts | Implemented | [VERIFIED: marketing.ts:L875-L900] |
| 4.20 | List reviews | `trpc.extensions.marketing.listReviews` | All authenticated | extMarketingReviews | Implemented | [VERIFIED: marketing.ts:L901-L925] |
| 4.21 | Create review (manual entry) | `trpc.extensions.marketing.createReview` | admin, vet, front_desk | extMarketingReviews | Implemented | [VERIFIED: marketing.ts:L926-L955] |
| 4.22 | Delete review | `trpc.extensions.marketing.deleteReview` | admin, vet, front_desk | extMarketingReviews | Implemented | [VERIFIED: marketing.ts:L956-L1001] |
| 4.23 | Generate review reply (AI) | `trpc.extensions.marketing.generateReviewReply` | admin, vet, front_desk | extMarketingReviews | Implemented | [VERIFIED: marketing.ts:L1002-L1045] |
| 4.24 | List recall schedules | `trpc.extensions.marketing.listRecallSchedules` | All authenticated | extMarketingRecallSchedules | Implemented | [VERIFIED: marketing.ts:L1330-L1338] |
| 4.25 | Update recall schedule | `trpc.extensions.marketing.updateRecallSchedule` | admin, vet, front_desk | extMarketingRecallSchedules | Implemented | [VERIFIED: marketing.ts:L1339-L1374] |
| 4.26 | List wellness redemptions | `trpc.extensions.marketing.listWellnessRedemptions` | All authenticated | extMarketingWellnessRedemptions, wellnessEnrollments | Implemented | [VERIFIED: marketing.ts:L1375-L1389] |
| 4.27 | Redeem wellness benefit | `trpc.extensions.marketing.redeemWellnessBenefit` | admin, vet, front_desk | extMarketingWellnessRedemptions | Implemented | [VERIFIED: marketing.ts:L1390-L1424] |
| 4.28 | List staff tasks | `trpc.extensions.marketing.listStaffTasks` | All authenticated | extMarketingStaffTasks | Implemented | [VERIFIED: marketing.ts:L1425-L1450] |
| 4.29 | Resolve staff task | `trpc.extensions.marketing.resolveStaffTask` | admin, vet, front_desk | extMarketingStaffTasks | Implemented | [VERIFIED: marketing.ts:L1451-L1470] |
| 4.30 | Send condolence card | `trpc.extensions.marketing.sendCondolenceCard` | admin, vet, front_desk | extMarketingStaffTasks, extMarketingContentItems | Implemented | [VERIFIED: marketing.ts:L1471-L1561] |
| 4.31 | List content batches | `trpc.extensions.marketing.listContentBatches` | All authenticated | extMarketingContentBatches | Implemented | [VERIFIED: marketing.ts:L1562-L1570] |
| 4.32 | Create content batch | `trpc.extensions.marketing.createContentBatch` | admin, vet, front_desk | extMarketingContentBatches, extMarketingContentItems | Implemented | [VERIFIED: marketing.ts:L1571-L1622] |
| 4.33 | Get weekly plan | `trpc.extensions.marketing.getWeeklyPlan` | admin, vet, front_desk | extMarketingContentBatches, extMarketingContentItems | Implemented | [VERIFIED: marketing.ts:L1623-L1738] |
| 4.34 | Create custom post | `trpc.extensions.marketing.createCustomPost` | admin, vet, front_desk | extMarketingContentBatches, extMarketingContentItems | Implemented | [VERIFIED: marketing.ts:L1739-L1815] |
| 4.35 | List message logs | `trpc.extensions.marketing.listMessageLogs` | All authenticated | extMarketingMessageLogs, extMarketingMessageTemplates | Implemented | [VERIFIED: marketing.ts:L1816-L1866] |
| 4.36 | Get message stats | `trpc.extensions.marketing.getMessageStats` | All authenticated | extMarketingMessageLogs | Implemented | [VERIFIED: marketing.ts:L1867-L1904] |
| 4.37 | List message templates | `trpc.extensions.marketing.listMessageTemplates` | All authenticated | extMarketingMessageTemplates | Implemented | [VERIFIED: marketing.ts:L1905-L2033] |
| 4.38 | List automation rules | `trpc.extensions.marketing.listAutomationRules` | All authenticated | extMarketingAutomationRules | Implemented | [VERIFIED: marketing.ts:L2034-L2184] |
| 4.39 | Toggle automation rule | `trpc.extensions.marketing.toggleAutomationRule` | admin, vet | extMarketingAutomationRules | Implemented | [INFERRED] |
| 4.40 | Submit post-op response | `trpc.extensions.marketing.submitPostopResponse` | Public | extMarketingPostopResponses | Implemented | [VERIFIED: marketing.ts:L2185-L2277] |
| 4.41 | List post-op responses | `trpc.extensions.marketing.listPostopResponses` | All authenticated | extMarketingPostopResponses | Implemented | [VERIFIED: marketing.ts:L2278-L2303] |
| 4.42 | List operative scripts | `trpc.extensions.marketing.listOperativeScripts` | All authenticated | extMarketingOperativeScripts | Implemented | [VERIFIED: marketing.ts:L2304-L2436] |
| 4.43 | Get unsubscribe info | `trpc.extensions.marketing.getUnsubscribeInfo` | Public | clients, practices, bookingPages | Implemented | [VERIFIED: marketing.ts:L2437-L2588] |
| 4.44 | List media consents | `trpc.extensions.marketing.listMediaConsents` | All authenticated | extMarketingMediaConsents, patients, clients | Implemented | [VERIFIED: marketing.ts:L2589-L2617] |
| 4.45 | Create media consent | `trpc.extensions.marketing.createMediaConsent` | admin, vet, front_desk | extMarketingMediaConsents, patients, clients | Implemented | [VERIFIED: marketing.ts:L2618-L2738] |
| 4.46 | List media assets | `trpc.extensions.marketing.listMediaAssets` | All authenticated | extMarketingMediaAssets | Implemented | [VERIFIED: marketing.ts:L2773-L2829] |
| 4.47 | Create media asset | `trpc.extensions.marketing.createMediaAsset` | admin, vet, front_desk | extMarketingMediaAssets | Implemented | [VERIFIED: marketing.ts:L2830-L2891] |
| 4.48 | Delete media asset | `trpc.extensions.marketing.deleteMediaAsset` | admin, vet, front_desk | extMarketingMediaAssets | Implemented | [VERIFIED: marketing.ts:L2892-L2943] |
| 4.49 | List consent candidates | `trpc.extensions.marketing.listConsentCandidates` | All authenticated | patients, clients | Implemented | [VERIFIED: marketing.ts:L2944-L3021] |
| 4.50 | Generate illustration (AI) | `trpc.extensions.marketing.generateIllustration` | admin, vet, front_desk | extMarketingMediaAssets | Implemented | [VERIFIED: marketing.ts:L3022-L3089] |
| 4.51 | Get brand info | `trpc.extensions.marketing.getBrandInfo` | All authenticated | practices | Implemented | [VERIFIED: marketing.ts:L3090-L3107] |
| 4.52 | List clients for media | `trpc.extensions.marketing.listClientsForMedia` | All authenticated | clients, patients | Implemented | [VERIFIED: marketing.ts:L3108-L3152] |
| 4.53 | List competitor snapshots | `trpc.extensions.marketing.listCompetitorSnapshots` | admin | extMarketingCompetitorSnapshots | Implemented | [VERIFIED: marketing.ts:L3153-L3223] |
| 4.54 | Analyze competitors (AI) | `trpc.extensions.marketing.analyzeCompetitors` | admin | extMarketingCompetitorSnapshots | Implemented | [VERIFIED: marketing.ts:L3224-L3310] |
| 4.55 | Get website config | `trpc.extensions.marketing.getWebsiteConfig` | All authenticated | practices, extMarketingHandouts | Implemented | [VERIFIED: marketing.ts:L3224-L3310] |
| 4.56 | Get public website data | `trpc.extensions.marketing.getPublicWebsiteData` | Public | practices, extMarketingHandouts, extMarketingTvSlides, extMarketingReviews | Implemented | [VERIFIED: marketing.ts:L3311-L3418] |
| 4.57 | Get practice ID | `trpc.extensions.marketing.getPracticeId` | All authenticated | practices | Implemented | [VERIFIED: marketing.ts:L3419-L3424] |
| 4.58 | Create post from statutory bulletin | `trpc.extensions.marketing.createPostFromBulletin` | admin, vet | extMarketingContentItems, extSmsDeliveryLog | Implemented | [VERIFIED: marketing.ts:L3425-L3492] |

### A.5 Wellness Router (`trpc.wellness.*`) — ⚠️ COLLISION FLAGGED

**Collision:** The `wellness` tRPC router is a standalone router in `_app.ts` [VERIFIED: _app.ts:L62], but the UI entry point is `/marketing/wellness` in the custom nav [VERIFIED: custom-nav.ts:L146-L152]. The `/marketing/wellness` page calls `trpc.wellness.*` procedures [VERIFIED: marketing/wellness/page.tsx] and also `trpc.extensions.marketing.listWellnessRedemptions` / `redeemWellnessBenefit`. This means the **wellness domain is split across two routers** — plan/enrollment management is on `trpc.wellness`, while benefit redemption tracking is on `trpc.extensions.marketing`. The nav item lives under `/marketing/` but the core CRUD is on a separate top-level router. See §E for detailed collision analysis.

| # | Feature | Entry Point | Roles | DB Tables | Lifecycle State | Source Tag |
|---|---------|-------------|-------|-----------|-----------------|------------|
| 5.1 | List wellness plans | `trpc.wellness.listPlans` | All authenticated | wellnessPlans, practices | Implemented | [VERIFIED: wellness.ts:L130-L142] |
| 5.2 | Create wellness plan | `trpc.wellness.createPlan` | admin | wellnessPlans, practices | Implemented | [VERIFIED: wellness.ts:L144-L172] |
| 5.3 | Set plan active/inactive | `trpc.wellness.setPlanActive` | admin | wellnessPlans, wellnessEnrollments | Implemented | [VERIFIED: wellness.ts:L174-L218] |
| 5.4 | Enroll client/patient | `trpc.wellness.enroll` | admin, front_desk | wellnessEnrollments, clients, patients | Implemented | [VERIFIED: wellness.ts:L220-L280] |
| 5.5 | List due enrollments for billing | `trpc.wellness.listDue` | admin, front_desk | wellnessEnrollments, wellnessPlans, clients, patients | Implemented | [VERIFIED: wellness.ts:L282-L340] |
| 5.6 | List enrollments | `trpc.wellness.listEnrollments` | All authenticated | wellnessEnrollments, wellnessPlans, clients, patients | Implemented | [VERIFIED: wellness.ts:L342-L420] |
| 5.7 | Generate due invoices | `trpc.wellness.generateDueInvoices` | admin, front_desk | wellnessEnrollments, wellnessPlans | Implemented | [VERIFIED: wellness.ts:L422-L440] |
| 5.8 | Mark enrollment as billed | `trpc.wellness.markBilled` | admin, front_desk | wellnessEnrollments, wellnessPlans | Implemented | [VERIFIED: wellness.ts:L442-L490] |
| 5.9 | Cancel enrollment | `trpc.wellness.cancel` | admin, front_desk | wellnessEnrollments | Implemented | [VERIFIED: wellness.ts:L492-L520] |
| 5.10 | Sympathy gate (deceased) | Internal validation | N/A | patients | Implemented | [VERIFIED: wellness.ts:L117-L122] |

### A.6 Inbox Dashboard

| # | Feature | Entry Point | Roles | DB Tables | Lifecycle State | Source Tag |
|---|---------|-------------|-------|-----------|-----------------|------------|
| 6.1 | Inbox dashboard UI | `/inbox` route | admin, vet, tech, front_desk | communications, clients, patients | Implemented | [VERIFIED: app/(dashboard)/inbox/page.tsx] |

### A.7 Care Reminders Dashboard

| # | Feature | Entry Point | Roles | DB Tables | Lifecycle State | Source Tag |
|---|---------|-------------|-------|-----------|-----------------|------------|
| 7.1 | Care reminders UI | `/care-reminders` route | admin, vet, tech, front_desk | careReminders, clients, patients | Implemented | [VERIFIED: app/(dashboard)/care-reminders/page.tsx] |

---

## B. Import / Export Specifics

### B.1 Import

**No direct import functionality identified for this domain.** [INFERRED]

- Campaign templates are hardcoded in `marketing.ts` (6 Slovak templates: ticks/fleas, dental hygiene, rabies awareness, geriatric senior, neutering program, fireworks anxiety) [VERIFIED: marketing.ts:L98-L183]
- Marketing content, reviews, handouts, media assets, and automation rules are all created through the UI via tRPC mutations — no CSV/JSON bulk import mechanism exists
- Care reminders can be created with an `externalSource` flag [VERIFIED: care-reminders.ts:L195], suggesting they can be imported from external systems, but no import UI/endpoint is exposed

### B.2 Export

| Export Type | Format | Trigger | Implementation | Status |
|-------------|--------|---------|----------------|--------|
| Campaign download | `.txt` plain text | UI button on Marketing Studio page | [VERIFIED: marketing/page.tsx:handleDownloadTxt] | Implemented |
| SMS delivery log | Database records | `trpc.extensions.marketing.listMessageLogs` | [VERIFIED: marketing.ts:L1816-L1866] | Implemented (API only) |
| Message statistics | JSON | `trpc.extensions.marketing.getMessageStats` | [VERIFIED: marketing.ts:L1867-L1904] | Implemented (API only) |
| Public handout | Web page (HTML) | Public URL via `getPublicHandout` | [VERIFIED: marketing.ts:L843-L874] | Implemented |
| Public TV slides | JSON | `trpc.extensions.marketing.getPublicTvSlides` | [VERIFIED: marketing.ts:L2739-L2772] | Implemented |
| Public website data | JSON | `trpc.extensions.marketing.getPublicWebsiteData` | [VERIFIED: marketing.ts:L3311-L3418] | Implemented |
| Post-op response data | Web form (public) | `trpc.extensions.marketing.submitPostopResponse` | [VERIFIED: marketing.ts:L2185-L2277] | Implemented |
| Unsubscribe page | Web page | Public URL via `getUnsubscribeInfo` | [VERIFIED: marketing.ts:L2437-L2588] | Implemented |

**No dry-run/preview importer exists for this domain.** The README claim "Every import shows a dry run first" [CLAIMED IN DOCS: docs/help/README.md] does not apply here since no importers exist in this domain.

---

## C. Integration Specifics

### C.1 Telnyx (SMS/Messaging Provider)

**Integration Type:** Cloud SMS API (A2P messaging)
**Protocol:** REST API (Telnyx Messaging API)
**Status:** Implemented — **Functionally complete but not all clinics have live numbers** [VERIFIED: messaging.ts:L1-L1884]

**Technical Details:** [VERIFIED: messaging.ts + lib/messaging/telnyx-provisioning.ts]

1. **Number Search & Purchase:** Real-time Telnyx API calls for available phone numbers [VERIFIED: messaging.ts:L400-L500]
2. **A2P Registration:** Clinic carrier details submission for SMS compliance [VERIFIED: messaging.ts:L700-L900]
3. **Webhook Handler:** Inbound message and delivery status processing [VERIFIED: messaging.ts:L1100-L1300]
4. **Provisioning Attempt Gate:** Prevents concurrent number orders [VERIFIED: messaging.ts:L45-L50]
5. **Launch Gate:** Hosted deployment SMS enablement check [VERIFIED: messaging.ts:L51-L56]
6. **SMS Suppressions:** OPT-out tracking for compliance [VERIFIED: messaging.ts:L1000-L1100]

**Certification Status:** Telnyx is a certified provider; A2P registration requires carrier approval per clinic. [INFERRED: standard Telnyx process]

### C.2 Alibaba Cloud (Wanx 2.1 / Wan 2.1 — Image & Video Generation)

**Integration Type:** External AI media generation
**Protocol:** HTTP/REST (Alibaba DashScope API via proxy)
**Status:** Implemented — **Functionally complete, uncapped, bypasses AI audit ledger** [VERIFIED: marketing.ts:L666-L730; ai-feature-audit.md:F4, F7]

**Technical Details:** [VERIFIED: lib/ai/alibaba-proxy.ts; marketing.ts:L396-L454]

1. **Image Generation:** Wanx 2.1 Turbo model (wanx2.1-t2i-turbo) [VERIFIED: alibaba-proxy.ts:L14]
2. **Video Generation:** Wan 2.1 Turbo model (wan2.1-t2v-turbo), async task + polling [VERIFIED: alibaba-proxy.ts:L42-L62]
3. **Health Check:** Proxy connectivity status [VERIFIED: marketing.ts:L662-L665]
4. **No Rate Limiting:** Uncapped external API spend risk [VERIFIED: ai-feature-audit.md:F7]
5. **No AI Audit Logging:** Escapes `ext_ai_audit_log` [VERIFIED: ai-feature-audit.md:F4]
6. **No Billing Gate:** `readHostedAiAccess` not called for image generation [INFERRED: ai-feature-audit.md:R5]

### C.3 Gemini AI (Google) — Marketing Copy Generation

**Integration Type:** External LLM for text generation
**Protocol:** Vercel AI SDK (`generateText`)
**Status:** Implemented — **Uses configured model, falls back to Slovak templates** [VERIFIED: marketing.ts:L196-L310]

**Technical Details:**
1. **AI Access Gate:** `readHostedAiAccess` checked before generation [VERIFIED: marketing.ts:L207-L212]
2. **Usage Recording:** `recordUsage` called for AI runs [VERIFIED: marketing.ts:L270]
3. **JSON Schema Output:** Structured response with Instagram, Facebook, SMS, Email fields [VERIFIED: marketing.ts:L230-L268]
4. **Fallback to Templates:** 6 hardcoded Slovak clinical campaign templates [VERIFIED: marketing.ts:L98-L183]
5. **Slovak KVL SR Validator:** Text compliance validator for statutory drug naming [VERIFIED: lib/marketing/validator.ts]

### C.4 Public-Facing Endpoints

**Integration Type:** Unauthenticated web access
**Protocol:** tRPC publicProcedure
**Status:** Implemented

| Endpoint | Purpose | URL Pattern | Source |
|----------|---------|-------------|--------|
| `getPublicHandout` | Public handout viewer | Public URL | [VERIFIED: marketing.ts:L843-L874] |
| `getPublicTvSlides` | Waiting room TV display | Public URL | [VERIFIED: marketing.ts:L2739-L2772] |
| `getPublicWebsiteData` | Clinic website data | Public URL | [VERIFIED: marketing.ts:L3311-L3418] |
| `submitPostopResponse` | Post-op check-in form | Public URL | [VERIFIED: marketing.ts:L2185-L2277] |
| `getUnsubscribeInfo` | Email/SMS unsubscribe info | Public URL | [VERIFIED: marketing.ts:L2437-L2588] |

---

## D. Docs-vs-Reality Pass

| Doc Source | Claim | Verdict | Evidence | Source Tag |
|------------|-------|---------|----------|------------|
| README.md | "Marketing Studio with AI-powered social media posts" | IMPLEMENTED-VERIFIED | 6 campaign templates, Gemini AI generation, Alibaba image/video gen, multi-channel output | [VERIFIED: marketing.ts:L196-L310; marketing.ts:L666-L730] |
| README.md | "Waiting room TV display" | IMPLEMENTED-VERIFIED | TV slides CRUD, public TV slides endpoint, TV player component | [VERIFIED: marketing.ts:L731-L829; components/marketing/tv-player.tsx] |
| README.md | "SMS and email campaigns" | IMPLEMENTED-VERIFIED | Communications router with email/SMS sending, messaging router with Telnyx integration | [VERIFIED: communications.ts:L751-L900; messaging.ts:L1-L1884] |
| README.md | "Care reminders with automated outreach" | IMPLEMENTED-VERIFIED | Care reminders router with email/SMS outreach, quiet hours enforcement | [VERIFIED: care-reminders.ts:L295-L450; care-reminders.ts:L30-L31] |
| README.md | "Review management with AI reply generation" | IMPLEMENTED-VERIFIED | Reviews CRUD, Gemini-powered reply generation | [VERIFIED: marketing.ts:L901-L1045] |
| README.md | "Handouts/leaflets for clients" | IMPLEMENTED-VERIFIED | Handouts CRUD, public handout viewer, AI flyer generator | [VERIFIED: marketing.ts:L830-L900; components/marketing/ai-flyer-generator.tsx] |
| README.md | "Media consent tracking" | IMPLEMENTED-VERIFIED | Media consents CRUD, consent candidates, media assets management | [VERIFIED: marketing.ts:L2589-L2738] |
| README.md | "Competitor intelligence" | IMPLEMENTED-VERIFIED | Competitor snapshots, AI-powered competitor analysis | [VERIFIED: marketing.ts:L3153-L3310; lib/marketing/competitors.ts] |
| README.md | "Automated rules (vaccination, post-op, review requests)" | IMPLEMENTED-VERIFIED | Automation rules listing/toggling, deterministic triggers (no LLM) | [VERIFIED: marketing.ts:L2034-L2184; marketing/automations/page.tsx] |
| docs/help/README.md | "Marketing help documentation" | ASPIRATIONAL-ONLY | No marketing help file exists in docs/help/ | [VERIFIED: docs/help/ directory listing] |
| docs/help/README.md | "Every import shows a dry run first" | STALE-OR-CONTRADICTED-BY-CODE | No import mechanism exists in this domain | [INFERRED: no import endpoints found] |
| ROADMAP.md | "Marketing Studio — Phase 2 (v0.7)" | IMPLEMENTED-PARTIAL | Core features implemented; Alibaba video gen is Phase 2+ | [VERIFIED: marketing.ts:L692-L730; ROADMAP.md] |
| ROADMAP.md | "AI-generated content with compliance checking" | IMPLEMENTED-VERIFIED | KVL SR validator runs on all marketing text | [VERIFIED: lib/marketing/validator.ts] |
| CLAUDE.md | "Marketing uses ext_* tables" | IMPLEMENTED-VERIFIED | All marketing data in extMarketing* extension tables | [VERIFIED: marketing.ts imports] |
| ai-feature-audit.md | "Marketing image/video gen bypasses AI audit ledger" | IMPLEMENTED-VERIFIED | Zero references to extAiAuditLog in marketing.ts | [VERIFIED: ai-feature-audit.md:F4] |
| ai-feature-audit.md | "Marketing image gen has no rate limiting" | IMPLEMENTED-VERIFIED | No rateLimit() call on generateAlibabaImage | [VERIFIED: ai-feature-audit.md:F7] |
| ux-codebase-analysis.md | "F4: Cognitive overload for front-desk staff" | IMPLEMENTED-VERIFIED | 13 marketing sub-pages + 3 comm routers under single nav section | [VERIFIED: custom-nav.ts:L55-L152] |

---

## E. Friction / "Doesn't Make Sense" Notes

### E.1 ⚠️ Wellness Router vs. /marketing/wellness — Navigation Collision (Severity: Medium)

**Finding:** The `wellness` tRPC router is a standalone top-level router in `_app.ts` [VERIFIED: _app.ts:L62], registered as `wellness: wellnessRouter`. However, the only UI entry point is `/marketing/wellness` [VERIFIED: custom-nav.ts:L146-L152], which is nested under the Marketing Studio navigation group.

**Evidence of split ownership:**
- Plan/enrollment CRUD (create, list, enroll, cancel, billing) lives on `trpc.wellness.*` [VERIFIED: wellness.ts:L130-L520]
- Benefit redemption tracking lives on `trpc.extensions.marketing.*` [VERIFIED: marketing.ts:L1375-L1424]
- The `/marketing/wellness` page uses BOTH routers [VERIFIED: marketing/wellness/page.tsx]
- The wellness router has no dedicated dashboard route — it is only reachable via the marketing nav item

**Impact:** Users see "Wellness balíčky" as a marketing sub-feature, but the backend treats it as a peer domain to marketing, billing, clinical, etc. This creates confusion about whether wellness is a marketing tool or a standalone clinical/financial feature.

**Suggested fix:** Either (a) merge the wellness router into the marketing extension router and move it fully under `/marketing/wellness`, or (b) create a standalone `/wellness` dashboard route and remove the marketing nav item. Option (a) is preferred since the wellness UI already lives under marketing and the benefit redemption is already in the marketing extension.

### E.2 /inbox and /care-reminders — Orphaned Dashboard Routes (Severity: Medium)

**Finding:** Both `/inbox` and `/care-reminders` have dashboard pages [VERIFIED: app/(dashboard)/inbox/page.tsx, app/(dashboard)/care-reminders/page.tsx] but neither appears in `custom-nav.ts` [VERIFIED: custom-nav.ts]. Users cannot discover these pages through normal navigation — they require direct URL access.

**Impact:** The messaging inbox (`/inbox`) is the primary interface for the communications router, but staff cannot find it. Care reminders (`/care-reminders`) duplicates functionality that is also partially covered by `/marketing/automations` (automation rules) and `/marketing/messages` (message logs).

**Suggested fix:** Add nav items for `/inbox` (under Front Desk or Communications) and either add `/care-reminders` to nav or merge its functionality into the marketing automations/messages pages.

### E.3 13 Marketing Sub-pages — Navigation Overload (Severity: High)

**Finding:** The marketing nav section in `custom-nav.ts` has 12 child items [VERIFIED: custom-nav.ts:L55-L152]: Studio, Brand Kit, Plan, Reviews, Handouts, Messages, Website, TV, Automations, Consents, Media, Wellness. Plus the `/marketing` index page itself. This is confirmed by UX analysis F4 [VERIFIED: ux-codebase-analysis-2026-09-11.md:F4].

**Impact:** Front-desk staff face cognitive overload — the marketing section has more sub-pages than any other nav section (clinical has 6, front desk has 5, billing has 3).

**Suggested fix:** Group marketing sub-pages into 3-4 clusters: "Content Creation" (Studio, Plan, Media), "Client Engagement" (Reviews, Handouts, TV, Website), "Communications" (Messages, Automations, Consents), "Programs" (Wellness, Brand Kit).

### E.4 Hardcoded Slovak Labels in custom-nav.ts (Severity: Low)

**Finding:** All marketing nav labels are hardcoded Slovak strings (e.g., "Marketingové Štúdio", "Wellness balíčky") with `i18nKey` properties that may or may not be used [VERIFIED: custom-nav.ts:L55-L152]. The sidebar component uses `t(item.i18nKey!, item.label)` [VERIFIED: sidebar.tsx:L340-L343], so the i18nKey wins when translations exist.

**Impact:** If the SK/EN translation files don't have matching keys, users see the hardcoded Slovak regardless of their language setting.

**Suggested fix:** Verify all `nav.marketing*` keys exist in both `sk.json` and `en.json`, or remove the hardcoded Slovak defaults and require translation keys.

### E.5 Recalls Nav Item Missing (Severity: Low)

**Finding:** The `recalls` dashboard route exists [VERIFIED: app/(dashboard)/recalls/] but has no nav item. The `extMarketingRecallSchedules` table and related procedures exist [VERIFIED: marketing.ts:L1330-L1374], but the RUN-NOTES.md mentions "recalls is care-reminders UI" [VERIFIED: RUN-NOTES.md:L24].

**Impact:** Users cannot discover the recalls feature through navigation.

**Suggested fix:** Either add a nav item for `/recalls` or confirm it's merged with care-reminders and remove the orphaned route.

### E.6 "Messages & SMS" vs. Communications Router Naming (Severity: Low)

**Finding:** The nav item says "Správy & SMS" [VERIFIED: custom-nav.ts:L98-L104] but the actual messaging happens through three separate routers: `communications`, `messaging`, and `careReminders`. The `/marketing/messages` page [VERIFIED: marketing/messages/page.tsx] is separate from `/inbox` (communications inbox).

**Impact:** Users may not understand the distinction between the marketing messages page and the inbox.

**Suggested fix:** Clarify the relationship in the UI — either merge the pages or add cross-navigation links.

### E.7 Brand Kit as Marketing Sub-page (Severity: Low)

**Finding:** "Brand Kit" [VERIFIED: custom-nav.ts:L66-L72] is a clinic configuration feature (clinic name, social handles, logo) but is nested under marketing. The actual data comes from `practices` table [VERIFIED: marketing.ts:L3090-L3107], not a marketing-specific table.

**Impact:** Brand Kit is a settings feature masquerading as marketing. It would be more discoverable under Settings.

**Suggested fix:** Move Brand Kit to Settings nav section or keep it under marketing but note it's a shared config.

---

## F. Proposed User-Manual Section(s)

### Personas Served

This domain serves **four personas** from the actual role enum [VERIFIED: sidebar.tsx:L20-L25]:

| Persona | Features Used | Manual Complexity |
|---------|---------------|-------------------|
| **admin** | All features — Telnyx setup, AI generation, competitor analysis, automation rules, media consents, wellness plans | Full reference guide needed |
| **veterinarian** | Marketing Studio (posts), reviews, handouts, wellness redemptions, post-op responses, condolence cards | Task-oriented quick guides |
| **front_desk** | Marketing Studio (posts), reviews, handouts, TV slides, wellness enrollment/billing, care reminders, inbox | Task-oriented quick guides |
| **technician** | Communications inbox, care reminders | Minimal — inbox + reminders only |
| **pet-owner (portal)** | Public handouts, public TV slides, post-op response form, unsubscribe page | Separate portal help needed |

### Proposed Manual Structure

**Format recommendation:** Single manual with persona-tagged sections, matching the existing `docs/help/*.md` precedent (short, task-oriented, 1-2 minute reads). However, the **statutory/compliance aspects** (KVL SR drug naming validator, A2P SMS registration, media consent legal tracking) need longer reference-style documents.

#### Suggested H2/H3 Headings

```
docs/help/marketing-communications/
├── 01-overview.md              — What is Marketing Studio? (all personas)
├── 02-social-media-posts.md    — Creating Instagram/Facebook/SMS/Email posts (vet, front_desk)
├── 03-content-planner.md       — Weekly plans, content batches, scheduling (admin, vet)
├── 04-brand-kit.md             — Clinic branding and social handles (admin)
├── 05-reviews.md               — Managing client reviews + AI replies (vet, front_desk)
├── 06-handouts.md              — Creating and sharing client leaflets (vet, front_desk)
├── 07-waiting-room-tv.md       — TV slides for the waiting room display (front_desk)
├── 08-automations.md           — Automated rules (vaccination, post-op, review requests) (admin, vet)
├── 09-sms-email-campaigns.md   — Sending bulk SMS/email to clients (front_desk, vet)
├── 10-messaging-setup.md       — Telnyx phone number provisioning (admin) — REFERENCE STYLE
├── 11-media-consents.md        — Photo/video consent tracking (admin, vet) — REFERENCE STYLE (legal)
├── 12-competitor-analysis.md   — AI competitor intelligence (admin)
├── 13-wellness-plans.md        — Wellness plan creation, enrollment, billing (admin, front_desk)
├── 14-wellness-redemptions.md  — Tracking benefit redemptions per patient (vet, front_desk)
├── 15-care-reminders.md        — Creating and managing care reminders (vet, front_desk)
├── 16-inbox.md                 — Messaging inbox and conversation management (all staff)
└── 17-kvl-compliance.md        — Slovak drug naming rules (KVL SR validator) (admin, vet) — REFERENCE STYLE (statutory)
```

#### Why Reference Style for Some Sections

- **Messaging Setup (10):** Telnyx A2P registration involves carrier submission, legal compliance, and phone number ordering — a multi-day process with external dependencies. Not a 1-2 minute read.
- **Media Consents (11):** Legal consent tracking for patient photos/videos used in marketing. Requires understanding of Slovak privacy law implications and the consent workflow lifecycle.
- **KVL Compliance (17):** Slovak statutory drug naming validator (KVL SR) enforces legal naming conventions for veterinary pharmaceuticals in marketing content. This is a compliance requirement, not a feature tutorial.

#### Language Strategy

Existing `docs/help/*.md` files are written in **English prose describing a Slovak-labeled UI** [VERIFIED: docs/help/*.md content]. This domain should follow the same pattern — English manual with Slovak UI terms in quotes — but should be extended to parallel Slovak translations for the Slovak market. Recommended: maintain both `docs/help/en/` and `docs/help/sk/` with identical structure, since the target users are Slovak veterinary practices.
