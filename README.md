# Flash Loan Attack Detector

A service that detects flash loan attacks on the Ethereum blockchain by analyzing transaction patterns and monitoring suspicious activities.

## Features

- Detection of flash loan attacks
- Analysis of transaction patterns
- Get price using Chainlink price feeds
- Attack severity classification
- Caching mechanism for efficient repeated queries

## Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- Ethereum RPC endpoint

## Installation

1. Clone the repository:
```bash
git clone https://github.com/lat1992/nefture-flash-loan-attack-detector.git
cd nefture-flash-loan-attack-detector
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following contents:
```
ETH_RPC_URL=your_ethereum_rpc_url
PORT=3000 (optional, defaults to 3000)
```

## Usage

1. Start the server:
```bash
npm run serve
```

2. Make a POST request to detect flash loan attacks:
```bash
curl -X POST http://localhost:3000/detect \
-H "Content-Type: application/json" \
-d '{"blockNumber": 123456789}'
```

### API Response Format

```typescript
interface ExploitInfo {
  blockNumber: number;
  chainId: string;
  presenceOfAttack: boolean;
  attacks: Attack[];
}

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
```

## Detection Method

The service detects flash loan attacks by:
1. Analyzing transaction receipts for specific patterns
2. Monitoring euler events
3. Monitoring flash loan events
4. Tracking token transfers
5. Calculating losses in both token and USD values
6. Determining attack severity based on the amount lost

## Limitations

- Price data might not be available for all tokens
