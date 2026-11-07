// Phone-number normalisation and validation.
//
// WHY THIS IS ITS OWN MODULE: a phone number is a SIGN-IN IDENTIFIER here, not
// just a contact field. "0803 000 0000", "+2348030000000" and "08030000000" are
// the same person, and if they are stored as typed then the UNIQUE index on
// profiles.phone does not stop that person registering three times — and the
// second attempt fails with a confusing "already registered" on a number they
// believe is new. Normalising to ONE canonical form before every read and write
// is what makes the uniqueness constraint mean what it says.
//
// Canonical form is E.164 without the plus: 2348030000000.

/** Strip everything that is not a digit, then resolve to 234-prefixed form. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;

  // 0803... / 803... / 234803... / +234803... all become 234803...
  let national: string;
  if (digits.startsWith("234")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;

  // Nigerian mobile numbers are 10 digits after the country code and start
  // with 7, 8 or 9. Anything else is not a number we can deliver to.
  if (!/^[789]\d{9}$/.test(national)) return null;
  return `234${national}`;
}

/** True when `raw` is a usable Nigerian mobile number. */
export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/** Display form for a canonical number: 0803 000 0000. */
export function formatPhone(canonical: string | null | undefined): string {
  if (!canonical) return "";
  const national = canonical.startsWith("234") ? canonical.slice(3) : canonical;
  if (!/^[789]\d{9}$/.test(national)) return canonical;
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}
