import { Router } from "express";
import {
  createProgram,
  deleteProgramById,
  getProgramById,
  getPrograms,
  updateProgramById,
} from "../controllers/program.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { checkOwnership } from "../middleware/checkOwnership.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-WORKOUTS"),
  createProgram,
);

router.get(
  "/getAll",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getPrograms,
);

router.get(
  "/getById/:id",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  checkOwnership({
    model: "program",
    idField: "id",
    ownerFields: ["trainerId", "clientId"],
    paramKey: "id",
  }),
  getProgramById,
);

router.patch(
  "/update/:id",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  checkOwnership({
    model: "program",
    idField: "id",
    ownerFields: ["trainerId", "clientId"],
    paramKey: "id",
  }),
  updateProgramById,
);

router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  checkOwnership({
    model: "program",
    idField: "id",
    ownerFields: ["trainerId", "clientId"],
    paramKey: "id",
  }),
  deleteProgramById,
);

export default router;
