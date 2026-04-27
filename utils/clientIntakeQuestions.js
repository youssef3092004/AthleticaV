const buildSection = (key, title, description, questions) => ({
  key,
  title,
  description,
  questions,
});

// Screen 1: Welcome Q&A - Lifestyle & Preferences
const LIFESTYLE = buildSection(
  "lifestyle",
  "Welcome Q&A",
  "Tell us about your lifestyle and preferences",
  [
    {
      key: "SLEEP_HOURS",
      prompt: "How many hours do you sleep per night?",
      type: "select",
      options: [
        "Less than 5 hours",
        "5-6 hours",
        "6-7 hours",
        "7-8 hours",
        "More than 8 hours",
      ],
      required: true,
    },
    {
      key: "OCCUPATION",
      prompt: "What is your occupation?",
      type: "select",
      options: [
        "Sedentary (desk job)",
        "Lightly active",
        "Moderately active",
        "Very active",
        "Athlete",
      ],
      required: true,
    },
    {
      key: "STRESS_LEVEL",
      prompt: "How would you rate your stress level?",
      type: "select",
      options: ["Very low", "Low", "Medium", "High", "Very high"],
      required: true,
    },
    {
      key: "SMOKE_DRINK_ALCOHOL",
      prompt: "Do you smoke or drink alcohol?",
      type: "select",
      options: ["No", "Occasionally", "Regularly"],
      required: true,
    },
    {
      key: "COMMITMENT_DAYS_PER_WEEK",
      prompt: "How many days per week can you commit to training?",
      type: "select",
      options: ["1-2 days", "3-4 days", "5-6 days", "7 days"],
      required: true,
    },
    {
      key: "PREFERRED_WORKOUT_LOCATION",
      prompt: "Do you prefer training at the gym or at home?",
      type: "select",
      options: ["Gym", "Home", "Both"],
      required: true,
    },
  ],
);

// Screen 2: Welcome Q&A - Fitness & Nutrition
const FITNESS_NUTRITION = buildSection(
  "fitness_nutrition",
  "Welcome Q&A",
  "Tell us about your fitness level and nutrition habits",
  [
    {
      key: "FITNESS_LEVEL",
      prompt: "How would you rate your fitness level?",
      type: "select",
      options: ["Beginner", "Intermediate", "Advanced"],
      required: true,
    },
    {
      key: "DAILY_DIET_DESCRIPTION",
      prompt: "What does your daily diet look like?",
      type: "select",
      options: [
        "Healthy and balanced",
        "Need improvement",
        "Inconsistent",
        "Mostly junk food",
      ],
      required: true,
    },
    {
      key: "MEALS_PER_DAY",
      prompt: "How many meals do you eat per day?",
      type: "select",
      options: ["1-2 meals", "3 meals", "4 meals", "5+ meals"],
      required: true,
    },
    {
      key: "WATER_INTAKE_LITERS",
      prompt: "How much water do you drink daily?",
      type: "select",
      options: ["Less than 1L", "1-2L", "2-3L", "3-4L", "More than 4L"],
      required: true,
    },
    {
      key: "CURRENT_EXERCISE_TYPE",
      prompt: "What type of exercise do you do?",
      type: "select",
      options: [
        "Gym / weight training",
        "Cardio / running",
        "Sports",
        "Home workouts",
        "None",
      ],
      required: true,
    },
    {
      key: "FOOD_ALLERGIES_RESTRICTIONS",
      prompt: "Do you have any food allergies or restrictions?",
      type: "select",
      options: [
        "No allergies",
        "Yes (diet preference)",
        "Yes (medical condition)",
      ],
      required: true,
    },
  ],
);

// Screen 4 & 5: Goals & Medical Information
const GOALS = buildSection(
  "goals",
  "Goals & Medical Information",
  "Define your fitness goals and health information",
  [
    {
      key: "HEIGHT_CM",
      prompt: "Type Your Height",
      type: "number",
      required: true,
    },
    {
      key: "WEIGHT_KG",
      prompt: "Type Your Weight",
      type: "number",
      required: true,
    },
    {
      key: "PRIMARY_FITNESS_GOAL",
      prompt: "What are your primary fitness goals?",
      type: "select",
      options: [
        "Lose weight",
        "Build muscle",
        "Improve endurance",
        "Increase strength",
        "General fitness",
        "Improve mobility",
      ],
      required: true,
    },
    {
      key: "PREVIOUS_PROGRAM_EXPERIENCE",
      prompt:
        "Do you have any previous experience with personal training or fitness programs?",
      type: "select",
      options: ["Yes", "No"],
      required: true,
    },
    {
      key: "GOAL_IMPORTANCE",
      prompt: "Why is this goal important to you?",
      type: "textarea",
      required: true,
    },
    {
      key: "MEDICAL_CONDITIONS",
      prompt: "Do you have any medical conditions?",
      type: "select",
      options: ["No medical conditions", "Yes", "Prefer not to say"],
      required: true,
    },
    {
      key: "CURRENT_MEDICATIONS",
      prompt: "Are you currently taking any medications?",
      type: "select",
      options: ["No medications", "Yes", "Prefer not to say"],
      required: true,
    },
    {
      key: "EXPECTED_CHALLENGES",
      prompt: "What challenges do you expect to face?",
      type: "multiselect",
      options: [
        "Lack of time",
        "Motivation",
        "Injuries",
        "Diet consistency",
        "Work schedule",
      ],
      required: true,
    },
  ],
);

// Screen 3: Welcome Q&A - Health & Activity
const HEALTH_ACTIVITY = buildSection(
  "health_activity",
  "Welcome Q&A",
  "Tell us about your health and current activity level",
  [
    {
      key: "PAST_INJURIES",
      prompt: "Have you had any past injuries?",
      type: "select",
      options: ["No injuries", "Minor injuries", "Significant injuries"],
      required: true,
    },
    {
      key: "DOCTOR_EXERCISE_RESTRICTION",
      prompt: "Has a doctor ever advised you not to exercise?",
      type: "select",
      options: ["No", "Yes"],
      required: true,
    },
    {
      key: "CURRENTLY_EXERCISING",
      prompt: "Are you currently exercising?",
      type: "select",
      options: ["Not exercising", "Exercising lightly", "Exercising regularly"],
      required: true,
    },
    {
      key: "TRAINING_DAYS_PER_WEEK",
      prompt: "How many days per week do you train?",
      type: "number",
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

export const CLIENT_INTAKE_QUESTION_GROUPS = [
  LIFESTYLE,
  FITNESS_NUTRITION,
  HEALTH_ACTIVITY,
  GOALS,
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
