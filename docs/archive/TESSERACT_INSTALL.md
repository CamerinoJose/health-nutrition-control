# Tesseract OCR Installation Guide for Windows

## Quick Install

1. **Download Tesseract Installer**:
   - Go to: https://github.com/UB-Mannheim/tesseract/wiki
   - Download: `tesseract-ocr-w64-setup-5.3.3.exe` (or latest version)

2. **Run Installer**:
   - Double-click the downloaded `.exe` file
   - Install to default location: `C:\Program Files\Tesseract-OCR`
   - Check "Add to PATH" during installation (recommended)

3. **Verify Installation**:
   ```bash
   tesseract --version
   ```
   
   Should show:
   ```
   tesseract 5.3.3
   ```

4. **Restart Backend**:
   ```bash
   cd /c/Users/github/backend
   # Stop current backend (Ctrl+C)
   ./app.exe
   ```

5. **Test OCR**:
   - Go to http://localhost:5173
   - Login
   - Upload your medical report image
   - See extracted data!

## If Tesseract Not in PATH

The backend will automatically check these locations:
- `tesseract` (if in PATH)
- `C:\Program Files\Tesseract-OCR\tesseract.exe`
- `C:\Program Files (x86)\Tesseract-OCR\tesseract.exe`

## Manual PATH Setup (if needed)

1. Open System Properties
   - Press `Win + R`
   - Type: `sysdm.cpl`
   - Press Enter

2. Go to Advanced → Environment Variables

3. Under System Variables, find "Path" → Edit

4. Add New Entry:
   ```
   C:\Program Files\Tesseract-OCR
   ```

5. Click OK and restart terminal

## Test Command

```bash
tesseract "/c/Users/github/peso camerino.jpg" stdout
```

Should output text extracted from the image.

## How It Works

The backend now:
1. Accepts image upload
2. Runs Tesseract OCR to extract text
3. Uses regex patterns to find:
   - Weight: "Peso: 75 kg" or "Weight: 75 kg"
   - Fat %: "Grasa: 25%" or "Fat: 25%"
   - Muscle %: "Músculo: 42%" or "Muscle: 42%"
4. Returns confidence level based on matches

## Confidence Levels

- **high**: All 3 values found (weight, fat%, muscle%)
- **medium**: 2 values found
- **low**: 1 value found
- **no_data_found**: No values extracted
- **tesseract_not_installed**: Tesseract not found on system

## Troubleshooting

**Problem**: "tesseract_not_installed"
- **Solution**: Install Tesseract using steps above

**Problem**: No data extracted
- **Solution**: Check that your medical report has clear text with labels like "Peso:", "Grasa:", "Músculo:"

**Problem**: Wrong values extracted
- **Solution**: Update regex patterns in `backend/main.go` → `parseBodyCompositionData()` function

## Supported Formats

- Spanish: "Peso", "Grasa", "Músculo"
- English: "Weight", "Fat", "Muscle"
- Units: kg, %

## Next Steps

After installation, restart your backend and upload the medical report again. You should see real extracted values!
