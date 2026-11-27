/**
 * "tel:" link for a printed phone number, or undefined when the number is a
 * placeholder like "1800-XXX-XXXX" — stripping the X's would dial "1800".
 */
export function telHref(number: string): string | undefined {
  if (/[a-z]/i.test(number)) return undefined;
  const digits = number.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 3 ? `tel:${digits}` : undefined;
}
