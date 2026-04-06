/**
 * Client Profile Validation Utilities
 * Ensures all client profile data meets business and safety requirements
 */

const VALIDATION_RULES = {
  age: {
    min: 1,
    max: 120,
    message: "Age must be between 1 and 120 years",
  },
  heightCm: {
    min: 50,
    max: 300,
    message: "Height must be between 50cm and 300cm",
  },
  weightKg: {
    min: 1,
    max: 500,
    message: "Weight must be between 1kg and 500kg",
  },
  fitnessGoal: {
    pattern: /^[a-z_]+$/i,
    maxLength: 50,
    message: "Fitness goal must be alphanumeric (max 50 chars)",
  },
  medicalConditions: {
    maxLength: 1000,
    message: "Medical conditions must not exceed 1000 characters",
  },
};

const isEmptyInput = (value) => {
  return value === undefined || value === null || value === "";
};

/**
 * Validate age value
 * @param {number} age - Age to validate
 * @returns {object} {valid, error}
 */
export const validateAge = (age) => {
  if (!isEmptyInput(age)) {
    const parsed = Number(age);
    if (
      !Number.isInteger(parsed) ||
      parsed < VALIDATION_RULES.age.min ||
      parsed > VALIDATION_RULES.age.max
    ) {
      return {
        valid: false,
        error: VALIDATION_RULES.age.message,
      };
    }
  }
  return { valid: true };
};

/**
 * Validate height in centimeters
 * @param {number} heightCm - Height in cm to validate
 * @returns {object} {valid, error}
 */
export const validateHeightCm = (heightCm) => {
  if (!isEmptyInput(heightCm)) {
    const num = Number(heightCm);
    if (
      Number.isNaN(num) ||
      num < VALIDATION_RULES.heightCm.min ||
      num > VALIDATION_RULES.heightCm.max
    ) {
      return {
        valid: false,
        error: VALIDATION_RULES.heightCm.message,
      };
    }
  }
  return { valid: true };
};

/**
 * Validate weight in kilograms
 * @param {number} weightKg - Weight in kg to validate
 * @returns {object} {valid, error}
 */
export const validateWeightKg = (weightKg) => {
  if (!isEmptyInput(weightKg)) {
    const num = Number(weightKg);
    if (
      Number.isNaN(num) ||
      num < VALIDATION_RULES.weightKg.min ||
      num > VALIDATION_RULES.weightKg.max
    ) {
      return {
        valid: false,
        error: VALIDATION_RULES.weightKg.message,
      };
    }
  }
  return { valid: true };
};

/**
 * Validate fitness goal
 * @param {string} fitnessGoal - Goal to validate
 * @returns {object} {valid, error}
 */
export const validateFitnessGoal = (fitnessGoal) => {
  if (!isEmptyInput(fitnessGoal)) {
    const str = String(fitnessGoal).trim();
    if (!str) {
      return { valid: true }; // Empty is allowed (optional)
    }
    if (
      str.length > VALIDATION_RULES.fitnessGoal.maxLength ||
      !VALIDATION_RULES.fitnessGoal.pattern.test(str)
    ) {
      return {
        valid: false,
        error: VALIDATION_RULES.fitnessGoal.message,
      };
    }
  }
  return { valid: true };
};

/**
 * Validate medical conditions text
 * @param {string} medicalConditions - Text to validate
 * @returns {object} {valid, error}
 */
export const validateMedicalConditions = (medicalConditions) => {
  if (!isEmptyInput(medicalConditions)) {
    const str = String(medicalConditions).trim();
    if (str.length > VALIDATION_RULES.medicalConditions.maxLength) {
      return {
        valid: false,
        error: VALIDATION_RULES.medicalConditions.message,
      };
    }
  }
  return { valid: true };
};

/**
 * Validate entire ClientProfile data object
 * @param {object} data - Profile data to validate
 * @returns {object} {valid, errors} where errors is a map of field -> message
 */
export const validateClientProfileData = (data) => {
  const errors = {};

  if (!isEmptyInput(data.age)) {
    const ageValidation = validateAge(data.age);
    if (!ageValidation.valid) {
      errors.age = ageValidation.error;
    }
  }

  if (!isEmptyInput(data.heightCm)) {
    const heightValidation = validateHeightCm(data.heightCm);
    if (!heightValidation.valid) {
      errors.heightCm = heightValidation.error;
    }
  }

  if (!isEmptyInput(data.weightKg)) {
    const weightValidation = validateWeightKg(data.weightKg);
    if (!weightValidation.valid) {
      errors.weightKg = weightValidation.error;
    }
  }

  if (!isEmptyInput(data.fitnessGoal)) {
    const goalValidation = validateFitnessGoal(data.fitnessGoal);
    if (!goalValidation.valid) {
      errors.fitnessGoal = goalValidation.error;
    }
  }

  if (!isEmptyInput(data.medicalConditions)) {
    const medicalValidation = validateMedicalConditions(data.medicalConditions);
    if (!medicalValidation.valid) {
      errors.medicalConditions = medicalValidation.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : null,
  };
};

/**
 * Normalize and sanitize profile data before storage
 * @param {object} data - Raw profile data
 * @returns {object} Normalized data safe for storage
 */
export const normalizeClientProfileData = (data) => {
  const normalized = {};

  if (Object.prototype.hasOwnProperty.call(data, "age")) {
    if (isEmptyInput(data.age)) {
      normalized.age = null;
    } else {
      normalized.age = Number(data.age);
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, "heightCm")) {
    normalized.heightCm = isEmptyInput(data.heightCm) ? null : data.heightCm; // Decimal handled by Prisma
  }

  if (Object.prototype.hasOwnProperty.call(data, "weightKg")) {
    normalized.weightKg = isEmptyInput(data.weightKg) ? null : data.weightKg; // Decimal handled by Prisma
  }

  if (Object.prototype.hasOwnProperty.call(data, "fitnessGoal")) {
    if (isEmptyInput(data.fitnessGoal)) {
      normalized.fitnessGoal = null;
    } else {
      const str = String(data.fitnessGoal).trim();
      normalized.fitnessGoal = str || null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, "medicalConditions")) {
    if (isEmptyInput(data.medicalConditions)) {
      normalized.medicalConditions = null;
    } else {
      const str = String(data.medicalConditions).trim();
      normalized.medicalConditions = str || null;
    }
  }

  return normalized;
};
