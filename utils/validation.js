import validator from "validator";

export function isValidName(name) {
  return (
    typeof name === "string" && validator.isLength(name, { min: 5, max: 30 })
  );
}

export function isValidEmail(email) {
  return typeof email === "string" && validator.isEmail(email);
}

export function isValidPassword(password) {
  return (
    typeof password === "string" &&
    validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 0,
      minUppercase: 0,
      minNumbers: 0,
      minSymbols: 0,
    })
  );
}

export function isValidPhone(phone) {
  return typeof phone === "string" && validator.isMobilePhone(phone, "any");
}
