/**
 * Calculate SLA Compliance based on the output of calculateStatus.gs.
 * * Determines if a file delivery meets SLA requirements by leveraging the
 * pre-calculated hours from the 'status_column'.
 *
 * @param {string} template_type The template type: "Word" or "PDF".
 * @param {string} isUrgent_column "YES" or "NO" (only used for Word template).
 * @param {string} status_column The output string from calculateStatus (e.g., "10.0 Business Hours").
 * @return {string} "Y" if SLA met, "N" if SLA not met, "NA" if data is missing/invalid.
 * @customfunction
 */
function calculateSLA(template_type, isUrgent_column, status_column) {

  // ===================================================================
  // STEP 1: Validate Input and Standardize
  // ===================================================================
  if (!template_type || !status_column) {
    return "NA";
  }

  const template = String(template_type).trim().toUpperCase();
  const status = String(status_column).trim();
  // Removed duplicate line: const isUrgent = String(isUrgent_column || "").trim().toUpperCase();
  const isUrgent = String(isUrgent_column || "").trim().toUpperCase();

  // ===================================================================
  // STEP 2: Parse Hours from the Status String
  // ===================================================================
  // Regex to find the first sequence of digits, optionally followed by a decimal point and more digits.
  const hourMatch = status.match(/(\d+\.?\d*)/);

  if (!hourMatch || hourMatch.length < 2) {
    // THIS IS THE CRITICAL LOGIC: If no number is found, it returns "NA".
    return "NA";
  }

  const hour_difference = parseFloat(hourMatch[1]);
  
  // Also catches strings like "Inf" or other non-standard numeric returns from the regex.
  if (isNaN(hour_difference)) {
    return "NA";
  }

  // ===================================================================
  // STEP 3: Apply SLA Compliance Rules
  // ===================================================================

  let sla_threshold; // In hours

  switch (template) {
    case "WORD":
      // Rule 1: Word Urgent (YES) - 6 hours
      if (isUrgent === "YES") {
        sla_threshold = 6;
      } 
      // Rule 2: Word Regular (NO) - 24 hours
      else if (isUrgent === "NO") {
        sla_threshold = 24;
      } 
      // Rule 3: Word with Invalid/Missing Urgency - Return "NA"
      else {
        return "NA";
      }
      break;

    case "PDF":
      // Rule 4: PDF - 60 hours
      sla_threshold = 60;
      break;

    default:
      // Invalid Template Type
      return "NA";
  }

  // ===================================================================
  // STEP 4: Final Compliance Check
  // ===================================================================
  
  // Return "Y" if the total hours are less than or equal to the required threshold.
  return hour_difference <= sla_threshold ? "Y" : "N";
}