import { Router } from "express";
import { postSignin } from "../controllers/auth/signin.controller.js";
import { postSignup } from "../controllers/auth/signup.controller.js";
import { postForgotPassword } from "../controllers/auth/forgotPassword.controller.js";
import { postResetPassword } from "../controllers/auth/resetPassword.controller.js";
import { postInviteUser } from "../controllers/auth/invite.controller.js";
import {
  getMemberAuditLogs,
  getUsers,
  patchUser,
} from "../controllers/userAdmin.controller.js";

const userRoutes = Router();

userRoutes
.post("/auth/signin", postSignin)
.post("/auth/signup/:token", postSignup)
.post("/auth/signup", postSignup)
.post("/auth/forgot-password", postForgotPassword)
.post("/auth/reset-password", postResetPassword)
.post("/auth/invite", postInviteUser)
.get("/users", getUsers)
.get("/users/:userId/audit-logs", getMemberAuditLogs)
.patch("/users/:userId", patchUser);

export default userRoutes;
