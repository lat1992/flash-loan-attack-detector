import { ethers } from "ethers";
import { getPrice } from "./price";

interface Attack {
  txHash: string;
  attackTime: string;
  isFlashLoan: boolean;
  attackerAddress: string;
  victimAddress: string;
  amountLost: number;
  amountLostInDollars: number;
  severity: string;
}

interface ExploitInfo {
  blockNumber: number;
  chainId: string;
  presenceOfAttack: boolean;
  attacks: Attack[];
}

async function detectExploit(blockNumber: number): Promise<ExploitInfo> {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  let isExploited = false;
  const attacks: Attack[] = [];
  await provider.getBlock(blockNumber, true).then(async (block) => {
    if (!block) {
      throw new Error("Block not found");
    }

    for (const tx of block.prefetchedTransactions) {
      await provider.getTransactionReceipt(tx?.hash).then(async (receipt) => {
        if (!receipt) return;

        let [attacked, hasFlashLoan, targetToken, victim, exploitAmount] =
          analyzeEulerExploitPattern(receipt);
        if (attacked) {
          isExploited = true;

          const ERC20_ABI = ["function decimals() view returns (uint8)"];
          const tokenContract = new ethers.Contract(
            targetToken,
            ERC20_ABI,
            provider,
          );
          let decimals: number = 18;
          tokenContract.decimals().then((dec) => {
            decimals = Number(dec);
          });

          const amountLost: number = Number(
            ethers.formatUnits(exploitAmount || 0, decimals),
          );
          let amountLostInDollars: number = 0;
          let price: number = await getPrice(
            provider,
            exploitAmount.toString(),
            targetToken,
            blockNumber,
          );
          if (price !== 0) {
            amountLostInDollars = amountLost * Number(price);
          }

          attacks.push({
            txHash: tx.hash,
            attackTime: block.date?.toISOString() || "",
            isFlashLoan: hasFlashLoan,
            attackerAddress: receipt.from,
            victimAddress: victim,
            amountLost: amountLost,
            amountLostInDollars: amountLostInDollars,
            severity: amountLostInDollars > 1000000 ? "HIGH" : "MEDIUM",
          });
        }
      });
    }
  });

  return {
    blockNumber: blockNumber,
    presenceOfAttack: isExploited,
    chainId: "0x1",
    attacks: attacks,
  };
}

function analyzeEulerExploitPattern(
  receipt: ethers.TransactionReceipt,
): [boolean, boolean, string, string, bigint] {
  let hasFlashLoan: boolean = false,
    hasDonate: boolean = false,
    hasLiquidation: boolean = false,
    skip: boolean = false,
    exploitAmount: bigint = 0n,
    targetToken: string = "";
  let tokenMap = new Map<string, bigint>();
  for (const log of receipt.logs) {
    if (
      // flashloan aave
      log.topics[0] ===
      "0x631042c832b07452973831137f2d73e395028b44b250dedc5abb0ee766e168ac"
    ) {
      hasFlashLoan = true;
      const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        [
          "uint256", // amount
          "uint256", // premium
          "uint256", // referralCode
        ],
        log.data,
      );
      exploitAmount -= BigInt(decodedData[0]) - BigInt(decodedData[1]);
    } else if (
      // flashloan balancer
      log.topics[0] ===
      "0x0d7d75e01ab95780d3cd1c8ec0dd6c2ce19e3a20427eec8bf53283b6fb8e95f0"
    ) {
      hasFlashLoan = true;
      const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        [
          "uint256", // amount
          "uint256", // feeAmount
        ],
        log.data,
      );
      exploitAmount -= BigInt(decodedData[0]) - BigInt(decodedData[1]);
    } else if (
      // donate
      log.topics[0] ===
      "0x1e090bfa40abafd9102cc09ab955b704519a275c8e78b2549f66c1b4439ce9d7"
    ) {
      hasDonate = true;
    } else if (
      // borrow
      log.topics[0] ===
      "0x312a5e5e1079f5dda4e95dbbd0b908b291fd5b992ef22073643ab691572c5b52"
    ) {
      skip = true;
    } else if (
      // repay
      log.topics[0] ===
      "0x05f2eeda0e08e4b437f487c8d7d29b14537d15e3488170dc3de5dbdf8dac4684"
    ) {
      skip = true;
    } else if (
      // liquidation
      log.topics[0] ===
      "0x258be119f0bb402a931bfc28de6236747c14f2a56e87e9e7fe5151976b65e5a0"
    ) {
      hasLiquidation = true;
      const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        [
          "address", // collateral
          "uint256", // repay
          "uint256", // yield
        ],
        log.data,
      );
      targetToken = decodedData[0];
    } else if (
      // withdraw
      log.topics[0] ===
      "0x0afd74a2a0a78f6c15e41029f44995ee023fe49276f44a4b2b2cf674829362e6"
    ) {
      const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        [
          "uint256", // amount
        ],
        log.data,
      );
      exploitAmount += BigInt(decodedData[0]);
    } else if (
      // transfer
      log.topics[0] ===
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    ) {
      if (skip) {
        skip = false;
      } else {
        if (
          // mint
          log.topics[1] ===
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          if (log.data !== "0x") {
            const amount = BigInt(log.data);
            const current = tokenMap.get(log.address) || 0n;
            tokenMap.set(log.address, current + amount);
          }
        } else if (
          // burn
          log.topics[2] ===
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          if (log.data !== "0x") {
            const amount = BigInt(log.data);
            const current = tokenMap.get(log.address) || 0n;
            tokenMap.set(log.address, current - amount);
          }
        }
      }
    }
  }
  if (
    hasFlashLoan &&
    hasDonate &&
    hasLiquidation &&
    tokenMap.size !== 0 &&
    exploitAmount >= 0
  ) {
    return [
      true,
      hasFlashLoan,
      targetToken,
      findHighestKeys(tokenMap),
      exploitAmount,
    ];
  }
  return [false, false, "", "", 0n];
}

function findHighestKeys(map: Map<string, number | bigint>): string {
  return Array.from(map.entries()).reduce((maxEntry, currentEntry) => {
    return BigInt(currentEntry[1]) > BigInt(maxEntry[1])
      ? currentEntry
      : maxEntry;
  })[0];
}

export { detectExploit };
