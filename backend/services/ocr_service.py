"""
OCR Service for PDF Document Processing using LLM
Supports both Claude AI and OpenAI for intelligent document extraction
"""
import os
import json
import asyncio
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

# Load environment variables
load_dotenv()

class OCRService:
    """Service for extracting structured data from PDF files using LLM"""
    
    def __init__(self, provider="anthropic", model="claude-sonnet-4-20250514"):
        """
        Initialize OCR Service
        
        Args:
            provider: LLM provider ("anthropic" for Claude, "openai" for OpenAI)
            model: Model name (defaults to Claude Sonnet 4)
        """
        self.provider = provider
        self.model = model
        self.api_key = os.getenv('EMERGENT_LLM_KEY')
        
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment variables")
    
    async def extract_lockbox_data(self, pdf_path):
        """
        Extract lockbox payment data from PDF file
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            dict: Extracted data with structure matching lockbox format
        """
        # System message for lockbox data extraction
        system_message = """You are an expert at extracting structured payment data from lockbox documents.
Extract the following information from the document:
1. Customer payments (customer name, amount, payment date, reference number)
2. Invoice/reference details
3. Bank information
4. Any clearing/matching information

Return the data as a JSON object with this structure:
{
    "rows": [
        {
            "CustomerName": "...",
            "PaymentAmount": "...",
            "PaymentDate": "...",
            "PaymentReference": "...",
            "InvoiceNumber": "...",
            "BankAccount": "...",
            "ClearingDocument": "..."
        }
    ],
    "metadata": {
        "totalAmount": "...",
        "documentDate": "...",
        "bankName": "..."
    }
}

Important:
- Extract ALL payment records found in the document
- Convert dates to YYYY-MM-DD format
- Ensure numeric values are clean (no currency symbols)
- If a field is not found, use empty string
"""
        
        # Initialize chat
        chat = LlmChat(
            api_key=self.api_key,
            session_id=f"ocr_{os.path.basename(pdf_path)}",
            system_message=system_message
        ).with_model(self.provider, self.model)
        
        # Create file attachment
        pdf_file = FileContentWithMimeType(
            file_path=pdf_path,
            mime_type="application/pdf"
        )
        
        # Create message with PDF attachment
        user_message = UserMessage(
            text="Please extract all payment data from this PDF document and return it in the specified JSON format.",
            file_contents=[pdf_file]
        )
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            # Extract JSON from response (handle markdown code blocks)
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            extracted_data = json.loads(response_text)
            return {
                "success": True,
                "data": extracted_data,
                "provider": self.provider,
                "model": self.model
            }
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse JSON response: {str(e)}",
                "raw_response": response
            }
    
    async def validate_extraction(self, extracted_data):
        """
        Validate extracted data for completeness and correctness
        
        Args:
            extracted_data: The extracted data dictionary
            
        Returns:
            dict: Validation results with warnings/errors
        """
        validation_results = {
            "valid": True,
            "warnings": [],
            "errors": []
        }
        
        # Check if rows exist
        if "rows" not in extracted_data or not extracted_data["rows"]:
            validation_results["valid"] = False
            validation_results["errors"].append("No payment rows extracted")
            return validation_results
        
        # Validate each row
        required_fields = ["CustomerName", "PaymentAmount"]
        for idx, row in enumerate(extracted_data["rows"]):
            for field in required_fields:
                if not row.get(field):
                    validation_results["warnings"].append(
                        f"Row {idx + 1}: Missing {field}"
                    )
        
        return validation_results


# Synchronous wrapper for use in Express routes
def extract_lockbox_data_sync(pdf_path, provider="anthropic", model="claude-sonnet-4-20250514"):
    """Synchronous wrapper for async OCR extraction"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        service = OCRService(provider=provider, model=model)
        result = loop.run_until_complete(service.extract_lockbox_data(pdf_path))
        return result
    finally:
        loop.close()


if __name__ == "__main__":
    # Test the OCR service
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python ocr_service.py <pdf_path>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    async def test():
        service = OCRService()
        result = await service.extract_lockbox_data(pdf_path)
        print(json.dumps(result, indent=2))
    
    asyncio.run(test())
