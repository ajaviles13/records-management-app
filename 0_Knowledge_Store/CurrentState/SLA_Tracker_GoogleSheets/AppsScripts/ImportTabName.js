// ===================================================================
// IMPORT TAB NAME MIGRATION SCRIPT
// ===================================================================
// Version: 1.0
// Purpose: Migrate language tab names from source Google Sheet and 
//          create replica tabs from TEMPLATE
// 
// INSTRUCTIONS:
// 1. Copy this entire script into your Google Apps Script editor
// 2. Save the script
// 3. Run the function: importLanguageTabs()
// 4. The script will automatically detect which destination sheet 
//    it's running in and create the appropriate language tabs
// ===================================================================

// ===================================================================
// CONFIGURATION
// ===================================================================

const IMPORT_CONFIG = {
    // Source Google Sheet ID (contains the tab names to migrate)
    SOURCE_SHEET_ID: "1Nb53-Nq-NPrHuL-HIU15eFiDDyWz8HVHH-d1_rvSiIg",
    
    // Source sheet tab name
    SOURCE_TAB_NAME: "Sheet1",
    
    // Template sheet name (must exist in destination sheet)
    TEMPLATE_SHEET_NAME: "TEMPLATE",
    
    // Column mapping in source sheet
    HEADER_ROW: 1,           // Row 1: Google Sheet Names
    DOCUMENT_TYPE_ROW: 2,    // Row 2: Document Type
    DEPLOYMENT_ROW: 3,       // Row 3: Is Ready for Deployment?
    LANGUAGE_START_ROW: 4    // Row 4+: Language codes
  };
  
  // ===================================================================
  // MAIN IMPORT FUNCTION
  // ===================================================================
  
  /**
   * Main function to import and create language tabs
   * This is the function you should run manually
   */
  function importLanguageTabs() {
    try {
      Logger.log("=== Starting Import Language Tabs Process ===");
      
      // Get current spreadsheet
      const currentSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const currentSpreadsheetName = currentSpreadsheet.getName();
      
      Logger.log(`Current Spreadsheet: ${currentSpreadsheetName}`);
      
      // Verify TEMPLATE sheet exists
      const templateSheet = currentSpreadsheet.getSheetByName(IMPORT_CONFIG.TEMPLATE_SHEET_NAME);
      if (!templateSheet) {
        throw new Error(`ERROR: TEMPLATE sheet not found in "${currentSpreadsheetName}". Please ensure a sheet named "TEMPLATE" exists.`);
      }
      
      // Open source spreadsheet
      Logger.log("Opening source spreadsheet...");
      const sourceSpreadsheet = SpreadsheetApp.openById(IMPORT_CONFIG.SOURCE_SHEET_ID);
      const sourceSheet = sourceSpreadsheet.getSheetByName(IMPORT_CONFIG.SOURCE_TAB_NAME);
      
      if (!sourceSheet) {
        throw new Error(`ERROR: Source sheet "${IMPORT_CONFIG.SOURCE_TAB_NAME}" not found in source spreadsheet.`);
      }
      
      // Get all data from source sheet
      const lastRow = sourceSheet.getLastRow();
      const lastCol = sourceSheet.getLastColumn();
      const sourceData = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();
      
      Logger.log(`Source data retrieved: ${lastRow} rows, ${lastCol} columns`);
      
      // Find the matching column for current spreadsheet
      const headerRow = sourceData[IMPORT_CONFIG.HEADER_ROW - 1];
      let targetColumnIndex = -1;
      
      for (let i = 1; i < headerRow.length; i++) { // Start from column B (index 1)
        const sourceSheetName = String(headerRow[i] || "").trim();
        if (sourceSheetName === currentSpreadsheetName) {
          targetColumnIndex = i;
          break;
        }
      }
      
      if (targetColumnIndex === -1) {
        throw new Error(`ERROR: Current spreadsheet name "${currentSpreadsheetName}" not found in source sheet headers. Please verify the spreadsheet name matches exactly.`);
      }
      
      Logger.log(`Found matching column at index ${targetColumnIndex} (Column ${String.fromCharCode(65 + targetColumnIndex)})`);
      
      // Get document type for reference
      const documentType = sourceData[IMPORT_CONFIG.DOCUMENT_TYPE_ROW - 1][targetColumnIndex];
      Logger.log(`Document Type: ${documentType}`);
      
      // Extract language codes from the target column
      const languageCodes = [];
      for (let i = IMPORT_CONFIG.LANGUAGE_START_ROW - 1; i < sourceData.length; i++) {
        const langCode = sourceData[i][targetColumnIndex];
        if (langCode && String(langCode).trim() !== "") {
          languageCodes.push(String(langCode).trim());
        }
      }
      
      Logger.log(`Found ${languageCodes.length} language codes to import: ${languageCodes.join(", ")}`);
      
      if (languageCodes.length === 0) {
        SpreadsheetApp.getUi().alert(
          "No Language Codes Found",
          `No language codes found for spreadsheet "${currentSpreadsheetName}" in the source sheet.`,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }
      
      // Get existing sheet names to avoid duplicates
      const existingSheets = currentSpreadsheet.getSheets();
      const existingSheetNames = existingSheets.map(sheet => sheet.getName());
      
      // Track results
      let created = 0;
      let skipped = 0;
      const skippedList = [];
      
      // Create tabs for each language code
      for (const langCode of languageCodes) {
        if (existingSheetNames.includes(langCode)) {
          Logger.log(`Skipping "${langCode}" - already exists`);
          skipped++;
          skippedList.push(langCode);
        } else {
          Logger.log(`Creating tab: ${langCode}`);
          
          // Duplicate the TEMPLATE sheet
          const newSheet = templateSheet.copyTo(currentSpreadsheet);
          newSheet.setName(langCode);
          
          // Move the new sheet after TEMPLATE (optional - maintains organization)
          const templateIndex = currentSpreadsheet.getSheets().findIndex(
            sheet => sheet.getName() === IMPORT_CONFIG.TEMPLATE_SHEET_NAME
          );
          if (templateIndex !== -1) {
            currentSpreadsheet.setActiveSheet(newSheet);
            currentSpreadsheet.moveActiveSheet(templateIndex + 2 + created);
          }
          
          created++;
          Logger.log(`✓ Created: ${langCode}`);
        }
      }
      
      // Show results summary
      Logger.log(`\n=== Import Complete ===`);
      Logger.log(`Created: ${created} tabs`);
      Logger.log(`Skipped: ${skipped} tabs (already existed)`);
      
      let summaryMessage = `Import Complete!\n\n`;
      summaryMessage += `✓ Created: ${created} new language tab${created !== 1 ? 's' : ''}\n`;
      
      if (skipped > 0) {
        summaryMessage += `⊘ Skipped: ${skipped} tab${skipped !== 1 ? 's' : ''} (already existed)\n`;
        summaryMessage += `\nSkipped tabs: ${skippedList.join(", ")}`;
      }
      
      SpreadsheetApp.getUi().alert(
        "Import Language Tabs Complete",
        summaryMessage,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      
    } catch (error) {
      Logger.log(`ERROR: ${error.message}`);
      Logger.log(error.stack);
      
      SpreadsheetApp.getUi().alert(
        "Import Failed",
        `An error occurred during import:\n\n${error.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  }
  
  // ===================================================================
  // UTILITY FUNCTION: Preview Language Codes (Optional)
  // ===================================================================
  
  /**
   * Preview which language codes will be imported without creating tabs
   * Run this function to see what will happen before running importLanguageTabs()
   */
  function previewLanguageCodes() {
    try {
      Logger.log("=== Preview Language Codes ===");
      
      const currentSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const currentSpreadsheetName = currentSpreadsheet.getName();
      
      const sourceSpreadsheet = SpreadsheetApp.openById(IMPORT_CONFIG.SOURCE_SHEET_ID);
      const sourceSheet = sourceSpreadsheet.getSheetByName(IMPORT_CONFIG.SOURCE_TAB_NAME);
      
      if (!sourceSheet) {
        throw new Error("Source sheet not found.");
      }
      
      const lastRow = sourceSheet.getLastRow();
      const lastCol = sourceSheet.getLastColumn();
      const sourceData = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();
      
      const headerRow = sourceData[IMPORT_CONFIG.HEADER_ROW - 1];
      let targetColumnIndex = -1;
      
      for (let i = 1; i < headerRow.length; i++) {
        const sourceSheetName = String(headerRow[i] || "").trim();
        if (sourceSheetName === currentSpreadsheetName) {
          targetColumnIndex = i;
          break;
        }
      }
      
      if (targetColumnIndex === -1) {
        throw new Error(`Current spreadsheet name not found in source: "${currentSpreadsheetName}"`);
      }
      
      const languageCodes = [];
      for (let i = IMPORT_CONFIG.LANGUAGE_START_ROW - 1; i < sourceData.length; i++) {
        const langCode = sourceData[i][targetColumnIndex];
        if (langCode && String(langCode).trim() !== "") {
          languageCodes.push(String(langCode).trim());
        }
      }
      
      Logger.log(`\nSpreadsheet: ${currentSpreadsheetName}`);
      Logger.log(`Language codes to import (${languageCodes.length}):`);
      Logger.log(languageCodes.join(", "));
      
      const message = `Preview for: ${currentSpreadsheetName}\n\n` +
                     `Language codes to import (${languageCodes.length}):\n\n` +
                     languageCodes.join(", ");
      
      SpreadsheetApp.getUi().alert(
        "Preview Language Codes",
        message,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      
    } catch (error) {
      Logger.log(`ERROR: ${error.message}`);
      SpreadsheetApp.getUi().alert(
        "Preview Failed",
        error.message,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  }
  
  // ===================================================================
  // UTILITY FUNCTION: Delete All Language Tabs (Use with caution!)
  // ===================================================================
  
  /**
   * Delete all tabs EXCEPT TEMPLATE (use with caution!)
   * This is useful if you need to re-run the import
   */
  function deleteAllLanguageTabs() {
    try {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        "⚠️ Delete All Language Tabs",
        "This will delete ALL sheets EXCEPT the TEMPLATE sheet.\n\nThis action CANNOT be undone!\n\nAre you sure?",
        ui.ButtonSet.YES_NO
      );
      
      if (response !== ui.Button.YES) {
        Logger.log("Deletion cancelled by user");
        return;
      }
      
      const currentSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = currentSpreadsheet.getSheets();
      
      let deletedCount = 0;
      
      for (const sheet of sheets) {
        const sheetName = sheet.getName();
        if (sheetName !== IMPORT_CONFIG.TEMPLATE_SHEET_NAME) {
          Logger.log(`Deleting: ${sheetName}`);
          currentSpreadsheet.deleteSheet(sheet);
          deletedCount++;
        }
      }
      
      Logger.log(`Deleted ${deletedCount} sheets`);
      
      ui.alert(
        "Deletion Complete",
        `Deleted ${deletedCount} language tab${deletedCount !== 1 ? 's' : ''}.\n\nTEMPLATE sheet preserved.`,
        ui.ButtonSet.OK
      );
      
    } catch (error) {
      Logger.log(`ERROR: ${error.message}`);
      SpreadsheetApp.getUi().alert(
        "Deletion Failed",
        error.message,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  }