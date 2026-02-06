# PDF OCR Implementation - Claude AI Integration

## Overview
Added intelligent document processing capability for PDF files using Claude AI (Anthropic) with fallback to OpenAI.

## Features Implemented

### 1. OCR Service (`/app/backend/services/ocr_service.py`)
- **Provider Support**: Claude AI (default) and OpenAI
- **Universal Key**: Uses Emergent LLM key for authentication
- **Intelligent Extraction**: Extracts structured payment data from PDFs
- **Validation**: Validates extracted data for completeness

### 2. Backend Integration (`/app/backend/server.js`)
- **PDF Detection**: Automatically detects PDF file uploads
- **OCR Processing**: Calls Python OCR service for extraction
- **Data Conversion**: Converts OCR results to standard lockbox format
- **Metadata Storage**: Stores OCR provider and model info

### 3. Workflow
```
PDF Upload → OCR Extraction (Claude AI) → Data Validation → Template Matching → Simulation → Posting
```

## Configuration

### Environment Variables
Added to `/app/backend/.env`:
```
EMERGENT_LLM_KEY=sk-emergent-9F6F730A94f5a71611
```

### Provider Selection
**Default**: Claude AI (Anthropic) - `claude-sonnet-4-20250514`
**Alternative**: OpenAI - Can be changed in `ocr_service.py`

To switch to OpenAI:
```python
service = OCRService(provider="openai", model="gpt-5.1")
```

## Extracted Data Structure

The OCR service extracts:
```json
{
  "rows": [
    {
      "CustomerName": "ABC Corp",
      "PaymentAmount": "1000.00",
      "PaymentDate": "2024-02-06",
      "PaymentReference": "INV-123",
      "InvoiceNumber": "INV-123",
      "BankAccount": "1234567890",
      "ClearingDocument": "DOC-456"
    }
  ],
  "metadata": {
    "totalAmount": "1000.00",
    "documentDate": "2024-02-06",
    "bankName": "Sample Bank"
  }
}
```

## Files Created/Modified

### New Files:
- `/app/backend/services/ocr_service.py` - OCR service using Claude AI

### Modified Files:
- `/app/backend/server.js` - Added PDF processing in upload endpoint (lines 5948-6012)
- `/app/backend/.env` - Added EMERGENT_LLM_KEY

## Testing

### Test OCR Service Directly:
```bash
cd /app/backend
python3 services/ocr_service.py /path/to/sample.pdf
```

### Test via API:
1. Upload a PDF file through the Lockbox Transaction UI
2. Click "Upload File" button
3. Select a PDF with payment data
4. System will automatically:
   - Detect PDF format
   - Run OCR extraction
   - Display extracted data
   - Allow simulation and posting

## Portability to BTP

The implementation uses `emergentintegrations` library which is portable:

1. **Same Code**: Works on both local and BTP
2. **Provider Switch**: Easy switch between Claude and OpenAI
3. **Universal Key**: Single key for both providers
4. **No Additional Config**: Just deploy and run

### BTP Deployment:
```yaml
# mta.yaml - No changes needed
# The EMERGENT_LLM_KEY in .env will work as-is
```

## Supported File Types

Now supports:
- ✅ XLSX, XLS (Excel)
- ✅ CSV, TSV (Comma/Tab separated)
- ✅ TXT, BAI, BAI2 (Text files)
- ✅ JSON (JSON data)
- ✅ XML (XML documents)
- ✅ **PDF (NEW - with OCR)**

## Cost & Credits

- Uses Emergent LLM universal key
- Credits deducted per OCR request
- User can top up balance or use own API key
- Claude Sonnet 4 pricing: ~$3 per 1M input tokens

## Next Steps

1. **Test with Sample PDFs**: Upload various PDF formats
2. **Monitor Extraction Quality**: Review OCR accuracy
3. **Adjust Prompts**: Fine-tune system message if needed
4. **Add File Type Icons**: Update UI to show PDF icon
5. **Error Handling**: Add retry logic for OCR failures
