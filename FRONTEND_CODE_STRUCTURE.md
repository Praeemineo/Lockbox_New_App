# Frontend Code Structure - Lockbox Processing Application

## Overview
The application uses **SAPUI5** framework for the frontend (NOT React/Angular/Vue). It follows a **dual-deployment architecture** with synchronized frontend folders.

---

## 🎯 Deployment Architecture

### Primary Frontend (Source of Truth)
**Path:** `/app/frontend/public/`
- **Purpose:** Kubernetes/local development deployment
- **Status:** ✅ Active - All UI changes should be made here first

### Secondary Frontend (BTP Deployment)
**Path:** `/app/backend/app/`
- **Purpose:** Cloud Foundry/BTP (Business Technology Platform) deployment
- **Status:** ✅ Synced automatically via `/app/backend/sync-frontend.sh`
- **Important:** This is a COPY of the primary frontend - DO NOT edit directly

---

## 📁 Complete Frontend File Structure

```
/app/frontend/
├── public/                          # Primary frontend folder (SOURCE OF TRUTH)
│   ├── index.html                   # Entry point with SAPUI5 bootstrap
│   ├── .cfignore                    # Cloud Foundry ignore file
│   └── webapp/                      # Main SAPUI5 application
│       ├── Component.js             # Root component (SAPUI5 lifecycle)
│       ├── init.js                  # Application initialization
│       ├── manifest.json            # App configuration & metadata
│       │
│       ├── controller/              # SAPUI5 Controllers (Business Logic)
│       │   ├── App.controller.js    # Root app controller
│       │   └── Main.controller.js   # Main view controller (PRIMARY LOGIC)
│       │
│       ├── view/                    # SAPUI5 XML Views (UI Structure)
│       │   ├── App.view.xml         # Root application view
│       │   ├── Main.view.xml        # Main lockbox management view ⭐ MAIN UI
│       │   ├── ProcessingRuleDialog.fragment.xml    # Rule management dialog
│       │   ├── ExcelFilePatterns.fragment.xml       # File pattern configuration
│       │   ├── ExcelPatternEdit.fragment.xml        # Pattern editor dialog
│       │   └── PatternDetailDialog.fragment.xml     # Pattern details view
│       │
│       ├── css/                     # Custom Styling
│       │   └── custom.css           # Application-specific CSS
│       │
│       └── i18n/                    # Internationalization
│           └── i18n.properties      # English language resources
│
├── src/                             # React remnants (NOT USED - Legacy)
│   ├── App.js                       # ❌ Not used (hidden via CSS in index.html)
│   ├── App.css
│   ├── index.js
│   └── index.css
│
├── package.json                     # Frontend dependencies
├── jsconfig.json                    # JavaScript configuration
├── craco.config.js                  # Create React App Configuration
├── tailwind.config.js               # Tailwind CSS config
└── postcss.config.js                # PostCSS config

/app/backend/app/                    # Secondary frontend (BTP deployment copy)
├── index.html                       # Synced from /app/frontend/public/
└── webapp/                          # Synced from /app/frontend/public/webapp/
    └── [Same structure as above]
```

---

## 🎨 Key Frontend Files (Detailed)

### 1. Entry Point
**File:** `/app/frontend/public/index.html`
- Bootstraps SAPUI5 from CDN (`https://ui5.sap.com/resources/sap-ui-core.js`)
- Sets theme: `sap_fiori_3`
- Loads required SAPUI5 libraries: `sap.m`, `sap.ui.table`, `sap.ui.layout`
- Cache-busting parameter: `?v=20260321b` (line 20)
- **Important:** Has React `#root` div hidden via CSS (line 43-45)

### 2. Main UI Controller ⭐ PRIMARY BUSINESS LOGIC
**File:** `/app/frontend/public/webapp/controller/Main.controller.js`
- Handles all user interactions
- API calls to backend endpoints
- File upload processing
- Production run simulation
- Lockbox transaction display
- Processing rule management
- Excel pattern configuration

### 3. Main View ⭐ PRIMARY UI LAYOUT
**File:** `/app/frontend/public/webapp/view/Main.view.xml`
- Main lockbox transaction table (with sticky navigation arrow)
- Upload file interface
- Action buttons (Simulate, Production Run)
- Transaction details dialog
- Status displays
- **Recent Changes:**
  - Fixed sticky column (`fixedColumnCount="1"`)
  - Removed "View Payload" and "Log" buttons
  - Removed "API Field & Logic" tab

