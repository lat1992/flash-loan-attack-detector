import { ethers } from "ethers";
import { FEED_REGISTRY_INTERFACE_ABI } from "../constants/abis";
import { ADDRESSES } from "../constants/addresses";

export class PriceService {
  async getPrice(
    provider: ethers.JsonRpcProvider,
    tokenAddress: string,
    blockNumber: number,
  ): Promise<number> {
    // use chainlink to get price
    const feedRegistry = new ethers.Contract(
      ADDRESSES.CHAINLINK,
      FEED_REGISTRY_INTERFACE_ABI,
      provider,
    );
    // convert wbtc to btc
    if (tokenAddress === ADDRESSES.WBTC) {
      tokenAddress = ADDRESSES.BTC;
    } else if (
      // convert weth / steth to eth
      tokenAddress === ADDRESSES.STETH ||
      tokenAddress === ADDRESSES.WETH
    ) {
      tokenAddress = ADDRESSES.ETH;
    }
    let bigPrice: bigint = 0n;
    try {
      let roundData = await feedRegistry.latestRoundData(
        tokenAddress,
        ADDRESSES.USD,
        {
          blockTag: blockNumber,
        },
      );
      bigPrice = roundData[1];
    } catch (e) {
      return 0;
    }
    let price: number = 0;
    try {
      let decimals = await feedRegistry.decimals(tokenAddress, ADDRESSES.USD);
      price = Number(ethers.formatUnits(bigPrice, decimals));
    } catch (e) {
      return 0;
    }
    return price;
  }
}

export const priceService = new PriceService();
