// Keep identifiers as strings so leading zeroes survive typing, paste and OTP autofill.
export function digitsOnly(value, limit = Infinity) {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, digit =>
    String(digit.charCodeAt(0) - (digit >= '۰' ? 0x6f0 : 0x660)))
    .replace(/[^0-9]/g, '').slice(0, limit);
}

export function phoneDigits(value) {
  let digits = digitsOnly(value);
  if (digits.startsWith('00972')) digits = '0' + digits.slice(5);
  else if (digits.startsWith('972')) digits = '0' + digits.slice(3);
  return digits.slice(0, 10);
}
