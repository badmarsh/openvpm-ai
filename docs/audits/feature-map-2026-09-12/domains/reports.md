# Reports Domain — Feature Map Analysis

**Analysis Date:** 2026-09-12  
**Commit:** 23f23a3  
**Domain:** Reports & Analytics  
**Analyst:** Senior Product-Documentation Architect

---

## A. Feature Inventory Table

| # | Feature | Description | Status | Source |
|---|---------|-------------|--------|--------|
| 1 | Revenue Report | Displays total revenue for selected date range with comparison to previous period, daily breakdown chart | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L98-156] |
| 2 | Appointments Report | Shows total appointments, completed, no-shows, cancellations, fill rate, and doctor breakdown | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L158-219] |
| 3 | Top Services Report | Lists top 10 services by count with revenue totals | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L221-268] |
| 4 | Inventory Alerts Report | Displays low stock, expired, and expiring soon products | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L270-324] |
| 5 | Rabies Vaccination Register (RVPS) | Legal register of rabies vaccinations with patient/client details, searchable | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L326-418] |
| 6 | Treatment Diary | Clinical diary of treated animals (SOAP notes) with search and pagination | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L420-508] |
| 7 | Euthanasia Register | Register of deceased animals with owner information | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L510-566] |
| 8 | Legacy Financial Summary | Financial overview from VetSoftware V2 with yearly breakdown | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L568-609] |
| 9 | Date Range Presets | Quick selection: Last 30 Days, Month to Date, Last Month, Year to Date | ✅ Implemented | [VERIFIED: apps/web/lib/reports/date-range.ts:L118-148] |
| 10 | Custom Date Range | Manual start/end date selection with validation (max 366 days) | ✅ Implemented | [VERIFIED: apps/web/lib/reports/date-range.ts:L76-94] |
| 11 | Practice Timezone Support | Reports use practice timezone for date calculations | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L52-65] |
| 12 | CSV Export | Export any report tab to CSV format | ✅ Implemented | [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L147-156] |
| 13 | PDF Export | Export any report tab to PDF format with jsPDF (lazy-loaded) | ✅ Implemented | [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L158-177] |
| 14 | Role-Based Access | Reports restricted to admin and veterinarian roles | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L27-29] |
| 15 | Advanced Reporting Feature Flag | Cloud feature gated by feature flag (unrestricted on self-host) | ✅ Implemented | [VERIFIED: apps/web/server/routers/reports.ts:L27-29] |
| 16 | Empty State Handling | Proper empty states when no data available | ✅ Implemented | [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L391-400] |
| 17 | Error Handling & Retry | Error states with retry functionality | ✅ Implemented | [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L203-216] |
| 18 | Loading Skeletons | Animated loading states while data fetches | ✅ Implemented | [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L115-127] |

**Total Features:** 18  
**Implementation Status:** 100% complete

---

## B. Import / Export Specifics

### Export Formats

#### CSV Export
- **Implementation:** Client-side CSV generation using Blob API
- **Source:** [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L147-156]
- **Features:**
  - Proper CSV escaping for quotes, commas, and newlines
  - UTF-8 encoding with BOM for Excel compatibility
  - Filename format: `{tab}-report-{startDate}_to_{endDate}.csv`
  - Includes all data rows with appropriate headers
- **Supported Tabs:** Revenue, Appointments, Services, Inventory

#### PDF Export
- **Implementation:** Lazy-loaded jsPDF via dynamic import
- **Source:** [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L158-177]
- **Features:**
  - Professional PDF generation with title, subtitle, columns, and rows
  - Empty message support when no data available
  - Filename format: `{tab}-report-{startDate}_to_{endDate}.pdf`
  - Currency formatting applied to monetary values
- **Supported Tabs:** Revenue, Appointments, Services, Inventory
- **Performance:** jsPDF library loaded on-demand to reduce initial bundle size

### Import Functionality
- **Status:** Not applicable for reports domain
- **Note:** Reports are read-only aggregations; no import functionality required

