# Settings Feature Documentation

## Overview

The Settings feature allows users to customize BattleScope reports with company-specific information. This feature includes a dedicated settings page, persistent storage, and integration with the report generation system.

## Features Implemented

### 1. Settings Page (`/settings`)

A dedicated settings page with the following fields:

#### Required Fields
- **Company Name**: Customizes the report title (e.g., "Acme Corp Vulnerability Report")

#### Optional Fields
- **Analyst Name**: Name of the primary security analyst
- **Report Author**: Name of the report author
- **Organization/Department**: Organization or department name
- **Contact Email**: Email address for report inquiries
- **Additional Notes**: Custom notes to include in reports

### 2. Settings Storage

Settings are persisted to `data/settings.json` with the following structure:

```json
{
    "company_name": "BattleScope",
    "analyst_name": "",
    "report_author": "",
    "organization": "",
    "contact_email": "",
    "notes": ""
}
```

**Default Values:**
- Company Name: "BattleScope"
- All other fields: Empty strings

### 3. Report Integration

Generated reports now include:
- **Report Title**: "{Company Name} Vulnerability Report"
- **Report Header**: Includes analyst, author, organization, and contact info (if provided)
- **Report Footer**: Shows company name and analyst/author information
- **File Name**: Uses sanitized company name in filename (e.g., `Acme_Corp_Report_2025-11-15.html`)

### 4. User Interface

#### Navigation
- New "Settings" button added to the top navigation bar (between "Report" and theme toggle)
- Clicking opens the dedicated settings page

#### Settings Page Design
- Matches existing BattleScope theme (purple/blue gradient)
- Full dark/light mode support
- Clean, modern form layout
- Real-time validation
- Success/error status messages
- "Reset to Defaults" button

### 5. API Endpoints

Three new endpoints were added:

1. **GET /settings**
   - Renders the settings page

2. **GET /api/settings/load**
   - Returns current settings as JSON
   - Returns defaults if no settings file exists

3. **POST /api/settings/save**
   - Saves settings to `data/settings.json`
   - Validates required fields (company_name)
   - Creates `data/` directory if needed
   - Returns success/error response

## File Changes

### New Files Created

1. **`/app/templates/settings.html`**
   - Settings page template with embedded JavaScript
   - Responsive form layout
   - Theme support
   - Form validation and status handling

2. **`/data/settings.json`**
   - Default settings storage file
   - Added to `.gitignore` (user-specific)

3. **`/data/settings.json.example`**
   - Example settings template for documentation
   - Committed to repository

### Modified Files

1. **`/app/app.py`**
   - Added `json` import
   - Added `SETTINGS_FILE` config
   - Added `DEFAULT_SETTINGS` constant
   - Added `load_settings()` helper function
   - Added `save_settings()` helper function
   - Added `/settings` route
   - Added `/api/settings/load` endpoint
   - Added `/api/settings/save` endpoint
   - Modified `/api/report/generate` to include settings in response

2. **`/app/templates/index.html`**
   - Added "Settings" link to navigation bar

3. **`/app/static/js/script.js`**
   - Modified `generateReportHTML()` to use settings data
   - Updated report title to use company name
   - Updated report header to include analyst/author/organization/contact
   - Updated report footer to use company name and analyst info
   - Updated report filename to use sanitized company name

4. **`/.gitignore`**
   - Added `data/settings.json` to ignore user-specific settings

5. **`/README.md`**
   - Added Settings Management to features list
   - Added Settings Configuration section to usage
   - Updated project structure
   - Added new API endpoints

## Usage Examples

### Accessing Settings

1. Navigate to BattleScope (http://localhost:5000)
2. Click "Settings" in the navigation bar
3. Fill in desired fields
4. Click "Save Settings"

### Generating Custom Reports

1. Configure settings with your company information
2. Upload and parse a scan file
3. Click "Report" button
4. Download the customized report

### Example Report Output

**Before (Default):**
- Report Title: "BattleScope Vulnerability Report"
- Filename: `BattleScope_Report_2025-11-15.html`

**After (Custom Settings):**
- Company: "Acme Corporation"
- Analyst: "John Smith"
- Report Title: "Acme Corporation Vulnerability Report"
- Filename: `Acme_Corporation_Report_2025-11-15.html`
- Header includes: Analyst name, organization, contact email
- Footer includes: Company name, analyst name, custom notes

## Technical Details

### Settings Persistence

Settings are automatically:
- Loaded on settings page load
- Loaded during report generation
- Saved to disk immediately on form submission
- Merged with defaults to ensure all keys exist

### Error Handling

The implementation includes:
- File I/O error handling
- Missing directory creation
- Default fallback values
- Validation for required fields
- User-friendly error messages

### Security

- Settings file stored in `data/` directory (not web-accessible)
- Input sanitization using `escapeHtml()` in reports
- No executable code in settings
- Filename sanitization for safe downloads

## Browser Compatibility

Settings page tested and compatible with:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Future Enhancements

Potential improvements:
- Logo upload for reports
- Custom color schemes
- Report templates
- Multiple analyst profiles
- Export/import settings
- Settings backup/restore

## Support

For issues or questions:
- **Author:** syyntax
- **Email:** syyntax@protonmail.com
