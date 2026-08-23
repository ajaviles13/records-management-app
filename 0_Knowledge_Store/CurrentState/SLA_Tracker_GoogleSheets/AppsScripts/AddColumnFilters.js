/**
 * Add column filters to all sheets except TEMPLATE and ℹ️ HOW TO USE and SLA Control
 * Only adds filters if they don't already exist
 * Automatically detects the range based on headers (stops at first blank column)
 * Also sets specific widths for various columns
 */
function AddColumnFilters() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    
    // Sheets to skip
    const skipSheets = ['TEMPLATE', 'ℹ️ HOW TO USE', 'SLA Control'];
    
    // Column headers to resize with their target widths
    const columnWidths = {
      'Project number': 125,
      'State': 75,
      'Date file received (EST)': 130,
      'Time file received (EST)': 130,
      'Date file delivered (EST)': 130,
      'Time file delivered (EST)': 130,
      'SLA MET (Y/N/NA)': 100,
      'isUrgent?': 100,
      'QA Delivery by': 130,
      'Comment': 225,
      'Status': 200,
      'Internal': 100,
      'DTP': 100,
      'New': 100,
      'Fuzzy': 100,
      'Total': 100,
      'PM': 100,
      'IT eng': 100,
      'QA': 100
    };
    
    let processedCount = 0;
    let skippedCount = 0;
    let alreadyFilteredCount = 0;
    let columnsResizedCount = 0;
    
    Logger.log('=== Starting AddColumnFilters ===\n');
    
    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      
      // Skip excluded sheets
      if (skipSheets.includes(sheetName)) {
        Logger.log(`Skipping sheet: "${sheetName}"`);
        skippedCount++;
        return;
      }
      
      // Check if filters already exist
      const filter = sheet.getFilter();
      const needsFilter = !filter;
      
      if (!needsFilter) {
        Logger.log(`Sheet "${sheetName}" already has filters - skipping filter creation`);
        alreadyFilteredCount++;
      }
      
      // Find the last column with a header (first blank header = end)
      const maxCols = sheet.getMaxColumns();
      const headerRow = sheet.getRange(1, 1, 1, maxCols).getValues()[0];
      let lastHeaderCol = 0;
      
      for (let i = 0; i < headerRow.length; i++) {
        if (headerRow[i] !== '' && headerRow[i] !== null) {
          lastHeaderCol = i + 1; // Convert to 1-based index
        } else {
          break; // Stop at first blank header
        }
      }
      
      if (lastHeaderCol === 0) {
        Logger.log(`Sheet "${sheetName}" has no headers - skipping`);
        skippedCount++;
        return;
      }
      
      // Get the last row with data
      const lastRow = sheet.getLastRow();
      
      if (lastRow < 1) {
        Logger.log(`Sheet "${sheetName}" has no data - skipping`);
        skippedCount++;
        return;
      }
      
      // Create filter range if needed (Row 1 to last row, Column A to last header column)
      if (needsFilter) {
        const filterRange = sheet.getRange(1, 1, lastRow, lastHeaderCol);
        filterRange.createFilter();
        
        const lastColLetter = String.fromCharCode(64 + lastHeaderCol);
        Logger.log(`✓ Added filters to sheet "${sheetName}" (A1:${lastColLetter}${lastRow})`);
        processedCount++;
      }
      
      // Resize specific columns
      let resizedThisSheet = 0;
      for (let colIndex = 0; colIndex < lastHeaderCol; colIndex++) {
        const headerValue = String(headerRow[colIndex]).trim();
        
        // Check if this header is in our columnWidths mapping
        if (columnWidths.hasOwnProperty(headerValue)) {
          const columnNumber = colIndex + 1; // Convert to 1-based
          const targetWidth = columnWidths[headerValue];
          sheet.setColumnWidth(columnNumber, targetWidth);
          
          const columnLetter = String.fromCharCode(64 + columnNumber);
          Logger.log(`  → Set column ${columnLetter} ("${headerValue}") to width ${targetWidth}`);
          resizedThisSheet++;
          columnsResizedCount++;
        }
      }
      
      if (resizedThisSheet > 0) {
        Logger.log(`✓ Resized ${resizedThisSheet} column(s) in sheet "${sheetName}"`);
      }
    });
    
    // Summary
    Logger.log('\n=== SUMMARY ===');
    Logger.log(`Sheets with filters added: ${processedCount}`);
    Logger.log(`Sheets already filtered: ${alreadyFilteredCount}`);
    Logger.log(`Sheets skipped: ${skippedCount}`);
    Logger.log(`Total columns resized: ${columnsResizedCount}`);
    Logger.log(`Total sheets: ${sheets.length}`);
    
    // Show toast notification
    const message = `Filters added to ${processedCount} sheet(s). ${columnsResizedCount} column(s) resized. ${alreadyFilteredCount} already had filters.`;
    ss.toast(message, 'Add Column Filters Complete', 5);
  }