# server.js Modularization Plan - Complete Analysis

## Current State
- **Total Lines:** 10,169 lines
- **Total Routes:** 83 endpoints
- **Status:** Monolithic - All logic in single file

---

## Route Analysis by Category

### 1. CORE / HEALTH (Lines 93-433)
**Routes: 2**
- `GET /` (Line 93) - Homepage
- `GET /api/health` (Line 433) - Health check

**Proposed Module:** `/app/backend/routes/healthRoutes.js`
**Service:** `/app/backend/services/healthService.js`
**Priority:** P3 (Low priority - simple routes)

---

### 2. LOCKBOX DATA MANAGEMENT (Lines 467-879)
**Routes: 5**
- `GET /api/lockbox/headers` (Line 467) - Get all lockbox headers
- `GET /api/lockbox/template` (Line 490) - Get upload template
- `POST /api/lockbox/upload` (Line 618) - Upload lockbox file
- `GET /api/lockbox/hierarchy/:headerId` (Line 779) - Get hierarchy
- `DELETE /api/lockbox/headers/:id` (Line 879) - Delete header

**Proposed Module:** `/app/backend/routes/lockboxRoutes.js`
**Service:** `/app/backend/services/lockboxService.js`
**Priority:** P2 (High - Core functionality)
**Lines to Move:** ~412 lines (467-879)

---

### 3. LOCKBOX PROCESSING (Lines 1876-2942)
**Routes: 6**
- `GET /api/lockbox/preview-payload/:headerId` (Line 1876) - Preview payload
- `POST /api/lockbox/_disabled_simulate/:headerId` (Line 1913) - Simulate (disabled)
- `POST /api/lockbox/_disabled_post/:headerId` (Line 2068) - Post (disabled)
- `POST /api/lockbox/retrieve-clearing/:headerId` (Line 2719) - Retrieve clearing
- `GET /api/runs` (Line 2942) - Get all runs
- `GET /api/run/:runId` (Line 3012) - Get single run

**Proposed Module:** `/app/backend/routes/lockboxProcessingRoutes.js`
**Service:** `/app/backend/services/lockboxProcessingService.js`
**Priority:** P1 (Critical - Main processing logic)
**Lines to Move:** ~1,066 lines (1876-2942)

---

### 4. RUN MANAGEMENT (Lines 3012-3099)
**Routes: 2**
- `GET /api/run/:runId` (Line 3012) - Get run details
- `GET /api/lockbox/:lockboxId/runs` (Line 3099) - Get runs by lockbox

**Proposed Module:** `/app/backend/routes/runRoutes.js` (Already exists)
**Service:** `/app/backend/services/runService.js` (Already exists)
**Priority:** P1 (Already partially modularized)
**Lines to Move:** ~87 lines (3012-3099)

---

### 5. FIELD MAPPING - TEMPLATES (Lines 4311-4365)
**Routes: 3**
- `GET /api/field-mapping/templates` (Line 4311) - Get all templates
- `POST /api/field-mapping/templates` (Line 4321) - Create template
- `DELETE /api/field-mapping/templates/:templateId` (Line 4348) - Delete template

**Proposed Module:** `/app/backend/routes/fieldMapping/templateRoutes.js`
**Service:** `/app/backend/services/fieldMapping/templateService.js`
**Priority:** P2 (Medium)
**Lines to Move:** ~54 lines (4311-4365)

---

### 6. FIELD MAPPING - PATTERNS (Lines 4365-4746)
**Routes: 13**
- `GET /api/field-mapping/patterns` (Line 4365) - Get all patterns
- `GET /api/field-mapping/patterns/:patternId` (Line 4398) - Get single pattern
- `POST /api/field-mapping/patterns` (Line 4412) - Create pattern
- `PUT /api/field-mapping/patterns/:patternId` (Line 4489) - Update pattern
- `DELETE /api/field-mapping/patterns/:patternId` (Line 4523) - Delete pattern
- `POST /api/field-mapping/patterns/sync-to-db` (Line 4560) - Sync to DB
- `PATCH /api/field-mapping/patterns/:patternId/toggle` (Line 4616) - Toggle active
- `POST /api/field-mapping/patterns/:patternId/copy` (Line 4640) - Copy pattern
- `GET /api/field-mapping/pattern-types` (Line 4685) - Get pattern types
- `GET /api/field-mapping/pattern-categories` (Line 4708) - Get categories
- `GET /api/field-mapping/delimiters` (Line 4725) - Get delimiters
- `GET /api/field-mapping/rules` (Line 4746) - Get rules
- `GET /api/field-mapping/ref-doc-rules` (Line 4758) - Get ref doc rules

