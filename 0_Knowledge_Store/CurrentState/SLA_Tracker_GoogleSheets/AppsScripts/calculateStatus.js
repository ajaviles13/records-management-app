/**
 * Calculate Status - Total hours between received and delivered timestamps
 * 
 * Returns the total number of hours based on template type and urgency:
 * - PDF: Consecutive Business Hours (Mon-Fri, 8 AM - 9 PM, Sat/Sun/Holidays closed)
 * - Word + Urgent: Business Hours only (Mon-Sat 8 AM - 9 PM, Sun/Holidays 1 PM - 6 PM)
 * - Word + Regular: Consecutive Hours (Mon-Sat 8 AM - 9 PM, Sun/Holidays 1 PM - 6 PM)
 *
 * @param {string} receivedDate Date file was received (e.g., "12/14/2024")
 * @param {string} receivedTime Time file was received (e.g., "2:30:00 PM")
 * @param {string} deliveredDate Date file was delivered (e.g., "12/15/2024")
 * @param {string} deliveredTime Time file was delivered (e.g., "10:15:00 AM")
 * @param {string} template_type "Word" or "PDF"
 * @param {string} isUrgent "YES" for urgent, "NO" for regular (required for Word, ignored for PDF)
 * @return {string} Total hours with label (e.g., "14.5 Business Hours" or "20.3 Consecutive Hours")
 * @customfunction
 */
