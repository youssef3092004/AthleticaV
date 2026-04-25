const buildSection = (key, title, description, questions) => ({
  key,
  title,
  description,
  questions,
});

const BASIC_INFORMATION = buildSection(
  "basic_information",
  "Basic Information",
  "Core profile details needed to personalize the plan.",
  [
    { key: "AGE", prompt: "What is your age?", type: "number", required: true },
    {
      key: "GENDER",
      prompt: "What is your gender?",
      type: "select",
      options: ["Male", "Female", "Non-binary", "Prefer not to say"],
      required: true,
    },
    {
      key: "HEIGHT_CM",
      prompt: "What is your height? (cm)",
      type: "number",
      required: true,
    },
    {
      key: "WEIGHT_KG",
      prompt: "What is your weight? (kg)",
      type: "number",
      required: true,
    },
  ],
);

const GOALS = buildSection(
  "goals",
  "Goals",
  "Define what the client wants and why it matters.",
  [
    {
      key: "PRIMARY_FITNESS_GOAL",
      prompt: "What is your primary fitness goal?",
      type: "select",
      options: [
        "Lose weight",
        "Build muscle",
        "Maintain",
        "Improve endurance",
        "General fitness",
      ],
      required: true,
    },
    {
      key: "GOAL_IMPORTANCE",
      prompt: "Why is this goal important to you?",
      type: "textarea",
      required: true,
    },
    {
      key: "TARGET_TIMELINE",
      prompt: "What is your target timeline? (e.g. 3 months, 6 months)",
      type: "text",
      required: true,
    },
  ],
);

const EXPERIENCE = buildSection(
  "experience",
  "Experience Level",
  "Understand how familiar the client is with training.",
  [
    {
      key: "FITNESS_LEVEL",
      prompt: "How would you rate your fitness level?",
      type: "select",
      options: ["Beginner", "Intermediate", "Advanced"],
      required: true,
    },
    {
      key: "PREVIOUS_PROGRAM_EXPERIENCE",
      prompt: "Do you have previous experience with training programs?",
      type: "select",
      options: ["Yes", "No"],
      required: true,
    },
    {
      key: "PREVIOUS_TRAINER_EXPERIENCE",
      prompt: "Have you worked with a personal trainer before?",
      type: "select",
      options: ["Yes", "No"],
      required: true,
    },
  ],
);

const MEDICAL_SAFETY = buildSection(
  "medical_safety",
  "Medical & Safety",
  "Capture anything that could affect training safety.",
  [
    {
      key: "MEDICAL_CONDITIONS",
      prompt: "Do you have any medical conditions?",
      type: "textarea",
      required: true,
    },
    {
      key: "CURRENT_MEDICATIONS",
      prompt: "Are you currently taking any medications?",
      type: "textarea",
      required: true,
    },
    {
      key: "PAST_INJURIES",
      prompt: "Have you had any past injuries?",
      type: "textarea",
      required: true,
    },
    {
      key: "DOCTOR_EXERCISE_RESTRICTION",
      prompt: "Has a doctor ever advised you not to exercise?",
      type: "select",
      options: ["Yes", "No"],
      required: true,
    },
  ],
);

const LIFESTYLE = buildSection(
  "lifestyle",
  "Lifestyle & Constraints",
  "Measure practical blockers that affect adherence.",
  [
    {
      key: "EXPECTED_CHALLENGES",
      prompt: "What challenges do you expect to face?",
      type: "multiselect",
      options: ["Lack of time", "Motivation", "Injuries", "Diet consistency"],
      required: true,
    },
    {
      key: "SLEEP_HOURS",
      prompt: "How many hours do you sleep per night?",
      type: "number",
      required: true,
    },
    {
      key: "STRESS_LEVEL",
      prompt: "What is your stress level? (Low / Medium / High)",
      type: "select",
      options: ["Low", "Medium", "High"],
      required: true,
    },
  ],
);

const ACTIVITY = buildSection(
  "activity",
  "Activity Level",
  "Understand the client’s current training behavior.",
  [
    {
      key: "CURRENTLY_EXERCISING",
      prompt: "Are you currently exercising?",
      type: "select",
      options: ["Yes", "No"],
      required: true,
    },
    {
      key: "TRAINING_DAYS_PER_WEEK",
      prompt: "How many days per week do you train?",
      type: "number",
      required: true,
    },
    {
      key: "CURRENT_EXERCISE_TYPE",
      prompt: "What type of exercise do you currently do?",
      type: "multiselect",
      options: ["Gym", "Home workouts", "Running", "Sports"],
      required: true,
    },
    {
      key: "SESSION_DURATION_MINUTES",
      prompt: "How long is each session? (minutes)",
      type: "number",
      required: true,
    },
  ],
);