**Proposed Module:** `/app/backend/routes/fieldMapping/patternRoutes.js`
**Service:** `/app/backend/services/fieldMapping/patternService.js`
**Priority:** P2 (Medium)
**Lines to Move:** ~381 lines (4365-4746)

---

### 7. FIELD MAPPING - RULES (Lines 4746-4856)
**Routes: 5**
- `GET /api/field-mapping/rules` (Line 4746) - Get all rules
- `POST /api/field-mapping/rules` (Line 4800) - Create rule
- `PUT /api/field-mapping/rules/:ruleId` (Line 4821) - Update rule
- `DELETE /api/field-mapping/rules/:ruleId` (Line 4839) - Delete rule
- `PUT /api/field-mapping/ref-doc-rules/:ruleId/select` (Line 4772) - Select ref doc rule

**Proposed Module:** `/app/backend/routes/fieldMapping/ruleRoutes.js`
**Service:** `/app/backend/services/fieldMapping/ruleService.js`
**Priority:** P2 (Medium)
**Lines to Move:** ~110 lines (4746-4856)

---

### 8. FIELD MAPPING - PROCESSING RULES (Lines 4856-5085)
**Routes: 6**
- `GET /api/field-mapping/processing-rules` (Line 4856) - Get all processing rules ✅
- `GET /api/field-mapping/processing-rules/:ruleId` (Line 4866) - Get single rule ✅
- `POST /api/field-mapping/processing-rules` (Line 4880) - Create rule ✅
- `PUT /api/field-mapping/processing-rules/:ruleId` (Line 4959) - Update rule ✅
- `DELETE /api/field-mapping/processing-rules/:ruleId` (Line 5003) - Delete rule ✅
- `POST /api/field-mapping/processing-rules/sync-to-db` (Line 5027) - Sync to DB ✅

**Status:** ✅ **ACTIVELY USED** - RULE_FETCH_ACCT_DOC, RULE_FETCH_PARTNER_BANK, RULE_FETCH_LOCKBOX_DATA
**Proposed Module:** `/app/backend/routes/fieldMapping/processingRuleRoutes.js`
**Service:** `/app/backend/services/fieldMapping/processingRuleService.js`
**Priority:** P1 (Critical - Core rule engine)
**Lines to Move:** ~229 lines (4856-5085)

---

### 9. FIELD MAPPING - API FIELDS (Lines 5085-5204)
**Routes: 4**
- `GET /api/field-mapping/api-fields` (Line 5085) - Get all API fields
- `POST /api/field-mapping/api-fields` (Line 5095) - Create API field
- `DELETE /api/field-mapping/api-fields/:fieldId` (Line 5141) - Delete API field
- `PUT /api/field-mapping/api-fields/:fieldId` (Line 5160) - Update API field

**Status:** ❌ **NOT USED** - FLD-001 to FLD-019 removed from UI
**Proposed Action:** Mark for deletion or keep for future use
**Priority:** P4 (Low - Can be deleted)
**Lines to Move:** ~119 lines (5085-5204)

---

### 10. FIELD MAPPING - CONSTANTS & ODATA (Lines 5204-5365)
**Routes: 6**
- `GET /api/field-mapping/constants` (Line 5204) - Get constants
- `GET /api/field-mapping/odata-services` (Line 5217) - Get OData services
- `POST /api/field-mapping/odata-services` (Line 5230) - Create OData service
- `PUT /api/field-mapping/odata-services/:serviceId` (Line 5275) - Update service
- `DELETE /api/field-mapping/odata-services/:serviceId` (Line 5309) - Delete service
- `PATCH /api/field-mapping/odata-services/:serviceId/toggle` (Line 5333) - Toggle active

