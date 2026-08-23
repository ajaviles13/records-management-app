// ===================================================================
// MONTHLY REPORT GENERATOR - CONFIGURATION
// ===================================================================

const REPORT_CONFIG = {
    SOURCE_SHEETS: [
      { id: "1FnL6w-QriXESyte-wSvJw-fqeRd7HgPdNdgVXKVy1qA", template_type: "Word", name: "Word - UM Medicaid, Medicare, MMP, NM, Nebraska, Arizona and Iowa" },
      { id: "1SrPkLjjCX2OhTbYkrx6kQxC2lq-5YTR_3tG-07pDqig", template_type: "Word", name: "Word - SWH NY Molina" },
      { id: "1kCkiC4GFugUe9YxcwzOcACjtJdD6RPPfw7rgdIgLQJ8", template_type: "PDF", name: "PDF- CM Medicare, Nebraska and Iowa" },
      { id: "1Wg2_KdE_hAuKJ2iRkxh4GsbVmkk-OL3mJUuREQD7wic", template_type: "PDF", name: "PDF - SWH NY Molina" }
    ],
    
    // Sheets to skip (not Language Tabs)
    SKIP_SHEETS: ["ℹ️ HOW TO USE", "TEMPLATE", "SLA Control"],
    
    // Output column headers (final report structure)
    OUTPUT_HEADERS: [
      "Project number",
      "File name",
      "Line of Business",
      "State",
      "Date file received (EST)",
      "Time file received (EST)",
      "Date file delivered (EST)",
      "Time file delivered (EST)",
      "SLA MET (Y/N/NA)",
      "isUrgent?",
      "QA Delivery by",
      "Comment",
      "Status",
      "Internal",
      "DTP",
      "New",
      "Fuzzy",
      "Total",
      "DTP",
      "PM",
      "IT eng",
      "QA"
    ]
  };
  
  // ===================================================================
  // MENU CREATION
  // ===================================================================
  
  function onOpen() {
    const ui = SpreadsheetApp.getUi();
    
    // Check if existing menu exists, if so remove it to avoid duplicates
    ui.createMenu('☁️ Generate Monthly Report')
      .addItem('📊 Create Report', 'showMonthlyReportDialog')
      .addToUi();
  }
  
  // ===================================================================
  // SHOW MONTHLY REPORT DIALOG
  // ===================================================================
  
  function showMonthlyReportDialog() {
    const html = HtmlService.createHtmlOutputFromFile('MonthlyReportDialog')
      .setWidth(1100)
      .setHeight(600);
    SpreadsheetApp.getUi().showModalDialog(html, '☁️ Generate Monthly Report');
  }
  
  // ===================================================================
  // GET SOURCE COLUMN MAPPING BASED ON TEMPLATE TYPE
  // ===================================================================
  
  function getSourceColumnMapping(templateType) {
    const isPDF = templateType === "PDF";
    
    return {
      PROJECT_NUMBER: 1,    // Column A
      FILE_NAME: 2,         // Column B
      LINE_OF_BUSINESS: 3,  // Column C
      STATE: 4,             // Column D
      DATE_RECEIVED: 5,     // Column E (same for both)
      TIME_RECEIVED: 6,     // Column F (same for both)
      DATE_DELIVERED: 7,    // Column G (same for both)
      TIME_DELIVERED: 8,    // Column H (same for both)
      SLA_MET: 9,           // Column I (same for both)
      IS_URGENT: isPDF ? null : 10,  // Column J (Word only)
      QA_DELIVERY_BY: isPDF ? 10 : 11,
      COMMENT: isPDF ? 11 : 12,
      STATUS: isPDF ? 12 : 13,
      INTERNAL: isPDF ? 13 : 14,
      DTP_COL1: isPDF ? 14 : 15,
      NEW: isPDF ? 15 : 16,
      FUZZY: isPDF ? 16 : 17,
      TOTAL: isPDF ? 17 : 18,
      DTP_COL2: isPDF ? 18 : 19,
      PM: isPDF ? 19 : 20,
      IT_ENG: isPDF ? 20 : 21,
      QA: isPDF ? 21 : 22
    };
  }
  
  // ===================================================================
  // PARSE DATE FROM MM/DD/YYYY STRING (TIMEZONE-SAFE)
  // ===================================================================
  
  function parseDateFromString(dateStr) {
    if (!dateStr || dateStr === '') return null;
    
    try {
      // Handle Date objects - extract components to avoid timezone issues
      if (dateStr instanceof Date) {
        // Use UTC methods to avoid timezone conversion
        const year = dateStr.getUTCFullYear();
        const month = dateStr.getUTCMonth();
        const day = dateStr.getUTCDate();
        return new Date(year, month, day, 0, 0, 0, 0);
      }
      
      // Handle string dates in MM/DD/YYYY format
      const dateString = String(dateStr).trim();
      
      // Try parsing MM/DD/YYYY format
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1; // JS months are 0-indexed
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        // Create date with explicit time components to avoid timezone issues
        return new Date(year, month, day, 0, 0, 0, 0);
      }
      
      // Fallback - parse and normalize to midnight
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
      }
      
      return null;
    } catch (error) {
      Logger.log(`Error parsing date "${dateStr}": ${error.message}`);
      return null;
    }
  }
  
  // ===================================================================
  // CHECK IF DATE IS IN RANGE (INCLUSIVE) - TIMEZONE-SAFE
  // ===================================================================
  
  function isDateInRange(dateStr, lowerBoundDate, upperBoundDate) {
    const date = parseDateFromString(dateStr);
    
    if (!date || isNaN(date.getTime())) {
      return false;
    }
    
    // Normalize all dates to midnight (already done in parseDateFromString)
    // This ensures date-only comparison without time components
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const normalizedLower = new Date(lowerBoundDate.getFullYear(), lowerBoundDate.getMonth(), lowerBoundDate.getDate(), 0, 0, 0, 0);
    const normalizedUpper = new Date(upperBoundDate.getFullYear(), upperBoundDate.getMonth(), upperBoundDate.getDate(), 0, 0, 0, 0);
    
    // Inclusive range check
    return normalizedDate >= normalizedLower && normalizedDate <= normalizedUpper;
  }
  
  // ===================================================================
  // EXTRACT DATA FROM A SINGLE LANGUAGE TAB
  // ===================================================================
  
  function extractDataFromLanguageTab(sheet, templateType, dateField, lowerBound, upperBound, includeEmptyDelivered) {
    const columnMap = getSourceColumnMapping(templateType);
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      // No data rows (assuming row 1 is header)
      return [];
    }
    
    // Use getDisplayValues() for entire range - preserves dates and times exactly as displayed
    // This is FASTER than separate getValues() + getDisplayValues() calls
    // AND avoids timezone conversion issues with dates
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 22); // Max column is V (22)
    const allData = dataRange.getDisplayValues(); // Get exactly what's shown in the sheet
    
    const extractedRows = [];
    
    allData.forEach((row, index) => {
      const actualRow = index + 2; // Actual row number in sheet
      
      // Get date and time values directly from display values (already formatted correctly)
      const dateReceivedValue = row[columnMap.DATE_RECEIVED - 1] || '';
      const timeReceivedValue = row[columnMap.TIME_RECEIVED - 1] || '';
      const dateDeliveredValue = row[columnMap.DATE_DELIVERED - 1] || '';
      const timeDeliveredValue = row[columnMap.TIME_DELIVERED - 1] || '';
      
      // Apply filtering logic based on selected date field
      if (dateField === "Received") {
        // Date Received mode filtering
        
        // Exclude if Date Received is empty
        if (!dateReceivedValue || dateReceivedValue === '') {
          return; // Skip this row
        }
        
        // Check if Date Received is in range
        if (!isDateInRange(dateReceivedValue, lowerBound, upperBound)) {
          return; // Skip - date not in range
        }
        
        // Apply conditional filter based on includeEmptyDelivered
        if (!includeEmptyDelivered) {
          // "No" selected - exclude files with empty Date Delivered
          if (!dateDeliveredValue || dateDeliveredValue === '') {
            return; // Skip this row
          }
        }
        // If includeEmptyDelivered is true ("Yes"), we don't exclude based on Delivered status
        
      } else if (dateField === "Delivered") {
        // Date Delivered mode filtering
        
        // Exclude if Date Delivered is empty
        if (!dateDeliveredValue || dateDeliveredValue === '') {
          return; // Skip this row
        }
        
        // Check if Date Delivered is in range
        if (!isDateInRange(dateDeliveredValue, lowerBound, upperBound)) {
          return; // Skip - date not in range
        }
        
        // No conditional logic needed for Delivered mode
        // (because Delivered being populated always means Received is populated)
      }
      
      // Extract isUrgent value based on template type
      const isUrgentValue = columnMap.IS_URGENT ? (row[columnMap.IS_URGENT - 1] || '') : 'N/A';
      
      // Map columns to output format (including isUrgent column)
      // All values are already strings from getDisplayValues(), so use directly
      const outputRow = [
        row[columnMap.PROJECT_NUMBER - 1] || '',      // Project number
        row[columnMap.FILE_NAME - 1] || '',           // File name
        row[columnMap.LINE_OF_BUSINESS - 1] || '',    // Line of Business
        row[columnMap.STATE - 1] || '',               // State
        dateReceivedValue,                            // Date file received (EST)
        timeReceivedValue,                            // Time file received (EST)
        dateDeliveredValue,                           // Date file delivered (EST)
        timeDeliveredValue,                           // Time file delivered (EST)
        row[columnMap.SLA_MET - 1] || '',             // SLA MET (Y/N/NA)
        isUrgentValue,                                // isUrgent? (YES/NO for Word, N/A for PDF)
        row[columnMap.QA_DELIVERY_BY - 1] || '',      // QA Delivery by
        row[columnMap.COMMENT - 1] || '',             // Comment
        row[columnMap.STATUS - 1] || '',              // Status
        row[columnMap.INTERNAL - 1] || '',            // Internal
        row[columnMap.DTP_COL1 - 1] || '',            // DTP (first one)
        row[columnMap.NEW - 1] || '',                 // New
        row[columnMap.FUZZY - 1] || '',               // Fuzzy
        row[columnMap.TOTAL - 1] || '',               // Total
        row[columnMap.DTP_COL2 - 1] || '',            // DTP (second one)
        row[columnMap.PM - 1] || '',                  // PM
        row[columnMap.IT_ENG - 1] || '',              // IT eng
        row[columnMap.QA - 1] || ''                   // QA
      ];
      
      extractedRows.push(outputRow);
    });
    
    return extractedRows;
  }
  
  // ===================================================================
  // FORMAT CELL VALUE (HANDLES DATES, NUMBERS, TEXT)
  // ===================================================================
  
  function formatCellValue(value) {
    // Handle empty/null values
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    // Handle Date objects - format as MM/DD/YYYY
    if (value instanceof Date && !isNaN(value.getTime())) {
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      const year = value.getFullYear();
      return `${month}/${day}/${year}`;
    }
    
    // Handle numbers
    if (typeof value === 'number') {
      return value.toString();
    }
    
    // Handle everything else as string
    return String(value);
  }
  
  // ===================================================================
  // FORMAT TIME VALUE (HANDLES TIME COLUMNS IN HH:MM AM/PM FORMAT)
  // ===================================================================
  
  function formatTimeValue(value) {
    // Handle empty/null values
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    // Handle Date objects (time is stored as Date in Google Sheets)
    if (value instanceof Date && !isNaN(value.getTime())) {
      let hours = value.getHours();
      const minutes = String(value.getMinutes()).padStart(2, '0');
      const seconds = String(value.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      // Convert to 12-hour format
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      
      return `${hours}:${minutes}:${seconds} ${ampm}`;
    }
    
    // If it's already a formatted string, return it
    if (typeof value === 'string') {
      // Check if it already looks like a time (contains :)
      if (value.includes(':')) {
        return value;
      }
    }
    
    // Handle numbers
    if (typeof value === 'number') {
      return value.toString();
    }
    
    // Handle everything else as string
    return String(value);
  }
  
  // ===================================================================
  // GENERATE MONTHLY REPORT - MAIN ORCHESTRATION
  // ===================================================================
  
  function generateMonthlyReport(dateField, lowerBoundStr, upperBoundStr, includeEmptyDelivered) {
    const startTime = new Date().getTime();
    
    try {
      Logger.log(`Starting Monthly Report Generation`);
      Logger.log(`Date Field: ${dateField}, Range: ${lowerBoundStr} to ${upperBoundStr}`);
      Logger.log(`Include Empty Delivered: ${includeEmptyDelivered}`);
      
      // Parse date bounds
      const lowerBound = parseDateFromString(lowerBoundStr);
      const upperBound = parseDateFromString(upperBoundStr);
      
      if (!lowerBound || !upperBound) {
        throw new Error('Invalid date format. Please use MM/DD/YYYY format.');
      }
      
      if (lowerBound > upperBound) {
        throw new Error('Lower bound date must be before or equal to upper bound date.');
      }
      
      // Initialize data collection with per-sheet tracking
      const allData = [];
      const sheetBreakdown = []; // Track rows per sheet
      let totalSheets = REPORT_CONFIG.SOURCE_SHEETS.length;
      let currentSheetIndex = 0;
      
      // Process each source sheet
      for (const sourceConfig of REPORT_CONFIG.SOURCE_SHEETS) {
        currentSheetIndex++;
        const sheetStartRowCount = allData.length;
        const sheetStartTime = new Date().getTime();
        
        Logger.log(`Processing Sheet ${currentSheetIndex}/${totalSheets}: ${sourceConfig.name}`);
        
        // Update progress (this will be polled by frontend)
        PropertiesService.getScriptProperties().setProperty('REPORT_PROGRESS', JSON.stringify({
          currentSheet: currentSheetIndex,
          totalSheets: totalSheets,
          currentSheetName: sourceConfig.name,
          currentTabName: 'Opening spreadsheet...',
          startTime: startTime
        }));
        
        try {
          // Open the source spreadsheet
          const sourceSpreadsheet = SpreadsheetApp.openById(sourceConfig.id);
          const allSheets = sourceSpreadsheet.getSheets();
          
          // Filter to only Language Tabs (exclude HOW TO USE and TEMPLATE)
          const languageTabs = allSheets.filter(sheet => {
            const sheetName = sheet.getName();
            return !REPORT_CONFIG.SKIP_SHEETS.includes(sheetName);
          });
          
          Logger.log(`Found ${languageTabs.length} language tabs in ${sourceConfig.name}`);
          
          // Process each Language Tab
          for (const languageTab of languageTabs) {
            const tabName = languageTab.getName();
            
            Logger.log(`  Processing tab: ${tabName}`);
            
            // Update progress with current tab name
            PropertiesService.getScriptProperties().setProperty('REPORT_PROGRESS', JSON.stringify({
              currentSheet: currentSheetIndex,
              totalSheets: totalSheets,
              currentSheetName: sourceConfig.name,
              currentTabName: tabName,
              startTime: startTime
            }));
            
            // Extract data from this tab
            const tabData = extractDataFromLanguageTab(
              languageTab, 
              sourceConfig.template_type, 
              dateField, 
              lowerBound, 
              upperBound, 
              includeEmptyDelivered
            );
            
            Logger.log(`  Extracted ${tabData.length} rows from ${tabName}`);
            
            // Add to master data collection
            allData.push(...tabData);
          }
          
          // Calculate rows added from this sheet
          const rowsFromSheet = allData.length - sheetStartRowCount;
          const sheetElapsedTime = ((new Date().getTime() - sheetStartTime) / 1000).toFixed(1);
          
          Logger.log(`Sheet ${sourceConfig.name} complete: ${rowsFromSheet} rows in ${sheetElapsedTime}s`);
          
          sheetBreakdown.push({
            name: sourceConfig.name,
            count: rowsFromSheet
          });
          
        } catch (error) {
          Logger.log(`Error processing sheet ${sourceConfig.name}: ${error.message}`);
          // Add zero count for failed sheet
          sheetBreakdown.push({
            name: sourceConfig.name,
            count: 0
          });
          // Continue to next sheet rather than failing entirely
        }
      }
      
      Logger.log(`Total rows extracted: ${allData.length}`);
      
      // Create new report tab
      const reportTabName = generateReportTabName(dateField, lowerBoundStr, upperBoundStr);
      const destinationSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      
      // Check if tab already exists
      let reportSheet = destinationSpreadsheet.getSheetByName(reportTabName);
      if (reportSheet) {
        // Delete existing tab
        destinationSpreadsheet.deleteSheet(reportSheet);
      }
      
      // Create new sheet
      reportSheet = destinationSpreadsheet.insertSheet(reportTabName);
      
      // Write headers
      reportSheet.getRange(1, 1, 1, REPORT_CONFIG.OUTPUT_HEADERS.length)
        .setValues([REPORT_CONFIG.OUTPUT_HEADERS])
        .setFontWeight('bold')
        .setBackground('#4285F4')
        .setFontColor('#FFFFFF');
      
      // Write data if any exists
      if (allData.length > 0) {
        reportSheet.getRange(2, 1, allData.length, REPORT_CONFIG.OUTPUT_HEADERS.length)
          .setValues(allData);
        
        // Apply fixed column widths (user-specified, instant execution)
        const columnWidths = [
          130,  // Project number
          750,  // File name
          215,  // Line of Business
          180,  // State
          155,  // Date file received (EST)
          160,  // Time file received (EST)
          160,  // Date file delivered (EST)
          165,  // Time file delivered (EST)
          125,  // SLA MET (Y/N/NA)
          100,  // isUrgent?
          105,  // QA Delivery by
          585,  // Comment
          300,  // Status
          75,   // Internal
          75,   // DTP
          75,   // New
          75,   // Fuzzy
          75,   // Total
          75,   // DTP
          75,   // PM
          75,   // IT eng
          75    // QA
        ];
        
        // Apply column widths (instant - no cell analysis)
        columnWidths.forEach((width, index) => {
          reportSheet.setColumnWidth(index + 1, width);
        });
        
        // Freeze header row
        reportSheet.setFrozenRows(1);
      }
      
      // Calculate elapsed time
      const endTime = new Date().getTime();
      const elapsedSeconds = Math.round((endTime - startTime) / 1000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      const remainingSeconds = elapsedSeconds % 60;
      const elapsedFormatted = `${elapsedMinutes}:${String(remainingSeconds).padStart(2, '0')}`;
      
      // Clear progress
      PropertiesService.getScriptProperties().deleteProperty('REPORT_PROGRESS');
      
      // Activate the new sheet
      destinationSpreadsheet.setActiveSheet(reportSheet);
      
      return {
        success: true,
        message: `✅ Report generated successfully!\n\n📊 Report: "${reportTabName}"\n📝 Total rows: ${allData.length}`,
        tabName: reportTabName,
        totalRows: allData.length,
        elapsedTime: elapsedFormatted,
        elapsedSeconds: elapsedSeconds,
        sheetBreakdown: sheetBreakdown
      };
      
    } catch (error) {
      Logger.log(`ERROR in generateMonthlyReport: ${error.message}`);
      
      // Clear progress on error
      PropertiesService.getScriptProperties().deleteProperty('REPORT_PROGRESS');
      
      return {
        success: false,
        message: `❌ Error: ${error.message}`
      };
    }
  }
  
  // ===================================================================
  // GENERATE REPORT TAB NAME (TIMEZONE-SAFE)
  // ===================================================================
  
  function generateReportTabName(dateField, lowerBoundStr, upperBoundStr) {
    // Convert dates to MM.DD.YYYY format
    const formatDateForTab = (dateStr) => {
      // Parse the date string using our timezone-safe parser
      const date = parseDateFromString(dateStr);
      if (!date || isNaN(date.getTime())) return dateStr;
      
      // Extract components directly (already normalized to local time)
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${month}.${day}.${year}`;
    };
    
    const lowerFormatted = formatDateForTab(lowerBoundStr);
    const upperFormatted = formatDateForTab(upperBoundStr);
    
    return `Letters${dateField}_${lowerFormatted}-${upperFormatted}`;
  }
  
  // ===================================================================
  // GET REPORT PROGRESS (POLLED BY FRONTEND)
  // ===================================================================
  
  function getReportProgress() {
    const progressStr = PropertiesService.getScriptProperties().getProperty('REPORT_PROGRESS');
    
    if (!progressStr) {
      return null;
    }
    
    try {
      return JSON.parse(progressStr);
    } catch (error) {
      return null;
    }
  }