### Data Validation
- **Date Range Validation:** Max 366 days, start ≤ end, YYYY-MM-DD format
- **Source:** [VERIFIED: apps/web/lib/reports/date-range.ts:L76-94]
- **Error Messages:** Clear validation messages displayed in UI
- **Source:** [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L251-263]

---

## C. Integration Specifics

### Database Tables Used

| Table | Purpose | Reports Using It |
|-------|---------|------------------|
| `invoices` | Revenue calculations, financial summaries | Revenue Report, Legacy Financial Summary |
| `invoice_items` | Service-level revenue breakdown | Top Services Report |
| `appointments` | Appointment statistics and doctor breakdown | Appointments Report |
| `products` | Inventory tracking and alerts | Inventory Alerts Report |
| `vaccination_records` | Rabies vaccination register | Rabies Register (RVPS) |
| `patients` | Patient data for clinical reports | Treatment Diary, Euthanasia Register, Rabies Register |
| `clients` | Client/owner information | Treatment Diary, Euthanasia Register, Rabies Register |
| `soap_notes` | Clinical SOAP notes | Treatment Diary |
| `users` | Doctor information for appointment breakdown | Appointments Report |
| `practices` | Practice timezone and validation | All reports (via context) |
| `legacy_financial_documents` | VetSoftware V2 financial data | Legacy Financial Summary |

### External Integrations
- **None identified:** Reports domain is self-contained, no external API calls
- **Source:** [INFERRED: No external imports in reports.ts]

### Feature Flags
- **Flag Name:** `advancedReporting`
- **Behavior:** 
  - Cloud deployment: Feature gated (requires subscription)
  - Self-hosted: Unrestricted access
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L27-29]

### Role-Based Access Control
- **Allowed Roles:** `admin`, `veterinarian`
- **Enforcement:** Middleware-level check via `requireRole()`
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L28]
- **UI Enforcement:** Client-side role check before rendering dashboard
- **Source:** [VERIFIED: apps/web/app/(dashboard)/reports/page.tsx:L73-75]

### Timezone Handling
- **Source:** Practice timezone stored in `practices.timezone`
- **Application:** Used for date range calculations and daily aggregation
- **Fallback:** UTC if practice timezone not set
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L52-65]

---

## D. Docs-vs-Reality Pass

### API Documentation Analysis

**Location:** `apps/web/app/api-docs/page.tsx`

#### Reports Endpoints in API Docs
- **Status:** ⚠️ NOT DOCUMENTED
- **Finding:** The API documentation page does not include any reports endpoints
- **Source:** [VERIFIED: apps/web/app/api-docs/page.tsx - searched for "reports" section, not found]
- **Reality:** 8 report endpoints exist in the backend:
  1. `reports.settings`
  2. `reports.revenue`
  3. `reports.appointments`
  4. `reports.topServices`
  5. `reports.inventoryAlerts`
  6. `reports.rabiesRegister`
  7. `reports.treatmentDiary`
  8. `reports.euthanasiaRegister`
  9. `reports.legacyFinancialSummary`

#### Feature Flag Documentation
- **Status:** ⚠️ NOT DOCUMENTED
- **Finding:** No mention of `advancedReporting` feature flag in user-facing docs
- **Source:** [INFERRED: No feature flag documentation found]

#### Slovak Statutory Reports
- **Status:** ✅ IMPLEMENTED BUT NOT HIGHLIGHTED
- **Finding:** Rabies Register (RVPS) is a legal requirement but not prominently documented
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L326-418]
- **Recommendation:** Should be highlighted in compliance documentation

### README Claims vs Reality

#### Claim: "Moderný otvorený veterinárny informačný systém"
- **Reality:** ✅ Accurate - comprehensive PIMS with reports functionality
- **Source:** [VERIFIED: README.md:L7]

#### Claim: "plnou slovenskou legislatívnou konformitou"
- **Reality:** ⚠️ Partially accurate - rabies register implemented, but KVEPIS integration incomplete
- **Source:** [VERIFIED: GAP_ANALYSIS_POST_PILOT_READY.md:L-01]

