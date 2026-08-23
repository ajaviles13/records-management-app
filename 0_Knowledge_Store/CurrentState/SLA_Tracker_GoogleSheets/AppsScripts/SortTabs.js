// ===================================================================
// SORT TABS SCRIPT
// ===================================================================
// Version: 1.0
// Purpose: Sort all tabs alphabetically with special tabs pinned at top
// 
// Tab Order:
// 1. "ℹ️ HOW TO USE" (always first)
// 2. "TEMPLATE" (always second)
// 3-N. All other tabs sorted A-Z
//
// INSTRUCTIONS:
// 1. Copy this script into your Google Apps Script editor
// 2. Run the function: sortTabsAlphabetically()
// ===================================================================

/**
 * Sort all tabs alphabetically with special tabs pinned at positions 1 and 2
 */
function sortTabsAlphabetically() {
    try {
      Logger.log("=== Starting Tab Sort ===");
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      
      // Define special tabs that should be pinned at top
      const SPECIAL_TABS = {
        "ℹ️ HOW TO USE": 1,  // Position 1
        "TEMPLATE": 2,         // Position 2
        "SLA Control": 3         // Position 3
      };
      
      Logger.log(`Total sheets found: ${sheets.length}`);
      
      // Separate special tabs and language tabs
      const specialTabs = [];
      const languageTabs = [];
      
      for (const sheet of sheets) {
        const sheetName = sheet.getName();
        
        if (SPECIAL_TABS[sheetName]) {
          specialTabs.push({
            sheet: sheet,
            name: sheetName,
            position: SPECIAL_TABS[sheetName]
          });
          Logger.log(`Special tab found: ${sheetName}`);
        } else {
          languageTabs.push({
            sheet: sheet,
            name: sheetName
          });
        }
      }
      
      // Sort special tabs by their defined position
      specialTabs.sort((a, b) => a.position - b.position);
      
      // Sort language tabs alphabetically (case-insensitive)
      languageTabs.sort((a, b) => {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
      
      Logger.log(`Special tabs: ${specialTabs.length}`);
      Logger.log(`Language tabs: ${languageTabs.length}`);
      
      // Combine in desired order: special tabs first, then sorted language tabs
      const sortedOrder = [...specialTabs, ...languageTabs];
      
      // Move sheets to correct positions
      Logger.log("\n=== Reordering Tabs ===");
      
      for (let i = 0; i < sortedOrder.length; i++) {
        const targetPosition = i + 1; // Positions are 1-indexed
        const sheet = sortedOrder[i].sheet;
        const sheetName = sortedOrder[i].name;
        
        // Set this sheet as active and move it to the target position
        ss.setActiveSheet(sheet);
        ss.moveActiveSheet(targetPosition);
        
        Logger.log(`${targetPosition}. ${sheetName}`);
      }
      
      Logger.log("\n=== Sort Complete ===");
      
      // Show success message
      SpreadsheetApp.getUi().alert(
        "Tabs Sorted Successfully",
        `✓ Tabs have been sorted alphabetically\n\n` +
        `Position 1: ${specialTabs[0] ? specialTabs[0].name : 'Not found'}\n` +
        `Position 2: ${specialTabs[1] ? specialTabs[1].name : 'Not found'}\n` +
        `Positions 3-${sortedOrder.length}: ${languageTabs.length} language tabs (A-Z)`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      
    } catch (error) {
      Logger.log(`ERROR: ${error.message}`);
      Logger.log(error.stack);
      
      SpreadsheetApp.getUi().alert(
        "Sort Failed",
        `An error occurred while sorting tabs:\n\n${error.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  }
  
  /**
   * Preview the sorted order without actually moving tabs
   * Run this to see what the order will be before sorting
   */
  function previewSortOrder() {
    try {
      Logger.log("=== Preview Sort Order ===");
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      
      const SPECIAL_TABS = {
        "ℹ️ HOW TO USE": 1,
        "TEMPLATE": 2
      };
      
      const specialTabs = [];
      const languageTabs = [];
      
      for (const sheet of sheets) {
        const sheetName = sheet.getName();
        
        if (SPECIAL_TABS[sheetName]) {
          specialTabs.push({
            name: sheetName,
            position: SPECIAL_TABS[sheetName]
          });
        } else {
          languageTabs.push({ name: sheetName });
        }
      }
      
      specialTabs.sort((a, b) => a.position - b.position);
      languageTabs.sort((a, b) => {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
      
      const sortedOrder = [...specialTabs, ...languageTabs];
      
      Logger.log("\nProposed Tab Order:");
      let previewText = "Proposed Tab Order:\n\n";
      
      for (let i = 0; i < sortedOrder.length; i++) {
        const entry = `${i + 1}. ${sortedOrder[i].name}`;
        Logger.log(entry);
        previewText += entry + "\n";
      }
      
      // Show preview dialog
      SpreadsheetApp.getUi().alert(
        "Preview Sort Order",
        previewText,
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
  
  /**
   * Get current tab order (useful for debugging)
   */
  function getCurrentTabOrder() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    
    Logger.log("=== Current Tab Order ===");
    let orderText = "Current Tab Order:\n\n";
    
    for (let i = 0; i < sheets.length; i++) {
      const entry = `${i + 1}. ${sheets[i].getName()}`;
      Logger.log(entry);
      orderText += entry + "\n";
    }
    
    SpreadsheetApp.getUi().alert(
      "Current Tab Order",
      orderText,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }