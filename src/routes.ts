import { Router, Request, Response } from "express";
import { detectService } from "./services/detect";
import { metricsService } from "./services/metrics";

const router = Router();
const cacheMap = new Map<number, any>();

router.post("/detect", async (req, res) => {
  metricsService.incrementDetectRequests();
  const timer = metricsService.startProcessingTimer();
  if (
    req.body.blockNumber === 0 ||
    req.body.blockNumber === undefined ||
    typeof req.body.blockNumber !== "number"
  ) {
    res.status(400).send({
      error: "blockNumber is required and must be a number",
    });
    return;
  }

  let info: any = cacheMap.get(req.body.blockNumber);
  if (info === undefined) {
    info = await detectService.detectExploit(req.body.blockNumber);
    cacheMap.set(req.body.blockNumber, info);
    if (info.presenceOfAttack) {
      metricsService.incrementAttacksDetected(info.attacks.length);
    }
  }
  timer();
  res.send(info);
});

router.get("/metrics", async (_req: Request, res: Response) => {
  res.set("Content-Type", "text/plain");
  const metrics = await metricsService.getMetrics();
  res.send(metrics);
});

export default router;
