import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import statsRouter from "./stats";
import botsRouter from "./bots";
import subscribersRouter from "./subscribers";
import broadcastsRouter from "./broadcasts";
import plansRouter from "./plans";
import paymentRequestsRouter from "./paymentRequests";
import tokensRouter from "./tokens";
import userbotsRouter from "./userbots";
import webhookRouter from "./webhook";
import otpVerifyRouter from "./otpVerify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(statsRouter);
router.use(botsRouter);
router.use(subscribersRouter);
router.use(broadcastsRouter);
router.use(plansRouter);
router.use(paymentRequestsRouter);
router.use(tokensRouter);
router.use(userbotsRouter);
router.use(webhookRouter);
router.use(otpVerifyRouter);

export default router;