### 4. Dialogs/Fragments
**Files in:** `/app/frontend/public/webapp/view/`

#### `ProcessingRuleDialog.fragment.xml`
- Rule creation and editing
- Condition builder
- Field mapping configuration
- API endpoint configuration

#### `ExcelFilePatterns.fragment.xml`
- File pattern management
- Template configuration
- Pattern matching rules

#### `ExcelPatternEdit.fragment.xml`
- Pattern editor interface
- Column mapping
- Validation rules

#### `PatternDetailDialog.fragment.xml`
- Detailed pattern view
- Test pattern matching
- Preview data

### 5. Application Configuration
**File:** `/app/frontend/public/webapp/manifest.json`
- App metadata (name, version, description)
- Routing configuration
- Data source definitions
- SAPUI5 model bindings

### 6. Styling
**File:** `/app/frontend/public/webapp/css/custom.css`
- Custom CSS overrides for SAPUI5 components
- Application-specific styling
- Responsive design adjustments

### 7. Initialization
**File:** `/app/frontend/public/webapp/init.js`
- Bootstrap sequence
- Component initialization
- Global settings

---

## 🔄 Frontend Synchronization

### Sync Script
**File:** `/app/backend/sync-frontend.sh`

**Purpose:** Keeps BTP deployment folder in sync with primary frontend

**Usage:**
```bash
cd /app/backend
./sync-frontend.sh
```

**What it does:**
- Uses `rsync` to copy from `/app/frontend/public/` → `/app/backend/app/`
- Preserves timestamps and permissions
- Deletes files in destination that don't exist in source

**⚠️ CRITICAL RULE:** After ANY UI changes in `/app/frontend/public/`, you MUST run this script!

---

## 🔌 Backend Integration Points

### API Base URL
Set in `/app/frontend/public/index.html` (line 13):
```javascript
window.REACT_APP_BACKEND_URL = "";  // Empty = same origin
```

### Key API Endpoints Called by Frontend
From `Main.controller.js`:
- `GET /api/lockbox/headers` - Fetch all lockbox headers
- `POST /api/lockbox/upload` - Upload Excel file
- `GET /api/lockbox/runs` - Get processing runs
- `POST /api/lockbox/runs/:runId/simulate` - Simulate production run
- `GET /api/lockbox/hierarchy/:headerId` - Get transaction hierarchy
- `GET /api/field-mapping/processing-rules` - Get processing rules
- `POST /api/field-mapping/processing-rules` - Create/update rules
- `GET /api/file-patterns` - Get file patterns
- `POST /api/file-patterns` - Save file patterns

---

## 🎯 UI Features & Functionality

### Lockbox Transaction Management
- **File:** `Main.view.xml` + `Main.controller.js`
- Upload Excel files
- View transaction hierarchy (Lockbox → Check → Payment)
- Display enriched data from processing rules
- Sticky navigation arrow column for easy browsing

### Processing Rule Engine
- **File:** `ProcessingRuleDialog.fragment.xml`
- Create/edit validation and enrichment rules
- Configure SAP API calls
- Define field mappings
- Set execution order

### Excel Pattern Configuration
- **File:** `ExcelFilePatterns.fragment.xml`
- Define file patterns for auto-detection
- Map Excel columns to system fields
- Create reusable templates

### Production Run Interface
- **File:** `Main.view.xml` (transaction details section)
- Simulate lockbox posting
- Execute production runs
- View SAP response documents
- Track clearing entries

---

## 🚫 Deprecated/Unused Code

### React Components (Lines in `/app/frontend/src/`)
**Status:** ❌ NOT USED
- Hidden via CSS in `index.html` (line 43-45)
- Remnants from initial project setup
- Can be safely ignored

### API Field & Logic (FLD-001 to FLD-019)
**Status:** ❌ REMOVED from UI
- Deprecated concept
- UI elements removed in recent cleanup
- Only rule-based logic is used now

---

## 📝 Development Guidelines

### Making UI Changes
1. **Edit in PRIMARY folder:** `/app/frontend/public/webapp/`
2. **Test changes** in development/preview
3. **Run sync script:** `/app/backend/sync-frontend.sh`
4. **Restart backend** (only if needed): `sudo supervisorctl restart backend`
5. **Clear browser cache:** Hard refresh (Ctrl+Shift+R)