**Proposed Module:** `/app/backend/routes/fieldMapping/odataRoutes.js`
**Service:** `/app/backend/services/fieldMapping/odataService.js`
**Priority:** P3 (Medium)
**Lines to Move:** ~161 lines (5204-5365)

---

### 11. PROCESSING RULES (DUPLICATE?) (Lines 5365-6044)
**Routes: 6**
- `POST /api/processing-rules/sync-to-db` (Line 5365) - Sync to DB
- `GET /api/lockbox/:runId/accounting-document` (Line 5428) - Get accounting document
- `GET /api/processing-rules` (Line 5791) - Get all rules
- `GET /api/processing-rules/:ruleId` (Line 5826) - Get single rule
- `POST /api/processing-rules` (Line 5864) - Create rule
- `PUT /api/processing-rules/:ruleId` (Line 5957) - Update rule
- `DELETE /api/processing-rules/:ruleId` (Line 5987) - Delete rule

**Note:** This appears to be a DUPLICATE of section 8 (different base path)
**Proposed Action:** Consolidate with section 8 or clarify purpose
**Priority:** P1 (Need to deduplicate)
**Lines to Move:** ~679 lines (5365-6044)

---

### 12. FIELD MAPPING - REFERENCE DOC RULES (Lines 6044-6176)
**Routes: 7**
- `GET /api/field-mapping/reference-doc-rules` (Line 6044) - Get all ref doc rules
- `GET /api/field-mapping/reference-doc-rules/:ruleId` (Line 6053) - Get single rule
- `POST /api/field-mapping/reference-doc-rules` (Line 6062) - Create rule
- `PUT /api/field-mapping/reference-doc-rules/:ruleId` (Line 6096) - Update rule
- `DELETE /api/field-mapping/reference-doc-rules/:ruleId` (Line 6124) - Delete rule
- `POST /api/field-mapping/reference-doc-rules/:ruleId/select` (Line 6148) - Select rule
- `PATCH /api/field-mapping/reference-doc-rules/:ruleId/toggle` (Line 6176) - Toggle active

**Proposed Module:** `/app/backend/routes/fieldMapping/referenceDocRuleRoutes.js`
**Service:** `/app/backend/services/fieldMapping/referenceDocRuleService.js`
**Priority:** P3 (Medium)
**Lines to Move:** ~132 lines (6044-6176)

---

### 13. LOCKBOX MAIN PROCESSING (Lines 8122-8703)
**Routes: 1 (MASSIVE)**
- `POST /api/lockbox/process` (Line 8122) - Main file processing endpoint

**Description:** This is a HUGE endpoint (~581 lines) that handles:
- File upload
- Validation
- Rule execution
- Enrichment
- Preview generation

**Proposed Module:** `/app/backend/routes/lockboxProcessingRoutes.js`
**Service:** `/app/backend/services/lockboxProcessingService.js`
**Priority:** P1 (CRITICAL - This needs to be broken down into smaller functions)
**Lines to Move:** ~581 lines (8122-8703)
**Refactoring Needed:** Break into multiple service methods

---

### 14. LOCKBOX RUN MANAGEMENT (Lines 8703-9363)
**Routes: 9**
- `GET /api/lockbox/runs` (Line 8703) - Get all runs
- `GET /api/jobs` (Line 8714) - Get jobs
- `GET /api/lockbox/runs/:runId` (Line 8738) - Get single run
- `DELETE /api/lockbox/runs/:runId` (Line 8746) - Delete run
- `GET /api/lockbox/runs/:runId/production-result` (Line 8782) - Get production result
- `GET /api/lockbox/runs/:runId/hierarchy` (Line 8884) - Get hierarchy
- `GET /api/lockbox/runs/:runId/download` (Line 8891) - Download data
- `POST /api/lockbox/runs/:runId/reprocess` (Line 8916) - Reprocess
- `POST /api/lockbox/runs/:runId/simulate` (Line 8934) - Simulate
- `POST /api/lockbox/runs/:runId/repost` (Line 9282) - Repost
- `POST /api/lockbox/runs/:runId/production` (Line 9363) - Production run

