/**
 * Auto-adjusts Column B (File Name) width to fit the longest filename
 * across all language tabs (excludes TEMPLATE and HOW TO USE and SLA Control)
 * 
 * Features:
 * - Calculates width based on longest content
 * - Adds 10 pixels padding for readability
 * - Only processes rows with data
 * - Skips empty sheets
 * - Logs all actions
 * 
 * Run this manually from the Apps Script editor
 */
function autoAdjustFileNameColumns() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const excludedSheets = ["TEMPLATE", "ℹ️ HOW TO USE", "SLA Control"];
    const COLUMN_B = 2; // Column B
    const PADDING_PIXELS = 50;
    
    // Character width estimation (pixels per character for Arial 10pt)
    const AVG_CHAR_WIDTH = 7; // Conservative estimate
    const MIN_COLUMN_WIDTH = 500; // Minimum width in pixels
    
    let processedCount = 0;
    let skippedEmpty = 0;
    let skippedExcluded = 0;
    const results = [];
    
    Logger.log("=== AUTO-ADJUST FILE NAME COLUMNS ===");
    Logger.log(`Starting process at ${new Date().toLocaleString()}\n`);
    
    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      
      // Skip excluded sheets
      if (excludedSheets.includes(sheetName)) {
        Logger.log(`⊘ Excluded: ${sheetName}`);
        skippedExcluded++;
        return;
      }
      
      try {
        // Get last row with data in column B
        const lastRow = sheet.getLastRow();
        
        // Check if column B has any data
        if (lastRow < 1) {
          Logger.log(`⊘ Skipped (no data): ${sheetName}`);
          skippedEmpty++;
          return;
        }
        
        // Get column B data to check if it's truly empty
        const columnBData = sheet.getRange(1, COLUMN_B, lastRow, 1).getValues();
        const hasData = columnBData.some(row => row[0] !== '' && row[0] !== null);
        
        if (!hasData) {
          Logger.log(`⊘ Skipped (column B empty): ${sheetName}`);
          skippedEmpty++;
          return;
        }
        
        // Find the longest filename in column B
        let maxLength = 0;
        let longestText = "";
        
        columnBData.forEach(row => {
          const cellValue = String(row[0] || "");
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length;
            longestText = cellValue;
          }
        });
        
        // Get current width for comparison
        const currentWidth = sheet.getColumnWidth(COLUMN_B);
        
        // Calculate required width based on character count
        // Use the longer of: calculated width or auto-resize width
        let calculatedWidth = Math.max(
          maxLength * AVG_CHAR_WIDTH,
          MIN_COLUMN_WIDTH
        );
        
        // Try auto-resize to compare
        sheet.autoResizeColumn(COLUMN_B);
        const autoResizedWidth = sheet.getColumnWidth(COLUMN_B);
        
        // Use whichever is larger (to ensure text fits)
        const optimalWidth = Math.max(calculatedWidth, autoResizedWidth);
        
        // Add padding
        const finalWidth = optimalWidth + PADDING_PIXELS;
        sheet.setColumnWidth(COLUMN_B, finalWidth);
        
        // Log the change
        const widthChange = finalWidth - currentWidth;
        const changeIndicator = widthChange > 0 ? "↑" : (widthChange < 0 ? "↓" : "=");
        
        Logger.log(`✅ ${sheetName}: ${currentWidth}px → ${finalWidth}px (${changeIndicator}${Math.abs(widthChange)}px) [Longest: ${maxLength} chars]`);
        
        results.push({
          sheet: sheetName,
          oldWidth: currentWidth,
          newWidth: finalWidth,
          change: widthChange,
          longestLength: maxLength,
          longestText: longestText.substring(0, 50) + (longestText.length > 50 ? "..." : "")
        });
        
        processedCount++;
        
      } catch (error) {
        Logger.log(`❌ Error processing ${sheetName}: ${error.message}`);
      }
    });
    
    // Log summary
    Logger.log("\n=== SUMMARY ===");
    Logger.log(`Processed: ${processedCount} sheets`);
    Logger.log(`Skipped (excluded): ${skippedExcluded} sheets`);
    Logger.log(`Skipped (no data): ${skippedEmpty} sheets`);
    Logger.log(`Total sheets: ${sheets.length}`);
    
    if (results.length > 0) {
      Logger.log("\n=== WIDTH CHANGES ===");
      results.forEach(result => {
        const arrow = result.change > 0 ? "→" : (result.change < 0 ? "←" : "=");
        Logger.log(`${result.sheet}: ${result.oldWidth}px ${arrow} ${result.newWidth}px (${result.longestLength} chars)`);
      });
      
      Logger.log("\n=== LONGEST FILENAMES ===");
      results.forEach(result => {
        Logger.log(`${result.sheet}: "${result.longestText}"`);
      });
    }
    
    Logger.log("\n=== COMPLETE ===");
    Logger.log(`Finished at ${new Date().toLocaleString()}`);
    
    return {
      success: true,
      processedCount: processedCount,
      skippedEmpty: skippedEmpty,
      skippedExcluded: skippedExcluded,
      results: results
    };
  }