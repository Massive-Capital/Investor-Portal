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
  postMembersExportNotify,
} from "../controllers/userAdmin.controller.js";
import {
  getMyProfile,
  patchMyProfile,
  postChangePassword,
} from "../controllers/auth/account.controller.js";

const userRoutes = Router();

userRoutes
.post("/auth/signin", postSignin)
.post("/auth/change-password", postChangePassword)
.get("/auth/me", getMyProfile)
.patch("/auth/me", patchMyProfile)
/** Same handler — some proxies or clients mishandle PATCH; SPA can use POST. */
.post("/auth/me", patchMyProfile)
.post("/auth/signup/:token", postSignup)
.post("/auth/signup", postSignup)
.post("/auth/forgot-password", postForgotPassword)
.post("/auth/reset-password", postResetPassword)
.post("/auth/invite", postInviteUser)
.get("/users", getUsers)
.post("/users/export-notify", postMembersExportNotify)
.get("/users/:userId/audit-logs", getMemberAuditLogs)
.patch("/users/:userId", patchUser);

export default userRoutes;
