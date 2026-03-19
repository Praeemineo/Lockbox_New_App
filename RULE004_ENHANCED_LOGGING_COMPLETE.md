# RULE-004 Enhanced Logging and Dialog Field Mapping - Complete

## Enhanced Logging Format

### What You'll Now See in BTP Logs:

```
================================================================================
📋 RULE-004 SAP RESPONSE VALUES:
================================================================================
🔍 LockboxId used in query: 1000179

📥 Full SAP Response:
{
  "value": [
    {
      "LockBoxId": "1000179",
      "SendingBank": "SAMPLEDEST 1234567890",
      "BankStatement": "60",
      "StatementId": "1000179 260318 0000",
      "CompanyCode": "0001",
      "HeaderStatus": "Processed",
      "BankStatementItem": "1",
      "DocumentNumber": "5100000123",
      "PaymentAdvice": "01000000600002",
      "SubledgerDocument": "SD001",
      "SubledgerOnaccountDocument": "SA001",
      "Amount": 900.00,
      "TransactionCurrency": "USD",
      "DocumentStatus": "Posted"
    }
  ]
}

📊 Documents Summary with Field Labels:

   ========== Document 1 ==========
   🏦 LockBoxId: 1000179
   🏢 Sending Bank Field: SAMPLEDEST 1234567890
   📄 Bank Statement: 60
   🔖 Statement ID: 1000179 260318 0000
   🏛️  Company Code: 0001
   ✅ Header Status: Processed
   📌 Bank Statement Item: 1
   📝 Document Number: 5100000123
   💳 Payment Advice: 01000000600002
   📊 Subledger Document: SD001
   📋 Subledger on-account: SA001
   💰 Amount: 900
   💱 Transaction Currency: USD
   📈 Document Status: Posted
   ==============================

   ========== Document 2 ==========
   🏦 LockBoxId: 1000179
   🏢 Sending Bank Field: SAMPLEDEST 1234567890
   📄 Bank Statement: 60
   🔖 Statement ID: 1000179 260318 0000
   🏛️  Company Code: 0001
   ✅ Header Status: Processed
   📌 Bank Statement Item: 2
   📝 Document Number: 5100000124
   💳 Payment Advice: 01000000600003
   📊 Subledger Document: SD002
   📋 Subledger on-account: 
   💰 Amount: 1200
   💱 Transaction Currency: USD
   📈 Document Status: Posted
   ==============================

================================================================================
```

---

## Navigation Dialog Field Mapping

### Current Dialog Structure:

**Header Data Tab (displays ONCE per lockbox):**
```
┌─────────────────────────────────────────┐
│ [Header Data] [Item Data]              │
├─────────────────────────────────────────┤
│                                         │
│  🏦 Lockbox ID:                         │
│     1000179                             │
│                                         │
│  🏢 Sending Bank:                       │
│     SAMPLEDEST 1234567890              │
│                                         │
│  📄 Bank Statement:                     │
│     60                                  │
│                                         │
│  🔖 Statement ID:                       │
│     1000179 260318 0000                │
│                                         │
│  🏛️  Company Code:                      │
│     0001                                │
│                                         │
│  ✅ Header Status:                      │
│     Processed                           │
│                                         │
└─────────────────────────────────────────┘
```

**Item Data Tab (one row per document):**
```
┌───────────────────────────────────────────────────────────┐
│ [Header Data] [Item Data]                                │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Table with columns:                                      │
│  ┌────┬─────────┬─────────┬─────────┬────────┬────────┐ │
│  │Item│BankStmt │Document │Payment  │Subledger│Amount  │ │
│  │    │Item     │Number   │Advice   │Document │        │ │
│  ├────┼─────────┼─────────┼─────────┼────────┼────────┤ │
│  │ 1  │ 1       │5100..123│0100..02 │SD001    │900 USD │ │
│  │ 2  │ 2       │5100..124│0100..03 │SD002    │1200 USD│ │
│  └────┴─────────┴─────────┴─────────┴────────┴────────┘ │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## Complete Field Mapping (SAP → Dialog):

### Header Data Fields (from first document):
| SAP Field | Dialog Label | Display Location |
|-----------|-------------|------------------|
| LockBoxId | Lockbox ID | Header Data tab |
| SendingBank | Sending Bank | Header Data tab |
| BankStatement | Bank Statement | Header Data tab |
| StatementId | Statement ID | Header Data tab |
| CompanyCode | Company Code | Header Data tab |
| HeaderStatus | Header Status | Header Data tab |

### Item Data Fields (one row per document):
| SAP Field | Dialog Column | Notes |
|-----------|--------------|-------|
| BankStatementItem | Bank Statement Item | First column |
| DocumentNumber | Document Number | Second column |
| PaymentAdvice | Payment Advice | Third column |
| SubledgerDocument | Subledger Document | Fourth column |
| SubledgerOnaccountDocument | Subledger On-account | Fifth column |
| Amount | Amount | Sixth column (with currency) |
| TransactionCurrency | (shown with Amount) | e.g., "900.00 USD" |
| DocumentStatus | Document Status | Last column (with color) |

---

## Data Flow (SAP → BTP → UI):

```
1. SAP Returns RULE-004 Data:
{
  "LockBoxId": "1000179",
  "SendingBank": "SAMPLEDEST 1234567890",
  "BankStatement": "60",
  "StatementId": "1000179 260318 0000",
  "CompanyCode": "0001",
  "HeaderStatus": "Processed",
  "BankStatementItem": "1",
  "DocumentNumber": "5100000123",
  "PaymentAdvice": "01000000600002",
  "SubledgerDocument": "SD001",
  "SubledgerOnaccountDocument": "SA001",
  "Amount": 900.00,
  "TransactionCurrency": "USD",
  "DocumentStatus": "Posted"
}