const NUTRITION = buildSection(
  "nutrition",
  "Nutrition",
  "Capture the client’s current nutrition habits.",
  [
    {
      key: "DAILY_DIET_DESCRIPTION",
      prompt: "What does your daily diet look like?",
      type: "textarea",
      required: true,
    },
    {
      key: "MEALS_PER_DAY",
      prompt: "How many meals do you eat per day?",
      type: "number",
      required: true,
    },
    {
      key: "WATER_INTAKE_LITERS",
      prompt: "How much water do you drink daily? (liters)",
      type: "number",
      required: true,
    },
    {
      key: "FOOD_ALLERGIES_RESTRICTIONS",
      prompt: "Do you have any food allergies or dietary restrictions?",
      type: "textarea",
      required: true,
    },
    {
      key: "SPECIFIC_DIET",
      prompt: "Do you follow a specific diet? None / Keto / Vegan / etc.",
      type: "select",
      options: ["None", "Keto", "Vegan", "Vegetarian", "Other"],
      required: true,
    },
  ],
);

const COMMITMENT = buildSection(
  "commitment",
  "Commitment & Preferences",
  "Capture what is realistic and what the client prefers.",
  [
    {
      key: "REALISTIC_TRAINING_DAYS",
      prompt: "How many days per week can you realistically train?",
      type: "number",
      required: true,
    },
    {
      key: "PREFERRED_WORKOUT_LOCATION",
      prompt: "Preferred workout location: Gym / Home / Outdoor",
      type: "select",
      options: ["Gym", "Home", "Outdoor"],
      required: true,
    },
    {
      key: "PREFERRED_WORKOUT_DURATION",
      prompt: "Preferred workout duration: 30 / 45 / 60+ minutes",
      type: "select",
      options: ["30", "45", "60+"],
      required: true,
    },
    {
      key: "PREFERRED_TRAINING_TYPE",
      prompt: "What type of training do you prefer? Strength / Cardio / Mixed",
      type: "select",
      options: ["Strength", "Cardio", "Mixed"],
      required: true,
    },
  ],
);

export const CLIENT_INTAKE_QUESTION_GROUPS = [
  BASIC_INFORMATION,
  GOALS,
  EXPERIENCE,
  MEDICAL_SAFETY,
  LIFESTYLE,
  ACTIVITY,
  NUTRITION,
  COMMITMENT,
];

export const CLIENT_INTAKE_QUESTIONS = CLIENT_INTAKE_QUESTION_GROUPS.flatMap(
  (section) =>
    section.questions.map((question) => ({
      ...question,
      sectionKey: section.key,
      sectionTitle: section.title,
    })),
);

export const CLIENT_INTAKE_QUESTION_KEYS = new Set(
  CLIENT_INTAKE_QUESTIONS.map((question) => question.key),
);

export const CLIENT_INTAKE_REQUIRED_KEYS = new Set(
  CLIENT_INTAKE_QUESTIONS.filter((question) => question.required).map(
    (question) => question.key,
  ),
);

const PROMPT_TO_KEY = new Map(
  CLIENT_INTAKE_QUESTIONS.map((question) => [
    question.prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
    question.key,
  ]),
);

const normalizePrompt = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const normalizeClientIntakeQuestionKey = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const enumStyle = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (CLIENT_INTAKE_QUESTION_KEYS.has(enumStyle)) {
    return enumStyle;
  }

  const mapped = PROMPT_TO_KEY.get(normalizePrompt(raw));
  return mapped || null;
};

export const normalizeClientIntakeAnswer = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(", ");

    return joined || null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

export const parseClientIntakeAnswers = (rawAnswers) => {
  const entries = [];

  if (Array.isArray(rawAnswers)) {
    for (const item of rawAnswers) {
      const questionKey = normalizeClientIntakeQuestionKey(
        item?.questionKey || item?.key || item?.question || item?.prompt,
      );

      if (!questionKey) {
        continue;
      }

      const answer = normalizeClientIntakeAnswer(item?.answer);
      if (answer === null) {
        continue;
      }

      entries.push([questionKey, answer]);
    }
  } else if (rawAnswers && typeof rawAnswers === "object") {
    for (const [questionKeyRaw, answerRaw] of Object.entries(rawAnswers)) {
      const questionKey = normalizeClientIntakeQuestionKey(questionKeyRaw);
      const answer = normalizeClientIntakeAnswer(answerRaw);

      if (!questionKey || answer === null) {
        continue;
      }

      entries.push([questionKey, answer]);
    }
  } else {
    return new Map();
  }

  return new Map(entries);
};

export const buildClientIntakeStatus = (answers) => {
  const answerMap = answers instanceof Map ? answers : new Map();
  const answeredQuestionKeys = Array.from(answerMap.keys());
  const missingRequiredQuestionKeys = Array.from(
    CLIENT_INTAKE_REQUIRED_KEYS,
  ).filter((questionKey) => !answerMap.has(questionKey));

  return {
    answeredQuestionKeys,
    missingRequiredQuestionKeys,
    answeredCount: answerMap.size,
    totalQuestions: CLIENT_INTAKE_QUESTIONS.length,
    completionRate: CLIENT_INTAKE_QUESTIONS.length
      ? Math.round((answerMap.size / CLIENT_INTAKE_QUESTIONS.length) * 100)
      : 0,
    isComplete: missingRequiredQuestionKeys.length === 0,
  };
};