### Test Coverage

#### Unit Tests
- **File:** `apps/web/server/__tests__/reports.test.ts`
- **Status:** ✅ Exists
- **Coverage:** Server-side report logic

#### UI Tests
- **File:** `apps/web/lib/__tests__/reports-export-ui.test.ts`
- **Status:** ✅ Comprehensive
- **Coverage:** 
  - CSV export functionality
  - PDF export with lazy loading
  - Empty state handling
  - Role-based access
  - Date range validation
  - Practice timezone usage
- **Source:** [VERIFIED: apps/web/lib/__tests__/reports-export-ui.test.ts]

---

## E. Friction / "Doesn't Make Sense" Notes

### 1. Missing API Documentation
- **Issue:** Reports endpoints not documented in API reference
- **Impact:** Developers cannot integrate with reports programmatically
- **Severity:** Medium
- **Recommendation:** Add reports section to `apps/web/app/api-docs/page.tsx`

### 2. Inconsistent Report Naming
- **Issue:** Some reports use camelCase (`topServices`), others use descriptive names (`rabiesRegister`)
- **Impact:** Minor inconsistency in API naming
- **Severity:** Low
- **Recommendation:** Standardize naming convention

### 3. Inventory Report Without Date Range
- **Issue:** Inventory Alerts report doesn't accept date range parameters
- **Impact:** Cannot view historical inventory alerts
- **Severity:** Low
- **Rationale:** Inventory is point-in-time, so this may be intentional
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L270]

### 4. Legacy Financial Summary Without Date Filtering
- **Issue:** Legacy financial summary shows all-time data without date filtering
- **Impact:** Cannot analyze specific time periods for imported data
- **Severity:** Low
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L568]

### 5. Euthanasia Register Status Filter
- **Issue:** Euthanasia register only filters by `status: "deceased"`, doesn't distinguish cause
- **Impact:** Cannot separate euthanasia from natural death
- **Severity:** Medium
- **Recommendation:** Add `deathReason` field or separate register
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L510-566]

### 6. Treatment Diary Search Limitations
- **Issue:** Treatment diary search only searches patient name, client name, assessment, and plan
- **Impact:** Cannot search by diagnosis, symptoms, or specific treatments
- **Severity:** Low
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L445-453]

### 7. No Scheduled Report Generation
- **Issue:** Reports are on-demand only, no scheduled email/PDF generation
- **Impact:** Manual effort required for regular reporting
- **Severity:** Medium
- **Recommendation:** Consider adding scheduled report feature in future

### 8. No Report Sharing
- **Issue:** Reports cannot be shared between users or exported to external systems
- **Impact:** Limited collaboration capabilities
- **Severity:** Low
- **Note:** PDF export partially addresses this

### 9. Missing Chart Interactivity
- **Issue:** Charts are static, no drill-down or hover details
- **Impact:** Limited data exploration capabilities
- **Severity:** Low
- **Source:** [VERIFIED: apps/web/components/reports/report-charts.tsx]

### 10. Rabies Register Search Complexity
- **Issue:** Rabies register uses complex SQL LIKE queries for vaccine name matching
- **Impact:** May miss vaccines with different naming conventions
- **Severity:** Low
- **Source:** [VERIFIED: apps/web/server/routers/reports.ts:L348-355]
- **Recommendation:** Consider vaccine type categorization

---

## F. Proposed User-Manual Section(s)

### Section 1: Reports Overview
**Target Audience:** Practice administrators, veterinarians  
**Content:**
- Introduction to the reports module
- Access requirements (admin/veterinarian roles)
- Overview of available report types
- Date range selection and presets
- Understanding practice timezone impact

### Section 2: Revenue Reports
**Target Audience:** Practice administrators, accountants  
**Content:**
- How to view revenue for specific periods
- Understanding period-over-period comparison
- Daily revenue breakdown interpretation
- Exporting revenue data to CSV/PDF
- Using revenue reports for tax preparation
- Troubleshooting missing revenue data

