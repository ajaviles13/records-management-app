/**
 * Protects Row 1 (header row) across all sheets except TEMPLATE and HOW TO USE and SLA Control
 * Only the spreadsheet owner (you) can edit the protected row
 * Run this manually from the Apps Script editor
 */
function protectAllHeaderRows() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const excludedSheets = ["TEMPLATE", "ℹ️ HOW TO USE", "SLA Control"];
    
    let protectedCount = 0;
    let skippedCount = 0;
    
    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      
      // Skip excluded sheets
      if (excludedSheets.includes(sheetName)) {
        Logger.log(`Skipped: ${sheetName}`);
        skippedCount++;
        return;
      }
      
      try {
        // Get Row 1 (entire header row)
        const headerRange = sheet.getRange("1:1");
        
        // Remove existing protections on Row 1 if any
        const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
        protections.forEach(protection => {
          const protectedRange = protection.getRange();
          // Check if this protection applies to Row 1
          if (protectedRange.getA1Notation() === "1:1" || 
              (protectedRange.getRow() === 1 && protectedRange.getNumRows() >= 1)) {
            protection.remove();
            Logger.log(`Removed existing protection from Row 1 in: ${sheetName}`);
          }
        });
        
        // Create new protection
        const protection = headerRange.protect().setDescription(`Protected Header - ${sheetName}`);
        
        // Only you (the owner) can edit - completely block others
        protection.setWarningOnly(false);
        
        // Remove all other editors (ensures only owner can edit)
        const me = Session.getEffectiveUser();
        protection.addEditor(me);
        protection.removeEditors(protection.getEditors());
        
        // Prevent domain editing
        if (protection.canDomainEdit()) {
          protection.setDomainEdit(false);
        }
        
        Logger.log(`✅ Protected Row 1 in: ${sheetName}`);
        protectedCount++;
        
      } catch (error) {
        Logger.log(`❌ Error protecting ${sheetName}: ${error.message}`);
      }
    });
    
    // Log completion summary
    const summary = `
  === PROTECTION COMPLETE ===
  Protected: ${protectedCount} sheets
  Skipped: ${skippedCount} sheets (TEMPLATE, HOW TO USE, SLA Control)
  ==========================`;
    
    Logger.log(summary);
    
    return {
      success: true,
      protectedCount: protectedCount,
      skippedCount: skippedCount
    };
  }