### Cache-Busting Strategy
Update version parameter in `index.html` after major UI changes:
```html
<!-- Line 20 -->
data-sap-ui-resourceroots='{"lockbox": "./webapp?v=20260321b"}'
                                                    ↑ Update this
```

### Adding New Views
1. Create XML view in `/app/frontend/public/webapp/view/`
2. Create corresponding controller in `/app/frontend/public/webapp/controller/`
3. Update routing in `manifest.json` if needed
4. Run sync script

### Adding New Fragments/Dialogs
1. Create `.fragment.xml` in `/app/frontend/public/webapp/view/`
2. Load fragment in controller using `Fragment.load()`
3. Run sync script

---

## 🔧 Technology Stack

- **Framework:** SAPUI5 (OpenUI5)
- **UI Library:** SAP Fiori 3 theme
- **Language:** JavaScript (ES6+)
- **View Layer:** XML Views
- **Data Binding:** SAPUI5 models (JSON, OData)
- **Styling:** Custom CSS + SAPUI5 themes

---

## 📦 Dependencies

**File:** `/app/frontend/package.json`

Key frontend dependencies:
- SAPUI5 (loaded from CDN, not npm)
- React (legacy, not used)
- Webpack build tools
- Tailwind CSS (not actively used)

---

## 🎨 UI Components Used

### SAPUI5 Controls
- `sap.m.Table` - Lockbox transaction table
- `sap.ui.table.Table` - Data grids with sticky columns
- `sap.m.Dialog` - Modal dialogs
- `sap.m.Button` - Action buttons
- `sap.m.Input` - Form inputs
- `sap.m.Select` - Dropdowns
- `sap.m.MessageBox` - Alerts and confirmations
- `sap.m.IconTabBar` - Tab navigation
- `sap.ui.layout.form.SimpleForm` - Form layouts

---

## 🔍 Finding Specific UI Elements

### Lockbox Transaction Table
**Location:** `/app/frontend/public/webapp/view/Main.view.xml`
**Search for:** `<Table id="lockboxTable"`

### Upload Button
**Location:** `/app/frontend/public/webapp/view/Main.view.xml`
**Search for:** `<FileUploader id="fileUploader"`

### Processing Rules Management
**Location:** `/app/frontend/public/webapp/view/ProcessingRuleDialog.fragment.xml`
**Triggered from:** `Main.controller.js` → `onManageRules()`

### Transaction Details Dialog
**Location:** `/app/frontend/public/webapp/view/Main.view.xml`
**Search for:** `<Dialog id="transactionDetailDialog"`

---

## 📊 Data Flow

```
User Action (Main.view.xml)
    ↓
Event Handler (Main.controller.js)
    ↓
API Call to Backend
    ↓
Backend Processing (server.js)
    ↓
PostgreSQL Database / SAP S/4HANA
    ↓
Response to Frontend
    ↓
Update SAPUI5 Model
    ↓
UI Auto-Updates (Data Binding)
```

---

## 🐛 Common Issues & Solutions

### Issue: UI changes not visible
**Solution:** 
1. Hard refresh (Ctrl+Shift+R)
2. Test in Incognito mode
3. Update cache-busting version in `index.html`

### Issue: BTP deployment shows old UI
**Solution:** Run `/app/backend/sync-frontend.sh`

### Issue: Table not displaying correctly
**Solution:** Check SAPUI5 console for binding errors

---

## 📌 Important Notes

1. **NO React components are used** - Despite having React files, the app is 100% SAPUI5
2. **Always sync after UI changes** - BTP deployment needs manual sync
3. **Cache-busting is critical** - Users experience aggressive browser caching
4. **Sticky column fix** - Only the navigation arrow column should be sticky (`fixedColumnCount="1"`)
5. **No FLD-XXX logic** - The API Field & Logic concept is deprecated

---

## 📞 Related Documentation

- `/app/SERVER_MODULARIZATION_PLAN.md` - Backend refactoring plan
- `/app/CUSTOMER_PROPERTY_FIX.md` - Recent SAP API fix
- `/app/backend/sync-frontend.sh` - Frontend sync script

---

**Last Updated:** March 31, 2025
**Frontend Framework:** SAPUI5 (Fiori 3)
**Primary Path:** `/app/frontend/public/webapp/`