### Section 3: Appointment Analytics
**Target Audience:** Practice managers, veterinarians  
**Content:**
- Viewing appointment statistics
- Understanding fill rate metrics
- Doctor breakdown analysis
- Identifying no-show patterns
- Exporting appointment reports
- Using data to optimize scheduling

### Section 4: Service Performance Reports
**Target Audience:** Practice administrators, veterinarians  
**Content:**
- Top services by count and revenue
- Identifying high-value services
- Service mix analysis
- Exporting service reports for business planning

### Section 5: Inventory Management Reports
**Target Audience:** Veterinary technicians, practice managers  
**Content:**
- Understanding inventory alerts
- Low stock management
- Expired product handling
- Expiring soon products (90-day window)
- Exporting inventory reports for ordering
- Setting reorder points

### Section 6: Statutory Compliance Reports
**Target Audience:** Veterinarians, compliance officers  
**Content:**
- **Rabies Vaccination Register (RVPS)**
  - Legal requirements under Slovak law
  - Accessing the rabies register
  - Searching by patient, owner, or microchip
  - Exporting for official inspections
  - Data retention requirements
- **Treatment Diary**
  - Clinical documentation requirements
  - Searching treatment records
  - Exporting for legal purposes
- **Euthanasia Register**
  - Legal documentation of euthanasia
  - Owner information tracking
  - Export requirements

### Section 7: Legacy Data Reports
**Target Audience:** Practices migrating from VetSoftware V2  
**Content:**
- Understanding legacy financial summary
- Comparing legacy vs. current data
- Exporting legacy reports
- Migration completion verification

### Section 8: Export and Sharing
**Target Audience:** All report users  
**Content:**
- CSV export format and Excel compatibility
- PDF export features and formatting
- File naming conventions
- Best practices for report archiving
- Sharing reports with stakeholders

### Section 9: Troubleshooting
**Target Audience:** All report users  
**Content:**
- "No data available" - common causes
- Date range validation errors
- Missing revenue data
- Empty appointment reports
- Contacting support for report issues

### Section 10: Advanced Features (Future)
**Target Audience:** Power users  
**Content:**
- Scheduled report generation (planned)
- Custom report builders (planned)
- API access for programmatic reporting (planned)
- Integration with accounting software (planned)

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Report Types | 8 |
| Export Formats | 2 (CSV, PDF) |
| Database Tables Used | 11 |
| Feature Flags | 1 |
| Role Restrictions | 2 (admin, veterinarian) |
| Test Files | 2 |
| UI Components | 4 main tabs + 4 statutory reports |
| Documentation Gaps | 3 major (API docs, feature flags, statutory reports) |
| Friction Points | 10 identified |
| Proposed Manual Sections | 10 |

---

## Recommendations

### Immediate (Before Production)
1. **Add API documentation** for all reports endpoints
2. **Document feature flag** behavior for cloud vs. self-hosted
3. **Highlight statutory reports** in compliance documentation
4. **Clarify euthanasia register** scope and limitations

### Short-term (Q4 2026)
5. **Add date filtering** to legacy financial summary
6. **Improve rabies register** vaccine matching logic
7. **Add scheduled reports** feature for regular reporting
8. **Enhance treatment diary** search capabilities

### Long-term (2027)
9. **Add report sharing** and collaboration features
10. **Implement custom report builder** for advanced users
11. **Add chart interactivity** with drill-down capabilities
12. **Integrate with accounting software** for automated reporting

---

## Verification Checklist

- [x] All report endpoints verified in source code
- [x] Export functionality tested via unit tests
- [x] Role-based access control verified
- [x] Date range validation confirmed
- [x] Timezone handling verified
- [x] Empty state handling confirmed
- [x] Error handling verified
- [x] Database integrations mapped
- [x] Documentation gaps identified
- [x] User manual sections proposed

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-12  
**Next Review:** After pilot deployment feedback
