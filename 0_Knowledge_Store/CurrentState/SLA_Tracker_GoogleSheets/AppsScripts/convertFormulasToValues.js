// ===================================================================
// CONVERT FORMULAS TO VALUES - Standalone Function
// ===================================================================

function convertFormulasToValues() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const skipSheets = ["ℹ️ HOW TO USE", 'SLA Control'];
    
    let totalSheetsProcessed = 0;
    let totalCellsConverted = 0;
    
    Logger.log("=== Starting Formula to Values Conversion ===");
    
    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
  
      // Skip excluded sheets
      if (skipSheets.includes(sheetName)) {
        Logger.log(`Skipping sheet: "${sheetName}"`);
        skippedCount++;
        return;
      }
  
      
      
      Logger.log(`\nProcessing sheet: ${sheetName}`);
      
      // Get the header row to find column positions
      const lastColumn = sheet.getLastColumn();
      const headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      
      // Find column indices for "SLA MET (Y/N/NA)" and "Status"
      let slaColumn = -1;
      let statusColumn = -1;
      
      for (let i = 0; i < headerRow.length; i++) {
        const headerValue = String(headerRow[i]).trim();
        if (headerValue === "SLA MET (Y/N/NA)") {
          slaColumn = i + 1; // Convert to 1-based index
          Logger.log(`  Found "SLA MET (Y/N/NA)" in column ${slaColumn}`);
        } else if (headerValue === "Status") {
          statusColumn = i + 1; // Convert to 1-based index
          Logger.log(`  Found "Status" in column ${statusColumn}`);
        }
      }
      
      // Get the maximum row in the sheet (not just last row with data)
      const maxRows = sheet.getMaxRows();
      
      if (maxRows < 2) {
        Logger.log(`  Sheet has no data rows to process`);
        return;
      }
      
      const rowsToProcess = maxRows - 1; // Exclude header row
      let cellsConvertedThisSheet = 0;
      
      // Process SLA MET column
      if (slaColumn > 0) {
        const slaRange = sheet.getRange(2, slaColumn, rowsToProcess, 1);
        const slaValues = slaRange.getValues();
        slaRange.setValues(slaValues);
        cellsConvertedThisSheet += rowsToProcess;
        Logger.log(`  Converted ${rowsToProcess} cells in "SLA MET (Y/N/NA)" column`);
      } else {
        Logger.log(`  WARNING: "SLA MET (Y/N/NA)" column not found`);
      }
      
      // Process Status column
      if (statusColumn > 0) {
        const statusRange = sheet.getRange(2, statusColumn, rowsToProcess, 1);
        const statusValues = statusRange.getValues();
        statusRange.setValues(statusValues);
        cellsConvertedThisSheet += rowsToProcess;
        Logger.log(`  Converted ${rowsToProcess} cells in "Status" column`);
      } else {
        Logger.log(`  WARNING: "Status" column not found`);
      }
      
      totalSheetsProcessed++;
      totalCellsConverted += cellsConvertedThisSheet;
    });
    
    Logger.log(`\n=== Conversion Complete ===`);
    Logger.log(`Total sheets processed: ${totalSheetsProcessed}`);
    Logger.log(`Total cells converted: ${totalCellsConverted}`);
  }