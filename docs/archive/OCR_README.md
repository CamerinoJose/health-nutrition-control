# OCR Feature - Medical Report Data Extraction

## Overview

The BienestarApp includes an OCR (Optical Character Recognition) feature that allows users to upload medical reports and automatically extract body composition data (weight, fat percentage, muscle percentage).

## Current Status

The OCR endpoint is implemented and ready to receive image uploads. Currently, it includes:
- ✅ File upload handling (`POST /api/ocr`)
- ✅ Basic image validation (JPEG/PNG format check)
- ✅ Temporary file cleanup
- ✅ Frontend upload component with file selection
- ⏳ Real OCR engine integration (needs setup)

## Integration Options

### Option 1: Tesseract OCR (Open Source)

**Pros**: Free, open-source, good for simple text extraction
**Cons**: Slower, less accurate for structured forms

Install:
```bash
cd backend
go get github.com/otiai10/gosseract/v2
```

Update `extractDataFromImage()` in `main.go`:
```go
import "github.com/otiai10/gosseract/v2"

func extractDataFromImage(imagePath string) OCRResult {
	client := gosseract.NewClient()
	defer client.Close()
	client.SetImage(imagePath)
	text, _ := client.Text()
	
	// Parse text for numbers using regex
	// Look for patterns like "Weight: 75kg", "Fat: 25%", etc.
	
	return result
}
```

### Option 2: Google Cloud Vision API (Recommended for accuracy)

**Pros**: High accuracy, handles handwriting and complex documents
**Cons**: Requires API key and quota

Install:
```bash
cd backend
go get cloud.google.com/go/vision/v2
```

### Option 3: Microsoft Computer Vision API (Azure)

**Pros**: Similar accuracy to Google, good for enterprise
**Cons**: Requires Azure subscription

### Option 4: AWS Textract

**Pros**: Best for forms and structured documents
**Cons**: Requires AWS account

## Using the OCR Feature

### Frontend
1. Login to the app
2. Go to your Profile section
3. Upload an image of a medical report
4. The app extracts weight, fat %, and muscle % data
5. Data is displayed and can be saved to history

### API Endpoint
```bash
POST /api/ocr
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  image: <image file>

Response:
{
  "weight": 75.5,
  "fat_percentage": 25.3,
  "muscle_percentage": 45.2,
  "confidence": "high"
}
```

## Database Schema

The history table now stores structured data:
```sql
CREATE TABLE histories (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  date TEXT,
  weight REAL,
  fat_percentage REAL,
  muscle_percentage REAL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

## Next Steps

1. **Choose OCR provider** based on your needs
2. **Implement extraction logic** in `extractDataFromImage()`
3. **Add regex patterns** to parse medical report text
4. **Test with real reports** from your use case
5. **Add validation** to ensure extracted numbers are realistic

## File Locations

- Backend endpoint: [backend/main.go](../../backend/main.go) - `ocrHandler()` and `extractDataFromImage()`
- Frontend component: [frontend/src/OCRUpload.jsx](../src/OCRUpload.jsx)
- Uploaded files: `backend/uploads/` (temporary, cleaned up after processing)

## Testing

```bash
# Start backend
cd backend
JWT_SECRET="test" ./app.exe

# Login via frontend
# Navigate to profile section
# Upload an image (any JPEG/PNG)
# View extracted data
```