**Proposed Module:** `/app/backend/routes/runRoutes.js` (Already exists)
**Service:** `/app/backend/services/runService.js` (Already exists)
**Priority:** P1 (Critical - Move to existing module)
**Lines to Move:** ~660 lines (8703-9363)

---

### 15. SAP INTEGRATION (Lines 8803-8884)
**Routes: 3**
- `GET /api/sap/service-document` (Line 8803) - Get SAP service document
- `GET /api/sap/metadata` (Line 8824) - Get SAP metadata
- `GET /api/sap/diagnostics` (Line 8845) - SAP diagnostics

**Proposed Module:** `/app/backend/routes/sapRoutes.js`
**Service:** `/app/backend/services/sapService.js`
**Note:** Most SAP logic is in `/app/backend/srv/integrations/sap-client.js`
**Priority:** P2 (Medium - Diagnostics/utility routes)
**Lines to Move:** ~81 lines (8803-8884)

---

### 16. BATCH TEMPLATES (Lines 10086-10109)
**Routes: 3**
- `GET /api/batch-templates` (Line 10086) - Get all templates
- `GET /api/batch-templates/:templateId` (Line 10091) - Get single template
- `DELETE /api/batch-templates/:templateId` (Line 10098) - Delete template

**Proposed Module:** `/app/backend/routes/batchTemplateRoutes.js`
**Service:** `/app/backend/services/batchTemplateService.js`
**Priority:** P3 (Low)
**Lines to Move:** ~23 lines (10086-10109)

---

### 17. FALLBACK ROUTE (Lines 10109-10169)
**Routes: 1**
- `GET *` (Line 10109) - Catch-all for frontend routing

**Action:** Keep in server.js (must be last route)
**Priority:** N/A

---

## Proposed Directory Structure

```
/app/backend/
├── server.js (Reduced to ~500 lines - routing only)
├── routes/
│   ├── healthRoutes.js (NEW)
│   ├── lockboxRoutes.js (NEW)
│   ├── runRoutes.js (EXISTS - expand)
│   ├── sapRoutes.js (NEW)
│   ├── batchTemplateRoutes.js (NEW)
│   └── fieldMapping/
│       ├── templateRoutes.js (NEW)
│       ├── patternRoutes.js (NEW)
│       ├── ruleRoutes.js (NEW)
│       ├── processingRuleRoutes.js (NEW) ✅ CRITICAL
│       ├── apiFieldRoutes.js (NEW - can delete)
│       ├── odataRoutes.js (NEW)
│       └── referenceDocRuleRoutes.js (NEW)
├── services/
│   ├── healthService.js (NEW)
│   ├── lockboxService.js (NEW)
│   ├── lockboxProcessingService.js (NEW) ✅ CRITICAL
│   ├── runService.js (EXISTS - expand)
│   ├── sapService.js (NEW)
│   ├── batchTemplateService.js (NEW)
│   └── fieldMapping/
│       ├── templateService.js (NEW)
│       ├── patternService.js (NEW)
│       ├── ruleService.js (NEW)
│       ├── processingRuleService.js (NEW) ✅ CRITICAL
│       ├── apiFieldService.js (NEW - can delete)
│       ├── odataService.js (NEW)
│       └── referenceDocRuleService.js (NEW)
└── srv/
    ├── handlers/
    │   └── rule-engine.js (EXISTS) ✅ KEEP
    └── integrations/
        └── sap-client.js (EXISTS) ✅ KEEP
```

---

## Priority Breakdown

### P1 - CRITICAL (Do First)
1. **Lockbox Main Processing** (Lines 8122-8703) - 581 lines
   - Most complex endpoint
   - Needs to be broken down into smaller functions

2. **Processing Rules Management** (Lines 4856-5085, 5365-6044) - 908 lines
   - Core rule engine CRUD operations
   - RULE_FETCH_ACCT_DOC, RULE_FETCH_PARTNER_BANK, RULE_FETCH_LOCKBOX_DATA
   - Deduplicate the two sections

