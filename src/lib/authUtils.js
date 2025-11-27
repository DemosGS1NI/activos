// Utility for login delay calculation
export function getLoginDelay(failedAttempts) {
  return Math.min(failedAttempts * 500, 5000);
}