function calculateStatus(receivedDate, receivedTime, deliveredDate, deliveredTime, template_type, isUrgent) {
  
    // ===================================================================
    // STEP 1: Validate Inputs
    // ===================================================================
    
    // Check for missing timestamps
    const hasReceivedDate = receivedDate && String(receivedDate).trim() !== "";
    const hasReceivedTime = receivedTime && String(receivedTime).trim() !== "";
    const hasDeliveredDate = deliveredDate && String(deliveredDate).trim() !== "";
    const hasDeliveredTime = deliveredTime && String(deliveredTime).trim() !== "";
    
    // Return specific messages based on what's missing
    if (!hasReceivedDate && !hasReceivedTime && !hasDeliveredDate && !hasDeliveredTime) {
      return "Awaiting Received and Delivered timestamps.";
    }
    if (!hasReceivedDate || !hasReceivedTime) {
      return "Awaiting Received timestamp.";
    }
    if (!hasDeliveredDate || !hasDeliveredTime) {
      return "Awaiting Delivered timestamp.";
    }
    
    // Validate template_type
    template_type = String(template_type).trim();
    if (template_type !== "Word" && template_type !== "PDF") {
      return "The 'template_type' parameter must be either 'Word' or 'PDF'";
    }
    
    // Validate isUrgent for Word templates
    if (template_type === "Word") {
      if (!isUrgent || String(isUrgent).trim() === "") {
        return "isUrgent cell must be set to 'YES' or 'NO'";
      }
      isUrgent = String(isUrgent).trim().toUpperCase();
      if (isUrgent !== "YES" && isUrgent !== "NO") {
        return "isUrgent cell must be set to 'YES' or 'NO'";
      }
    }
    
    // ===================================================================
    // STEP 2: Read Holiday Range (Hardcoded)
    // ===================================================================
    
    const HOLIDAY_SHEET_NAME = 'ℹ️ HOW TO USE';
    const HOLIDAY_RANGE = 'A40:A51';
    
    let holidayRange = [];
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const holidaySheet = ss.getSheetByName(HOLIDAY_SHEET_NAME);
      if (holidaySheet) {
        holidayRange = holidaySheet.getRange(HOLIDAY_RANGE).getValues();
      }
    } catch (error) {
      // If holiday sheet/range not found, continue with empty holidays
      Logger.log('Holiday range not found, continuing without holidays');
    }
    
    // ===================================================================
    // STEP 3: Parse DateTime Objects
    // ===================================================================
    
    try {
      let receivedDateTime, deliveredDateTime;
      
      // Get the spreadsheet's timezone to extract literal values
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const timezone = ss.getSpreadsheetTimeZone();
      
      // Handle receivedDate and receivedTime
      if (receivedDate instanceof Date && receivedTime instanceof Date) {
        // Extract literal values as displayed in the spreadsheet
        const dateStr = Utilities.formatDate(receivedDate, timezone, 'MM/dd/yyyy');
        const timeStr = Utilities.formatDate(receivedTime, timezone, 'HH:mm:ss');
        receivedDateTime = new Date(`${dateStr} ${timeStr}`);
      } else {
        const receivedDateStr = String(receivedDate).trim();
        const receivedTimeStr = String(receivedTime).trim();
        receivedDateTime = new Date(`${receivedDateStr} ${receivedTimeStr}`);
      }
      
      // Handle deliveredDate and deliveredTime
      if (deliveredDate instanceof Date && deliveredTime instanceof Date) {
        // Extract literal values as displayed in the spreadsheet
        const dateStr = Utilities.formatDate(deliveredDate, timezone, 'MM/dd/yyyy');
        const timeStr = Utilities.formatDate(deliveredTime, timezone, 'HH:mm:ss');
        deliveredDateTime = new Date(`${dateStr} ${timeStr}`);
      } else {
        const deliveredDateStr = String(deliveredDate).trim();
        const deliveredTimeStr = String(deliveredTime).trim();
        deliveredDateTime = new Date(`${deliveredDateStr} ${deliveredTimeStr}`);
      }
      
      // Validate parsed dates
      if (isNaN(receivedDateTime.getTime()) || isNaN(deliveredDateTime.getTime())) {
        return "Invalid date or time format";
      }
      
      // Check if delivered is before received
      if (deliveredDateTime < receivedDateTime) {
        return "Delivered timestamp cannot be before Received timestamp";
      }
      
      // ===================================================================
      // STEP 4: Parse Holiday Range
      // ===================================================================
      
      const holidays = parseHolidayRangeStatus(holidayRange);
      
      // ===================================================================
      // STEP 5: Calculate Hours Based on Template Type
      // ===================================================================
      
      let totalHours = 0;
      let hoursLabel = "";
      
      if (template_type === "PDF") {
        // PDF: Consecutive Business Hours
        totalHours = PDF_BusinessHours(receivedDateTime, deliveredDateTime, holidays);
        hoursLabel = "Consecutive Business Hours";
      } else if (template_type === "Word" && isUrgent === "YES") {
        // Word + Urgent: Business Hours Only
        totalHours = Word_UrgentHours(receivedDateTime, deliveredDateTime, holidays);
        hoursLabel = "Business Hours";
      } else {
        // Word + Regular: Consecutive Hours
        totalHours = Word_RegularHours(receivedDateTime, deliveredDateTime, holidays);
        hoursLabel = "Consecutive Hours";
      }
      
      // Format with one decimal place
      return `${totalHours.toFixed(2)} ${hoursLabel}`;
      
    } catch (error) {
      // Logger.log(`calculateStatus error: ${error.message}`);
      return "Error calculating status";
    }
  }
  
  // ===================================================================
  // PDF_BusinessHours - CONSECUTIVE HOURS ON BUSINESS DAYS
  // Business Days: Mon-Fri, 8 AM - 9 PM
  // Closed: Sat/Sun/Holidays
  // Counts: CONSECUTIVE hours (24 hrs/day for full business days)
  // ===================================================================
  
  function PDF_BusinessHours(receivedDateTime, deliveredDateTime, holidays) {
    const BUSINESS_START = 8;   // 8 AM
    const BUSINESS_END = 21;    // 9 PM
    
    let totalHours = 0;
    let currentTime = new Date(receivedDateTime.getTime());
    let isFirstDay = true; // Track if this is the first day (received day)
    let hasStartedCounting = false; // Track if we've reached first eligible business hours
    
    // Logger.log(`=== Starting PDF_BusinessHours ===`);
    // Logger.log(`Received: ${receivedDateTime.toString()}`);
    // Logger.log(`Delivered: ${deliveredDateTime.toString()}`);
    
    // Safety counter
    let dayCounter = 0;
    const MAX_DAYS = 365;
    
    while (currentTime < deliveredDateTime && dayCounter < MAX_DAYS) {
      dayCounter++;
      
      const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 6 = Saturday
      const isHoliday = isHolidayDate(currentTime, holidays);
      const isBusinessDay = (dayOfWeek >= 1 && dayOfWeek <= 5) && !isHoliday;
      
      // Logger.log(`\n--- Day ${dayCounter}: ${currentTime.toDateString()} ---`);
      // Logger.log(`Day of week: ${dayOfWeek}, Is holiday: ${isHoliday}, Is business day: ${isBusinessDay}, Is first day: ${isFirstDay}, Has started counting: ${hasStartedCounting}`);
      
      // Skip non-business days (Sat/Sun/Holidays)
      if (!isBusinessDay) {
        // Logger.log(`Non-business day - skipping`);
        currentTime.setDate(currentTime.getDate() + 1);
        currentTime.setHours(0, 0, 0, 0);
        isFirstDay = false; // No longer first day after advancing
        continue;
      }
      
      // This is a business day (Mon-Fri, not a holiday)
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentSecond = currentTime.getSeconds();
      
      // Logger.log(`Current time: ${currentHour}:${currentMinute}:${currentSecond}`);
      
      // Determine start time for counting
      let dayStartTime;
      
      if (isFirstDay) {
        // First day logic: Apply 8 AM rule if received outside business hours
        if (currentHour < BUSINESS_START) {
          // Before 8 AM - start at 8 AM
          dayStartTime = new Date(currentTime.getTime());
          dayStartTime.setHours(BUSINESS_START, 0, 0, 0);
          hasStartedCounting = true; // Mark that we've started
          // Logger.log(`First day, before business hours, starting count at ${BUSINESS_START}:00 AM`);
        } else if (currentHour >= BUSINESS_END) {
          // After business hours - move to next day
          // Logger.log(`First day, after business hours, moving to next day`);
          currentTime.setDate(currentTime.getDate() + 1);
          currentTime.setHours(0, 0, 0, 0);
          isFirstDay = false;
          continue;
        } else {
          // Within business hours - start counting now
          dayStartTime = new Date(currentTime.getTime());
          hasStartedCounting = true; // Mark that we've started
          // Logger.log(`First day, within business hours, starting count now`);
        }
      } else if (!hasStartedCounting) {
        // Haven't started counting yet (received outside business hours on holiday/weekend)
        // This is the first eligible business day - start at 8 AM
        dayStartTime = new Date(currentTime.getTime());
        dayStartTime.setHours(BUSINESS_START, 0, 0, 0);
        hasStartedCounting = true; // Mark that we've started
        // Logger.log(`First business day after receiving outside hours, starting at ${BUSINESS_START}:00 AM`);
      } else {
        // Subsequent full business days: Start at midnight (0:00)
        if (currentHour === 0 && currentMinute === 0 && currentSecond === 0) {
          // At midnight - start counting from midnight for full 24-hour day
          dayStartTime = new Date(currentTime.getTime());
          // Logger.log(`Full business day, starting count at midnight (0:00)`);
        } else {
          // This shouldn't happen in normal flow, but handle it
          dayStartTime = new Date(currentTime.getTime());
          // Logger.log(`Mid-day on subsequent business day, starting now`);
        }
      }
      
      // Determine end time for this day (midnight = end of consecutive counting day)
      let dayEndTime = new Date(currentTime.getTime());
      dayEndTime.setDate(dayEndTime.getDate() + 1);
      dayEndTime.setHours(0, 0, 0, 0); // Midnight of next day
      
      // If delivered on same day, use delivered time as end
      if (isSameDayStatus(currentTime, deliveredDateTime)) {
        // Logger.log(`Same day as delivery`);
        dayEndTime = new Date(deliveredDateTime.getTime());
      }
      
      // Calculate consecutive hours for this day
      const startMs = dayStartTime.getTime();
      const endMs = Math.min(dayEndTime.getTime(), deliveredDateTime.getTime());
      
      // Logger.log(`Start time: ${new Date(startMs).toString()}`);
      // Logger.log(`End time: ${new Date(endMs).toString()}`);
      
      if (endMs > startMs) {
        const hoursThisDay = (endMs - startMs) / (1000 * 60 * 60);
        totalHours += hoursThisDay;
        // Logger.log(`Consecutive hours for this day: ${hoursThisDay.toFixed(2)}`);
        // Logger.log(`Total so far: ${totalHours.toFixed(2)}`);
      } else {
        // Logger.log(`No hours counted (endMs <= startMs)`);
      }
      
      // Move to next day
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(0, 0, 0, 0);
      isFirstDay = false; // After first iteration, no longer first day
    }
    
    // Logger.log(`\n=== Final total: ${totalHours.toFixed(2)} consecutive business hours ===`);
    return totalHours;
  }
  
  // ===================================================================
  // Word_RegularHours - CONSECUTIVE HOURS
  // Business Days: Mon-Sat 8 AM - 9 PM, Sun/Holidays 1 PM - 6 PM
  // Counts: CONSECUTIVE hours (24 hrs/day for Mon-Sat, window hours for Sun/Holidays)
  // ===================================================================
  
  function Word_RegularHours(receivedDateTime, deliveredDateTime, holidays) {
    const WEEKDAY_START = 8;      // 8 AM (Mon-Sat)
    const WEEKDAY_END = 21;       // 9 PM (Mon-Sat)
    const SUNDAY_START = 13;      // 1 PM (Sun/Holidays)
    const SUNDAY_END = 18;        // 6 PM (Sun/Holidays)
    const SLA_CAP = 24.0;         // 24-hour SLA cap
    
    let totalHours = 0;
    let currentTime = new Date(receivedDateTime.getTime());
    let isFirstDay = true; // Track if this is the first day (received day)
    let hasStartedCounting = false; // Track if we've started counting hours (reached first business start)
    let isFrozen = false;  // Track if counter is frozen at 24-hour cap
    let nextBusinessStart = null; // Track when to unfreeze
    
    // Logger.log(`=== Starting Word_RegularHours ===`);
    // Logger.log(`Received: ${receivedDateTime.toString()}`);
    // Logger.log(`Delivered: ${deliveredDateTime.toString()}`);
    
    // Safety counter
    let dayCounter = 0;
    const MAX_DAYS = 365;
    
    while (currentTime < deliveredDateTime && dayCounter < MAX_DAYS) {
      dayCounter++;
      
      const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 6 = Saturday
      const isHoliday = isHolidayDate(currentTime, holidays);
      const isSundayOrHoliday = (dayOfWeek === 0) || isHoliday;
      
      // Logger.log(`\n--- Day ${dayCounter}: ${currentTime.toDateString()} ---`);
      // Logger.log(`Day of week: ${dayOfWeek}, Is holiday: ${isHoliday}, Is Sunday/Holiday: ${isSundayOrHoliday}, Is first day: ${isFirstDay}, Has started counting: ${hasStartedCounting}`);
      // Logger.log(`Is frozen: ${isFrozen}, Total hours so far: ${totalHours.toFixed(2)}`);
      
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentSecond = currentTime.getSeconds();
      
      // Logger.log(`Current time: ${currentHour}:${currentMinute}:${currentSecond}`);
      
      let dayStartTime, dayEndTime, businessStart, businessEnd;
      let isInsideBusinessHours = false;
      
      if (isSundayOrHoliday) {
        // Sunday or Holiday: Business hours 1 PM - 6 PM
        // BUT for consecutive counting, count ALL hours from midnight
        businessStart = SUNDAY_START;
        businessEnd = SUNDAY_END;
        // Logger.log(`Sunday/Holiday - Business hours: ${businessStart}:00 - ${businessEnd}:00`);
        
        // Check if we're inside business hours (for freeze logic)
        isInsideBusinessHours = (currentHour >= businessStart && currentHour < businessEnd);
        
        if (isFirstDay) {
          // First day logic - only start counting when business opens
          if (currentHour < businessStart) {
            // Before 1 PM - start at 1 PM
            dayStartTime = new Date(currentTime.getTime());
            dayStartTime.setHours(businessStart, 0, 0, 0);
            hasStartedCounting = true; // Mark that we've started
            // Logger.log(`First day, before business start, starting at ${businessStart}:00`);
          } else if (currentHour >= businessEnd) {
            // After 6 PM - move to next day
            // Logger.log(`First day, after business end, moving to next day`);
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
            isFirstDay = false;
            continue;
          } else {
            // Within 1 PM - 6 PM window
            dayStartTime = new Date(currentTime.getTime());
            hasStartedCounting = true; // Mark that we've started
            // Logger.log(`First day, within business window, starting now`);
          }
        } else if (!hasStartedCounting) {
          // Haven't started counting yet (received outside business hours)
          // Wait until business start time
          dayStartTime = new Date(currentTime.getTime());
          dayStartTime.setHours(businessStart, 0, 0, 0);
          hasStartedCounting = true; // Mark that we've started
          // Logger.log(`First business start after receiving outside hours, starting at ${businessStart}:00`);
        } else {
          // Subsequent Sunday/Holiday: Count consecutive hours from midnight (Option A)
          if (currentHour === 0 && currentMinute === 0 && currentSecond === 0) {
            dayStartTime = new Date(currentTime.getTime());
            // Logger.log(`Subsequent Sunday/Holiday, counting consecutive from midnight (0:00)`);
          } else {
            dayStartTime = new Date(currentTime.getTime());
            // Logger.log(`Mid-day on subsequent Sunday/Holiday, starting now`);
          }
        }
        
        // End time is midnight (consecutive hours for Sun/Holiday, Option A)
        dayEndTime = new Date(currentTime.getTime());
        dayEndTime.setDate(dayEndTime.getDate() + 1);
        dayEndTime.setHours(0, 0, 0, 0);
        
      } else {
        // Monday-Saturday: 8 AM - 9 PM (count consecutive hours = 24 hrs for full days)
        businessStart = WEEKDAY_START;
        businessEnd = WEEKDAY_END;
        // Logger.log(`Mon-Sat hours: ${businessStart}:00 - ${businessEnd}:00`);
        
        // Check if we're inside business hours
        isInsideBusinessHours = (currentHour >= businessStart && currentHour < businessEnd);
        
        if (isFirstDay) {
          // First day logic
          if (currentHour < businessStart) {
            // Before 8 AM - start at 8 AM
            dayStartTime = new Date(currentTime.getTime());
            dayStartTime.setHours(businessStart, 0, 0, 0);
            hasStartedCounting = true; // Mark that we've started
            // Logger.log(`First day, before business start, starting at ${businessStart}:00`);
          } else if (currentHour >= businessEnd) {
            // After 9 PM - move to next day
            // Logger.log(`First day, after business end, moving to next day`);
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
            isFirstDay = false;
            continue;
          } else {
            // Within business hours
            dayStartTime = new Date(currentTime.getTime());
            hasStartedCounting = true; // Mark that we've started
            // Logger.log(`First day, within business hours, starting now`);
          }
        } else if (!hasStartedCounting) {
          // Haven't started counting yet (received outside business hours)
          // Wait until business start time
          dayStartTime = new Date(currentTime.getTime());
          dayStartTime.setHours(businessStart, 0, 0, 0);
          hasStartedCounting = true; // Mark that we've started
          // Logger.log(`First business start after receiving outside hours, starting at ${businessStart}:00`);
        } else {
          // Subsequent full Mon-Sat business days: Start at midnight for consecutive counting
          if (currentHour === 0 && currentMinute === 0 && currentSecond === 0) {
            dayStartTime = new Date(currentTime.getTime());
            // Logger.log(`Full Mon-Sat business day, starting at midnight (0:00)`);
          } else {
            dayStartTime = new Date(currentTime.getTime());
            // Logger.log(`Mid-day on subsequent business day, starting now`);
          }
        }
        
        // End time is midnight (consecutive hours for Mon-Sat)
        dayEndTime = new Date(currentTime.getTime());
        dayEndTime.setDate(dayEndTime.getDate() + 1);
        dayEndTime.setHours(0, 0, 0, 0);
      }
      
      // If delivered on same day, use delivered time as end
      if (isSameDayStatus(currentTime, deliveredDateTime)) {
        // Logger.log(`Same day as delivery`);
        dayEndTime = new Date(deliveredDateTime.getTime());
      }
      
      // Calculate consecutive hours for this day
      const startMs = dayStartTime.getTime();
      const endMs = Math.min(dayEndTime.getTime(), deliveredDateTime.getTime());
      
      // Logger.log(`Start time: ${new Date(startMs).toString()}`);
      // Logger.log(`End time: ${new Date(endMs).toString()}`);
      
      if (endMs > startMs) {
        const hoursThisDay = (endMs - startMs) / (1000 * 60 * 60);
        
        // Check if adding these hours would exceed the SLA cap
        if (totalHours + hoursThisDay >= SLA_CAP) {
          // Logger.log(`SLA CAP CHECK: Total would be ${(totalHours + hoursThisDay).toFixed(2)} hours`);
          
          // Calculate exact time when we hit 24 hours
          const hoursNeeded = SLA_CAP - totalHours;
          const freezeTimeMs = startMs + (hoursNeeded * 60 * 60 * 1000);
          const freezeTime = new Date(freezeTimeMs);
          
          // Logger.log(`Would hit ${SLA_CAP} hours at: ${freezeTime.toString()}`);
          
          // Check if freeze time is inside or outside business hours
          const freezeHour = freezeTime.getHours();
          const freezeDay = freezeTime.getDay();
          const freezeIsHoliday = isHolidayDate(freezeTime, holidays);
          const freezeIsSundayOrHoliday = (freezeDay === 0) || freezeIsHoliday;
          
          let freezeIsInsideBusinessHours;
          if (freezeIsSundayOrHoliday) {
            freezeIsInsideBusinessHours = (freezeHour >= SUNDAY_START && freezeHour < SUNDAY_END);
          } else {
            freezeIsInsideBusinessHours = (freezeHour >= WEEKDAY_START && freezeHour < WEEKDAY_END);
          }
          
          // Logger.log(`At freeze point: freezeHour=${freezeHour}, isSunday/Holiday=${freezeIsSundayOrHoliday}, isInsideBusinessHours=${freezeIsInsideBusinessHours}`);
          
          // Only freeze if we hit 24 hours OUTSIDE business hours
          if (!freezeIsInsideBusinessHours) {
            // Logger.log(`Hit ${SLA_CAP} hours OUTSIDE business hours - FREEZE triggered`);
            
            // Check if delivery happens before we hit the freeze point
            if (deliveredDateTime <= freezeTime) {
              // Delivered before freeze point, count normally
              totalHours += hoursThisDay;
              // Logger.log(`Delivered before freeze point, counting ${hoursThisDay.toFixed(2)} hours`);
            } else {
              // We hit the freeze point
              totalHours = SLA_CAP;
              isFrozen = true;
              
              // Calculate next business start time for unfreeze
              let unfreezeTime = new Date(freezeTime.getTime());
              
              // Find the next business start
              let searchAttempts = 0;
              while (searchAttempts < 10) {
                searchAttempts++;
                const unfreezeDay = unfreezeTime.getDay();
                const unfreezeIsHoliday = isHolidayDate(unfreezeTime, holidays);
                const unfreezeIsSundayOrHoliday = (unfreezeDay === 0) || unfreezeIsHoliday;
                const unfreezeHour = unfreezeTime.getHours();
                
                // Check if we're already at or past a business start time
                if (unfreezeIsSundayOrHoliday) {
                  if (unfreezeHour < SUNDAY_START) {
                    // Before Sunday/Holiday start, set to 1:00:01 PM today
                    unfreezeTime.setHours(SUNDAY_START, 0, 1, 0);
                    nextBusinessStart = unfreezeTime;
                    break;
                  } else {
                    // After Sunday/Holiday hours, move to next day
                    unfreezeTime.setDate(unfreezeTime.getDate() + 1);
                    unfreezeTime.setHours(0, 0, 0, 0);
                  }
                } else {
                  if (unfreezeHour < WEEKDAY_START) {
                    // Before weekday start, set to 8:00:01 AM today
                    unfreezeTime.setHours(WEEKDAY_START, 0, 1, 0);
                    nextBusinessStart = unfreezeTime;
                    break;
                  } else {
                    // After weekday hours, move to next day
                    unfreezeTime.setDate(unfreezeTime.getDate() + 1);
                    unfreezeTime.setHours(0, 0, 0, 0);
                  }
                }
              }
              
              // Logger.log(`FROZEN at ${SLA_CAP} hours. Next business start: ${nextBusinessStart.toString()}`);
              
              // Check if delivered before or after unfreeze
              if (deliveredDateTime < nextBusinessStart) {
                // Delivered before unfreeze, return frozen value
                // Logger.log(`Delivered while frozen. Returning frozen value: ${SLA_CAP}`);
                return SLA_CAP;
              } else {
                // Delivered after unfreeze, calculate actual elapsed time
                // Logger.log(`Delivered after unfreeze at ${nextBusinessStart.toString()}`);
                // Logger.log(`Calculating actual elapsed time from received to delivered`);
                
                const actualElapsedMs = deliveredDateTime.getTime() - receivedDateTime.getTime();
                const actualElapsedHours = actualElapsedMs / (1000 * 60 * 60);
                
                // Logger.log(`Actual elapsed time: ${actualElapsedHours.toFixed(2)} hours`);
                return actualElapsedHours;
              }
            }
          } else {
            // Hit 24 hours INSIDE business hours - no freeze, count normally
            // Logger.log(`Hit ${SLA_CAP} hours INSIDE business hours - no freeze, continue counting`);
            totalHours += hoursThisDay;
            // Logger.log(`Consecutive hours for this day: ${hoursThisDay.toFixed(2)}`);
            // Logger.log(`Total so far: ${totalHours.toFixed(2)}`);
          }
        } else {
          // Normal counting
          totalHours += hoursThisDay;
          // Logger.log(`Consecutive hours for this day: ${hoursThisDay.toFixed(2)}`);
          // Logger.log(`Total so far: ${totalHours.toFixed(2)}`);
        }
      } else {
        // Logger.log(`No hours counted (endMs <= startMs)`);
      }
      
      // Move to next day
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(0, 0, 0, 0);
      isFirstDay = false; // After first iteration, no longer first day
    }
    
    // Logger.log(`\n=== Final total: ${totalHours.toFixed(2)} consecutive hours ===`);
    return totalHours;
  }
  
  // ===================================================================
  // Word_UrgentHours - BUSINESS HOURS ONLY (NOT CONSECUTIVE)
  // Business Days: Mon-Sat 8 AM - 9 PM, Sun/Holidays 1 PM - 6 PM
  // Counts: ONLY actual business hours (no overnight/consecutive)
  // ===================================================================
  
  function Word_UrgentHours(receivedDateTime, deliveredDateTime, holidays) {
    const WEEKDAY_START = 8;      // 8 AM (Mon-Sat)
    const WEEKDAY_END = 21;       // 9 PM (Mon-Sat)
    const SUNDAY_START = 13;      // 1 PM (Sun/Holidays)
    const SUNDAY_END = 18;        // 6 PM (Sun/Holidays)
    
    let totalHours = 0;
    let currentTime = new Date(receivedDateTime.getTime());
    let isFirstDay = true; // Track if this is the first day (received day)
    
    // Logger.log(`=== Starting Word_UrgentHours ===`);
    // Logger.log(`Received: ${receivedDateTime.toString()}`);
    // Logger.log(`Delivered: ${deliveredDateTime.toString()}`);
    
    // Safety counter
    let dayCounter = 0;
    const MAX_DAYS = 365;
    
    while (currentTime < deliveredDateTime && dayCounter < MAX_DAYS) {
      dayCounter++;
      
      const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 6 = Saturday
      const isHoliday = isHolidayDate(currentTime, holidays);
      const isSundayOrHoliday = (dayOfWeek === 0) || isHoliday;
      
      // Logger.log(`\n--- Day ${dayCounter}: ${currentTime.toDateString()} ---`);
      // Logger.log(`Day of week: ${dayOfWeek}, Is holiday: ${isHoliday}, Is Sunday/Holiday: ${isSundayOrHoliday}, Is first day: ${isFirstDay}`);
      
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentSecond = currentTime.getSeconds();
      
      // Logger.log(`Current time: ${currentHour}:${currentMinute}:${currentSecond}`);
      
      let dayStartTime, dayEndTime, businessStart, businessEnd;
      
      if (isSundayOrHoliday) {
        // Sunday or Holiday: 1 PM - 6 PM
        businessStart = SUNDAY_START;
        businessEnd = SUNDAY_END;
        // Logger.log(`Sunday/Holiday business hours: ${businessStart}:00 - ${businessEnd}:00`);
        
        if (isFirstDay) {
          // First day logic
          if (currentHour < businessStart) {
            // Before 1 PM - start at 1 PM
            dayStartTime = new Date(currentTime.getTime());
            dayStartTime.setHours(businessStart, 0, 0, 0);
            // Logger.log(`First day, before business start, starting at ${businessStart}:00`);
          } else if (currentHour >= businessEnd) {
            // After 6 PM - move to next day
            // Logger.log(`First day, after business end, moving to next day`);
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
            isFirstDay = false;
            continue;
          } else {
            // Within 1 PM - 6 PM window
            dayStartTime = new Date(currentTime.getTime());
            // Logger.log(`First day, within business hours, starting now`);
          }
        } else {
          // Subsequent days: Start at business start (1 PM)
          dayStartTime = new Date(currentTime.getTime());
          dayStartTime.setHours(businessStart, 0, 0, 0);
          // Logger.log(`Subsequent day, starting at business start ${businessStart}:00`);
        }
        
        // End time is 6 PM same day
        dayEndTime = new Date(currentTime.getTime());
        dayEndTime.setHours(businessEnd, 0, 0, 0);
        
      } else {
        // Monday-Saturday: 8 AM - 9 PM
        businessStart = WEEKDAY_START;
        businessEnd = WEEKDAY_END;
        // Logger.log(`Mon-Sat business hours: ${businessStart}:00 - ${businessEnd}:00`);
        
        if (isFirstDay) {
          // First day logic
          if (currentHour < businessStart) {
            // Before 8 AM - start at 8 AM
            dayStartTime = new Date(currentTime.getTime());
            dayStartTime.setHours(businessStart, 0, 0, 0);
            // Logger.log(`First day, before business start, starting at ${businessStart}:00`);
          } else if (currentHour >= businessEnd) {
            // After 9 PM - move to next day
            // Logger.log(`First day, after business end, moving to next day`);
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
            isFirstDay = false;
            continue;
          } else {
            // Within business hours
            dayStartTime = new Date(currentTime.getTime());
            // Logger.log(`First day, within business hours, starting now`);
          }
        } else {
          // Subsequent days: Start at business start (8 AM)
          dayStartTime = new Date(currentTime.getTime());
          dayStartTime.setHours(businessStart, 0, 0, 0);
          // Logger.log(`Subsequent day, starting at business start ${businessStart}:00`);
        }
        
        // End time is 9 PM same day (business hours only, not consecutive)
        dayEndTime = new Date(currentTime.getTime());
        dayEndTime.setHours(businessEnd, 0, 0, 0);
      }
      
      // If delivered on same day, use delivered time as end
      if (isSameDayStatus(currentTime, deliveredDateTime)) {
        // Logger.log(`Same day as delivery`);
        dayEndTime = new Date(Math.min(deliveredDateTime.getTime(), dayEndTime.getTime()));
      }
      
      // Calculate business hours for this day (only hours within business window)
      const startMs = dayStartTime.getTime();
      const endMs = Math.min(dayEndTime.getTime(), deliveredDateTime.getTime());
      
      // Logger.log(`Start time: ${new Date(startMs).toString()}`);
      // Logger.log(`End time: ${new Date(endMs).toString()}`);
      
      if (endMs > startMs) {
        const hoursThisDay = (endMs - startMs) / (1000 * 60 * 60);
        totalHours += hoursThisDay;
        // Logger.log(`Business hours for this day: ${hoursThisDay.toFixed(2)}`);
        // Logger.log(`Total so far: ${totalHours.toFixed(2)}`);
      } else {
        // Logger.log(`No hours counted (endMs <= startMs)`);
      }
      
      // Move to next day
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(0, 0, 0, 0);
      isFirstDay = false; // After first iteration, no longer first day
    }
    
    // Logger.log(`\n=== Final total: ${totalHours.toFixed(2)} business hours ===`);
    return totalHours;
  }
  
  // ===================================================================
  // HELPER: Check if date is a holiday
  // ===================================================================
  
  function isHolidayDate(date, holidays) {
    const dateString = formatDateForComparisonStatus(date);
    
    for (let i = 0; i < holidays.length; i++) {
      if (holidays[i] === dateString) {
        return true;
      }
    }
    
    return false;
  }
  
  // ===================================================================
  // HELPER: Check if two dates are the same day
  // ===================================================================
  
  function isSameDayStatus(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
  
  // ===================================================================
  // HELPER: Format date for comparison (MM/DD/YYYY)
  // ===================================================================
  
  function formatDateForComparisonStatus(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
  
  // ===================================================================
  // PARSE HOLIDAY RANGE FROM INPUT PARAMETER
  // ===================================================================
  
  function parseHolidayRangeStatus(holidayRange) {
    try {
      if (!holidayRange) {
        return [];
      }
      
      const holidays = [];
      
      if (Array.isArray(holidayRange)) {
        for (let i = 0; i < holidayRange.length; i++) {
          let cellValue;
          
          if (Array.isArray(holidayRange[i])) {
            cellValue = holidayRange[i][0];
          } else {
            cellValue = holidayRange[i];
          }
          
          if (!cellValue) continue;
          
          if (cellValue instanceof Date) {
            // Use getUTC methods to extract date components from Google Sheets dates
            const month = String(cellValue.getUTCMonth() + 1).padStart(2, '0');
            const day = String(cellValue.getUTCDate()).padStart(2, '0');
            const year = cellValue.getUTCFullYear();
            holidays.push(`${month}/${day}/${year}`);
          } else if (typeof cellValue === 'string') {
            const parsedDate = new Date(cellValue);
            if (!isNaN(parsedDate.getTime())) {
              const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
              const day = String(parsedDate.getUTCDate()).padStart(2, '0');
              const year = parsedDate.getUTCFullYear();
              holidays.push(`${month}/${day}/${year}`);
            }
          }
        }
      } else if (holidayRange instanceof Date) {
        const month = String(holidayRange.getUTCMonth() + 1).padStart(2, '0');
        const day = String(holidayRange.getUTCDate()).padStart(2, '0');
        const year = holidayRange.getUTCFullYear();
        holidays.push(`${month}/${day}/${year}`);
      }
      
      // Logger.log(`Parsed holidays: ${holidays.join(', ')}`);
      return holidays;
      
    } catch (error) {
      // Logger.log(`Error parsing holiday range: ${error.message}`);
      return [];
    }
  }