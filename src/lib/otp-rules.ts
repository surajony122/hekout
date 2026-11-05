export const OTP_RULES = {
  ttlMinutes: 5,
  maxAttempts: 5,
  resendSeconds: 30,
  perPhonePer10Min: 3,
  perPhonePerDay: 10,
  perConnectionPer10Min: 5,
  perConnectionPerDay: 20,
  perStorePerHour: 300,
  verifiedHours: 24,
};

export function smsProviderStatus() {
  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) return { name: 'MSG91', live: true };
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) return { name: 'Twilio', live: true };
  if (process.env.OTP_TEST_MODE === 'true') return { name: 'Test mode', live: false };
  return { name: 'Not connected', live: false };
}
