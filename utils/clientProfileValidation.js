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
    pattern: /^[a-zA-Z0-9, ]+$/, // ✅ FIXED
    maxLength: 100,
    message:
      "Fitness goal can contain letters, numbers, spaces, and commas (max 100 chars)",
  },
  medicalConditions: {
    maxLength: 1000,
    message: "Medical conditions must not exceed 1000 characters",
  },
};

const isEmptyInput = (value) =>
  value === undefined || value === null || value === "";

// ---------------- VALIDATORS ----------------

export const validateAge = (age) => {
  if (isEmptyInput(age)) return { valid: true };

  const parsed = Number(age);

  if (
    !Number.isInteger(parsed) ||
    parsed < VALIDATION_RULES.age.min ||
    parsed > VALIDATION_RULES.age.max
  ) {
    return { valid: false, error: VALIDATION_RULES.age.message };
  }

  return { valid: true };
};

export const validateHeightCm = (heightCm) => {
  if (isEmptyInput(heightCm)) return { valid: true };

  const num = Number(heightCm);

  if (
    Number.isNaN(num) ||
    num < VALIDATION_RULES.heightCm.min ||
    num > VALIDATION_RULES.heightCm.max
  ) {
    return { valid: false, error: VALIDATION_RULES.heightCm.message };
  }

  return { valid: true };
};

export const validateWeightKg = (weightKg) => {
  if (isEmptyInput(weightKg)) return { valid: true };

  const num = Number(weightKg);

  if (
    Number.isNaN(num) ||
    num < VALIDATION_RULES.weightKg.min ||
    num > VALIDATION_RULES.weightKg.max
  ) {
    return { valid: false, error: VALIDATION_RULES.weightKg.message };
  }

  return { valid: true };
};

export const validateFitnessGoal = (fitnessGoal) => {
  if (isEmptyInput(fitnessGoal)) return { valid: true };

  const str = String(fitnessGoal).trim();

  if (!str) return { valid: true };

  if (
    str.length > VALIDATION_RULES.fitnessGoal.maxLength ||
    !VALIDATION_RULES.fitnessGoal.pattern.test(str)
  ) {
    return { valid: false, error: VALIDATION_RULES.fitnessGoal.message };
  }

  return { valid: true };
};

export const validateMedicalConditions = (medicalConditions) => {
  if (isEmptyInput(medicalConditions)) return { valid: true };

  const str = String(medicalConditions).trim();

  if (str.length > VALIDATION_RULES.medicalConditions.maxLength) {
    return {
      valid: false,
      error: VALIDATION_RULES.medicalConditions.message,
    };
  }

  return { valid: true };
};

// ---------------- MAIN VALIDATION ----------------

export const validateClientProfileData = (data) => {
  const errors = {};

  const validators = {
    age: validateAge,
    heightCm: validateHeightCm,
    weightKg: validateWeightKg,
    fitnessGoal: validateFitnessGoal,
    medicalConditions: validateMedicalConditions,
  };

  for (const key in validators) {
    const result = validators[key](data[key]);
    if (!result.valid) {
      errors[key] = result.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length ? errors : null,
  };
};

// ---------------- NORMALIZATION ----------------

export const normalizeClientProfileData = (data) => {
  const normalized = {};

  if ("age" in data) {
    normalized.age = isEmptyInput(data.age) ? null : Number(data.age);
  }

  if ("heightCm" in data) {
    normalized.heightCm = isEmptyInput(data.heightCm)
      ? null
      : Number(data.heightCm);
  }

  if ("weightKg" in data) {
    normalized.weightKg = isEmptyInput(data.weightKg)
      ? null
      : Number(data.weightKg);
  }

  if ("fitnessGoal" in data) {
    const str = String(data.fitnessGoal || "").trim();
    normalized.fitnessGoal = str || null;
  }

  if ("medicalConditions" in data) {
    const str = String(data.medicalConditions || "").trim();
    normalized.medicalConditions = str || null;
  }

  return normalized;
};