2. BTP Logs Each Field with Label:
   🏦 LockBoxId: 1000179
   🏢 Sending Bank Field: SAMPLEDEST 1234567890
   📄 Bank Statement: 60
   🔖 Statement ID: 1000179 260318 0000
   🏛️  Company Code: 0001
   ✅ Header Status: Processed
   📌 Bank Statement Item: 1
   📝 Document Number: 5100000123
   💳 Payment Advice: 01000000600002
   📊 Subledger Document: SD001
   📋 Subledger on-account: SA001
   💰 Amount: 900
   💱 Transaction Currency: USD
   📈 Document Status: Posted

3. Controller Maps to Dialog Fields:
   - Header: LockBoxId → txnLockboxId
   - Header: SendingBank → txnSendingBank
   - Header: BankStatement → txnBankStatement
   - Header: StatementId → txnStatementId
   - Header: CompanyCode → txnCompanyCode
   - Header: HeaderStatus → txnHeaderStatus
   - Table: BankStatementItem → bankStatementItem
   - Table: DocumentNumber → documentNumber
   - Table: PaymentAdvice → paymentAdvice
   - Table: SubledgerDocument → subledgerDocument
   - Table: SubledgerOnaccountDocument → subledgerOnAccount
   - Table: Amount + Currency → amount + currency
   - Table: DocumentStatus → documentStatus

4. UI Displays in Dialog:
   - Header Data tab shows 6 header fields
   - Item Data tab shows table with 8 columns per document
```

---

## Example Log Output for Multiple Documents:

```
================================================================================
📋 RULE-004 SAP RESPONSE VALUES:
================================================================================
🔍 LockboxId used in query: 1000179

📊 Documents Summary with Field Labels:

   ========== Document 1 ==========
   🏦 LockBoxId: 1000179
   🏢 Sending Bank Field: SAMPLEDEST 1234567890
   📄 Bank Statement: 60
   🔖 Statement ID: 1000179 260318 0000
   🏛️  Company Code: 0001
   ✅ Header Status: Processed
   📌 Bank Statement Item: 1
   📝 Document Number: 5100000123
   💳 Payment Advice: 01000000600002
   📊 Subledger Document: SD001
   📋 Subledger on-account: SA001
   💰 Amount: 900
   💱 Transaction Currency: USD
   📈 Document Status: Posted
   ==============================

   ========== Document 2 ==========
   🏦 LockBoxId: 1000179
   🏢 Sending Bank Field: SAMPLEDEST 1234567890
   📄 Bank Statement: 60
   🔖 Statement ID: 1000179 260318 0000
   🏛️  Company Code: 0001
   ✅ Header Status: Processed
   📌 Bank Statement Item: 2
   📝 Document Number: 5100000124
   💳 Payment Advice: 01000000600003
   📊 Subledger Document: SD002
   📋 Subledger on-account: SA002
   💰 Amount: 1200
   💱 Transaction Currency: USD
   📈 Document Status: Posted
   ==============================

   ========== Document 3 ==========
   🏦 LockBoxId: 1000179
   🏢 Sending Bank Field: SAMPLEDEST 1234567890
   📄 Bank Statement: 60
   🔖 Statement ID: 1000179 260318 0000
   🏛️  Company Code: 0001
   ✅ Header Status: Processed
   📌 Bank Statement Item: 3
   📝 Document Number: 5100000125
   💳 Payment Advice: 01000000600004
   📊 Subledger Document: SD003
   📋 Subledger on-account: 
   💰 Amount: 750
   💱 Transaction Currency: EUR
   📈 Document Status: Posting Error
   ==============================

================================================================================
```

---

## Summary:

✅ **Enhanced Logging:** Each field now has clear icon and label  
✅ **All 14 Fields Logged:** Every SAP field is shown with descriptive label  
✅ **Dialog Mapping:** Header fields in Header Data tab, item fields in Item Data table  
✅ **Ready for BTP:** Deploy and logs will show all values with labels  
✅ **Automatic Mapping:** Controller already maps RULE-004 data to all dialog fields  

**When you run the process in BTP, logs will clearly show each field value with its label as shown above!**
