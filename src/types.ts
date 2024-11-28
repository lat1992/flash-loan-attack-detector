export interface Attack {
  txHash: string;
  attackTime: string;
  isFlashLoan: boolean;
  attackerAddress: string;
  victimAddress: string;
  amountLost: number;
  amountLostInDollars: number;
  severity: string;
}

export interface ExploitInfo {
  blockNumber: number;
  chainId: string;
  presenceOfAttack: boolean;
  attacks: Attack[];
}
