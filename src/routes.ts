import { Router, Request, Response } from "express";
import { detectExploit } from "./detect";

const router = Router();
const cacheMap = new Map<number, any>();

router.post("/detect", async (req, res) => {
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
    info = await detectExploit(req.body.blockNumber);
    cacheMap.set(req.body.blockNumber, info);
  }
  res.send(info);
});

export default router;
