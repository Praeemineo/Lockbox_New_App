#!/bin/bash
# Test RULE-004 API with LockboxID 1000170
# This script tests the RULE-004 endpoint locally (will fail without SAP connection)

echo "=========================================="
echo "Testing RULE-004 with LockboxID: 1000170"
echo "=========================================="

# Get backend URL from environment
BACKEND_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

if [ -z "$BACKEND_URL" ]; then
    BACKEND_URL="http://localhost:8001"
fi

echo "Backend URL: $BACKEND_URL"
echo ""

# First, we need a run ID with lockboxId 1000170
# For testing, let's try to fetch the accounting document directly

echo "Testing RULE-004 endpoint..."
echo "curl -X GET \"${BACKEND_URL}/api/lockbox/test-run-1000170/accounting-document\""
echo ""

# Note: This will fail because:
# 1. We need a valid run ID that exists in the runs array
# 2. The run must have lockboxId = 1000170
# 3. SAP connection must be available

echo "=========================================="
echo "Expected SAP API Call:"
echo "=========================================="
echo "GET /sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT"
echo "Query: \$filter=LockBoxId eq '1000170'"
echo "       \$select=LockBoxId,SendingBank,BankStatement,StatementId,CompanyCode,HeaderStatus,BankStatementItem,DocumentNumber,PaymentAdvice,SubledgerDocument,SubledgerOnaccountDocument,Amount,TransactionCurrency,DocumentStatus"
echo ""

echo "=========================================="
echo "Expected Response Format:"
echo "=========================================="
cat << 'EOF'
{
  "success": true,
  "lockboxId": "1000170",
  "documents": [
    {
      "item": "1",
      "LockBoxId": "1000170",
      "SendingBank": "...",
      "BankStatement": "...",
      "StatementId": "...",
      "CompanyCode": "...",
      "HeaderStatus": "...",
      "BankStatementItem": "...",
      "DocumentNumber": "...",
      "PaymentAdvice": "...",
      "SubledgerDocument": "...",
      "SubledgerOnaccountDocument": "...",
      "Amount": 0.00,
      "TransactionCurrency": "USD",
      "DocumentStatus": "..."
    }
  ],
  "count": 1
}
EOF

echo ""
echo "=========================================="
echo "To test in your BTP environment:"
echo "=========================================="
echo "1. Upload a file that creates a lockbox with ID 1000170"
echo "2. Complete RULE-003 production run (status = Posted)"
echo "3. Click 'Show Transaction Details' button"
echo "4. The Transaction Dialog will automatically call RULE-004"
echo "5. Check logs for: '📋 RULE-004: Fetching accounting document for run'"
echo ""
echo "Or test directly via API:"
echo "curl -X GET \"https://your-app.cfapps.eu10.hana.ondemand.com/api/lockbox/[RUN_ID]/accounting-document\""
echo ""