3. **Run Management** (Lines 8703-9363) - 660 lines
   - Simulate, Production, Reprocess operations
   - Move to existing runRoutes.js

4. **Lockbox Data Management** (Lines 467-879) - 412 lines
   - Upload, hierarchy, headers

**Total P1 Lines:** ~2,561 lines

---

### P2 - HIGH (Do Second)
1. **Field Mapping - Patterns** (Lines 4365-4746) - 381 lines
2. **Field Mapping - Templates** (Lines 4311-4365) - 54 lines
3. **Field Mapping - Rules** (Lines 4746-4856) - 110 lines
4. **SAP Integration** (Lines 8803-8884) - 81 lines
5. **Lockbox Processing** (Lines 1876-2942) - 1,066 lines

**Total P2 Lines:** ~1,692 lines

---

### P3 - MEDIUM (Do Third)
1. **Field Mapping - Constants & OData** (Lines 5204-5365) - 161 lines
2. **Field Mapping - Reference Doc Rules** (Lines 6044-6176) - 132 lines
3. **Batch Templates** (Lines 10086-10109) - 23 lines
4. **Health Routes** (Lines 93-433) - 340 lines

**Total P3 Lines:** ~656 lines

---

### P4 - LOW (Optional)
1. **API Fields** (Lines 5085-5204) - 119 lines
   - Can be deleted (not used)

**Total P4 Lines:** ~119 lines

---

## Refactoring Steps

### Phase 1: Setup (1 day)
1. Create directory structure
2. Create base route and service templates
3. Setup testing framework

### Phase 2: Critical Modules (3-4 days)
1. **Day 1:** Lockbox Main Processing
   - Extract /api/lockbox/process endpoint
   - Break into smaller service methods
   - Test thoroughly

2. **Day 2:** Processing Rules
   - Extract processing rule CRUD
   - Deduplicate duplicate endpoints
   - Test rule engine integration

3. **Day 3:** Run Management
   - Move to existing runRoutes.js
   - Consolidate simulate/production logic
   - Test end-to-end flow

4. **Day 4:** Lockbox Data Management
   - Extract upload, hierarchy, headers
   - Test file upload flow

### Phase 3: High Priority (2-3 days)
1. Field Mapping modules (patterns, templates, rules)
2. SAP integration routes
3. Lockbox processing routes

### Phase 4: Medium Priority (1-2 days)
1. Reference doc rules
2. OData services
3. Health and batch templates

### Phase 5: Cleanup (1 day)
1. Remove API Fields (not used)
2. Clean up duplicates
3. Final testing
4. Update documentation

---

## Expected Outcome

**Current:**
- server.js: 10,169 lines (unmaintainable)

**After Refactoring:**
- server.js: ~500 lines (routing only)
- 20+ route files: ~3,000 lines total
- 20+ service files: ~6,000 lines total
- Existing modules: ~1,000 lines (rule-engine, sap-client)

**Benefits:**
- ✅ Maintainable code structure
- ✅ Easier to test individual modules
- ✅ Better separation of concerns
- ✅ Faster onboarding for new developers
- ✅ Easier to add new features
- ✅ Better error handling and logging

---

## Testing Strategy

1. **Before Refactoring:** Create comprehensive test suite for all endpoints
2. **During Refactoring:** Test each module as it's extracted
3. **After Refactoring:** Run full regression test suite
4. **Production:** Deploy with feature flags, gradual rollout

---

## Risk Mitigation

1. **Backup:** Create git branch before starting
2. **Incremental:** Move one module at a time
3. **Testing:** Test after each module extraction
4. **Rollback:** Keep old code commented out until verified
5. **Documentation:** Document each module's purpose and dependencies

---

## Next Steps

1. **Get User Approval:** Confirm priorities and approach
2. **Start with P1 - Critical:** Begin with Lockbox Main Processing
3. **Test Each Module:** Comprehensive testing after each extraction
4. **Deploy Incrementally:** Deploy one module at a time

---

**Total Lines to Modularize:** ~10,000 lines → ~20 modules
**Estimated Time:** 7-10 days (with testing)
**Risk:** Medium (comprehensive testing required)
**Benefit:** High (maintainable, scalable codebase)
