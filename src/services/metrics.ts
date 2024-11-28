import { Counter, Registry, Gauge } from "prom-client";
import { validTxsMap } from "../dataset";

export class MetricsService {
  private registry: Registry;
  private detectRequestCounter: Counter;
  private attacksDetectedCounter: Counter;
  private processingDuration: Gauge;
  private truePositives: Counter;
  private falsePositives: Counter;
  private falseNegatives: Counter;
  private f1Score: Gauge;

  constructor() {
    this.registry = new Registry();

    this.detectRequestCounter = new Counter({
      name: "flash_loan_detect_requests_total",
      help: "Total number of detection requests",
      registers: [this.registry],
    });

    this.attacksDetectedCounter = new Counter({
      name: "flash_loan_attacks_detected_total",
      help: "Total number of flash loan attacks detected",
      registers: [this.registry],
    });

    this.processingDuration = new Gauge({
      name: "flash_loan_processing_duration_seconds",
      help: "Time taken to process detection request",
      registers: [this.registry],
    });

    this.truePositives = new Counter({
      name: "flash_loan_true_positives_total",
      help: "Number of correctly identified flash loan attacks",
      registers: [this.registry],
    });

    this.falsePositives = new Counter({
      name: "flash_loan_false_positives_total",
      help: "Number of incorrectly identified flash loan attacks",
      registers: [this.registry],
    });

    this.falseNegatives = new Counter({
      name: "flash_loan_false_negatives_total",
      help: "Number of missed flash loan attacks",
      registers: [this.registry],
    });

    this.f1Score = new Gauge({
      name: "flash_loan_f1_score",
      help: "F1 score of the flash loan detection model",
      registers: [this.registry],
    });
  }

  incrementDetectRequests(): void {
    this.detectRequestCounter.inc();
  }

  incrementAttacksDetected(count: number): void {
    this.attacksDetectedCounter.inc(count);
  }

  startProcessingTimer(): () => void {
    const endTimer = this.processingDuration.startTimer();
    return endTimer;
  }

  incrementTruePositives(): void {
    this.truePositives.inc();
    this.updateF1Score();
  }

  incrementFalsePositives(): void {
    this.falsePositives.inc();
    this.updateF1Score();
  }

  incrementFalseNegatives(): void {
    this.falseNegatives.inc();
    this.updateF1Score();
  }

  private async updateF1Score(): Promise<void> {
    const tp = await this.truePositives.get();
    const fp = await this.falsePositives.get();
    const fn = await this.falseNegatives.get();

    const tpv = tp.values[0].value;
    const fpv = fp.values[0].value;
    const fnv = fn.values[0].value;

    const precision = tpv / (tpv + fpv) || 0;
    const recall = tpv / (tpv + fnv) || 0;

    // Calculate F1 score
    const f1 = (2 * (precision * recall)) / (precision + recall) || 0;

    this.f1Score.set(f1);
  }

  verifyDetection(txHash: string): void {
    if (validTxsMap.includes(txHash)) {
      this.incrementTruePositives();
    } else if (!validTxsMap.includes(txHash)) {
      this.incrementFalsePositives();
    }
  }

  verifyFalseNegativeDetection(txHash: string): void {
    if (validTxsMap.includes(txHash)) {
      this.incrementFalseNegatives();
    }
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export const metricsService = new MetricsService();
