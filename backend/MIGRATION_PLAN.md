# 🔄 Code Restructuring Migration Plan

## Status: 🟡 Phase 1 Complete (Infrastructure Ready)

---

## ✅ Phase 1: Infrastructure Setup (COMPLETE)

### Created:
- ✅ `/srv/utils/logger.js` - Logging utility
- ✅ `/srv/utils/file-utils.js` - File operations
- ✅ `/srv/utils/date-utils.js` - Date operations
- ✅ `/srv/models/data-models.js` - Data loading (patterns, rules, API fields)
- ✅ `/CODE_STRUCTURE.md` - Documentation on where to add code
- ✅ `/MIGRATION_PLAN.md` - This file

### Documentation:
- ✅ Clear guidelines on where to add new code
- ✅ Warnings in server.js not to add business logic
- ✅ Module structure established

---

## 🔄 Phase 2: Extract Core Business Logic (IN PROGRESS)

### Modules to Create:

#### 1. **Pattern Detection Module** (Priority: High)
**File**: `/srv/handlers/parser.js`

**Extract from server.js**:
- `detectFilePattern()` function
- `analyzeDataStructure()` function
- `matchColumnHeaders()` function
- `extractDataByPattern()` function

**Lines**: ~5111-5800 in server.js

**Status**: 🟡 TODO

---

#### 2. **Rule Execution Engine** (Priority: High)
**File**: `/srv/handlers/rule-engine.js`

**Extract from server.js**:
- `checkRuleCondition()` function
- `executeApiMapping()` function
- Rule validation logic
- Dynamic rule execution from Phase 3

**Lines**: ~5200-5300, ~6694-6800 in server.js

**Status**: 🟡 TODO

---

#### 3. **File Upload Handler** (Priority: High)
**File**: `/srv/handlers/upload.js`

**Extract from server.js**:
- `/api/lockbox/upload` endpoint
- `/api/lockbox/process` endpoint
- File parsing logic (Excel, CSV, JSON, XML, BAI2)
- Multer configuration

**Lines**: ~542-600, ~6440-7500 in server.js

**Status**: 🟡 TODO

---

#### 4. **SAP Posting Module** (Priority: High)
**File**: `/srv/handlers/sap-posting.js`

**Extract from server.js**:
- SAP payload building
- Simulation logic
- Production posting
- Document retrieval
- Clearing logic

**Lines**: ~7500-8500 in server.js

**Status**: 🟡 TODO

---

#### 5. **API Routes Module** (Priority: Medium)
**File**: `/srv/services/routes.js`

**Extract from server.js**:
- All Express route definitions
- Middleware setup
- CORS configuration
- Error handling middleware

**Status**: 🟡 TODO

---

#### 6. **SAP Integration Client** (Priority: Medium)
**File**: `/srv/integrations/sap-client.js`

**Extract from server.js**:
- SAP Cloud SDK setup
- Destination configuration
- API call wrappers
- Error handling for SAP calls

**Status**: 🟡 TODO

---

## 📦 Phase 3: API Endpoints Migration

### Field Mapping Rules Endpoints:
- ✅ Data models ready (`srv/models/data-models.js`)
- 🟡 Routes to migrate:
  - `GET /api/field-mapping/patterns`
  - `POST /api/field-mapping/patterns`
  - `PUT /api/field-mapping/patterns/:id`
  - `DELETE /api/field-mapping/patterns/:id`
  - `GET /api/processing-rules`
  - `POST /api/processing-rules`
  - `PUT /api/processing-rules/:id`
  - `DELETE /api/processing-rules/:id`

**Target**: `/srv/services/field-mapping-routes.js`

**Status**: 🟡 TODO

---

### Lockbox Transaction Endpoints:
- 🟡 Routes to migrate:
  - `POST /api/lockbox/upload`
  - `POST /api/lockbox/process`
  - `GET /api/lockbox/runs`
  - `GET /api/lockbox/runs/:id`
  - `POST /api/lockbox/simulate`
  - `POST /api/lockbox/post`

**Target**: `/srv/services/lockbox-routes.js`

**Status**: 🟡 TODO

---

## 🧪 Phase 4: Testing & Validation

- 🟡 Create test files for each module
- 🟡 Ensure all existing functionality works
- 🟡 Performance testing
- 🟡 Integration testing

**Status**: 🟡 TODO

---

## 🚀 Phase 5: Final Cutover

### Steps:
1. Rename `server.js` → `server.js.OLD` (backup)
2. Create new minimal `server.js` (bootstrap only)
3. Test all endpoints
4. Monitor logs for errors
5. Archive old server.js.OLD

**Status**: 🔴 TODO

---

## 📊 Progress Tracking

```
Phase 1: Infrastructure    ████████████████████ 100%
Phase 2: Core Logic        ████░░░░░░░░░░░░░░░░  20%
Phase 3: API Endpoints     ░░░░░░░░░░░░░░░░░░░░   0%
Phase 4: Testing           ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5: Cutover           ░░░░░░░░░░░░░░░░░░░░   0%

Overall Progress:          ████░░░░░░░░░░░░░░░░  24%
```

---

## 🎯 Next Steps

### Immediate (This Session):
1. ✅ Create utility modules
2. ✅ Create data models module
3. ✅ Create documentation (CODE_STRUCTURE.md)
4. 🔄 Extract pattern detection logic
5. 🔄 Extract rule execution logic

### Near Term (Next Session):
1. Extract file upload handler
2. Extract SAP posting module
3. Create API routes module
4. Test extracted modules

### Long Term:
1. Complete migration of all endpoints
2. Create test suite
3. Archive old server.js
4. Deploy new structure

---

## ⚠️ Important Notes

### During Migration:
- **Old server.js remains functional** - No disruption to current features
- **Gradual migration** - One module at a time
- **Test after each migration** - Ensure nothing breaks
- **Keep backup** - server.js.OLD as safety net

### After Migration:
- **server.js will be < 100 lines** - Just bootstrapping
- **All business logic in srv/** - Easy to find and modify
- **No more monolithic file** - Clean, maintainable code
- **Easy to extend** - Add new features in proper modules

---

## 📝 Key Benefits

### Before Restructuring:
- ❌ server.js: 8933 lines
- ❌ Hard to find code
- ❌ Risky to make changes
- ❌ Everything coupled together

### After Restructuring:
- ✅ server.js: ~100 lines (bootstrap only)
- ✅ Easy to find code (clear module structure)
- ✅ Safe to make changes (isolated modules)
- ✅ Clean separation of concerns

---

## 🎊 Success Criteria

✅ **Complete** when:
1. server.js < 100 lines
2. All business logic in srv/ modules
3. All tests passing
4. Documentation complete
5. No functionality lost
6. Performance maintained or improved

---

## 📧 Questions or Issues?

Refer to:
- `CODE_STRUCTURE.md` - Where to add new code
- `MIGRATION_PLAN.md` - Current progress (this file)
- Module JSDoc comments - Detailed function documentation

---

**Last Updated**: February 18, 2026  
**Status**: Phase 1 Complete, Phase 2 In Progress
