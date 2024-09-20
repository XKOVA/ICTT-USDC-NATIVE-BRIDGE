# ICTT Teleporter USDC-Native Bridge

This project contains scripts to facilitate the teleportation of tokens between USDC on the C-Chain and native tokens on an Avalanche L1 blockchain.

## Scripts

1. `teleport-native-to-usdc.js`: Teleports native tokens from an Avalanche L1 blockchain to USDC on the C-Chain.
2. `teleport-usdc-to-native.js`: Teleports USDC from the C-Chain to native tokens on an Avalanche L1 blockchain.

The contracts these scripts interact with can be found in the [avalanche-interchain-token-transfer repository](https://github.com/ava-labs/avalanche-interchain-token-transfer). For convenience, you can directly access the following contracts:

- [ERC20TokenHome.sol](https://github.com/ava-labs/avalanche-interchain-token-transfer/blob/main/contracts/src/TokenHome/ERC20TokenHome.sol)
- [NativeTokenRemote.sol](https://github.com/ava-labs/avalanche-interchain-token-transfer/blob/main/contracts/src/TokenRemote/NativeTokenRemote.sol)

Developers interested in learning more about Avalanche and its ecosystem can take courses on the [Avalanche Academy](https://academy.avax.network/). Additionally, the [Avalanche Starter Kit](https://github.com/ava-labs/avalanche-starter-kit) is available for those looking to kickstart their development on Avalanche.

## Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- A funded wallet with sufficient native tokens and USDC

### Faucets

To obtain testnet tokens for development and testing, you can use the following faucets:

- [Circle USDC Faucet](https://faucet.circle.com/): Get testnet USDC tokens
- [Core.app AVAX Fuji Faucet](https://core.app/tools/testnet-faucet/?subnet=c&token=c): Get testnet AVAX tokens for the Fuji network

Make sure to fund your wallet with both USDC and AVAX tokens before running the scripts.

## Setup

1. Clone the repository:

   ```sh
   git clone <repository-url>
   cd ictt-teleporter-usdc-native-bridge
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a `.env` file in the root directory and add the following variables:

   ```env
    # Private key of the funded wallet
    PRIVATE_KEY=<your-private-key>

    # RPC URLs
    HOME_CHAIN_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
    REMOTE_CHAIN_RPC_URL=<remote-chain-rpc-url>

    # Funded address
    FUNDED_ADDRESS=<your-funded-address>

    # Blockchain IDs
    C_CHAIN_BLOCKCHAIN_ID_HEX=0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5
    SUBNET_BLOCKCHAIN_ID_HEX=<subnet-blockchain-id>

    # Contract addresses
    ERC20_HOME_C_CHAIN=0x5425890298aed601595a70AB815c96711a31Bc65
    ERC20_HOME_TRANSFERER_C_CHAIN=<erc20-home-transferer-c-chain-address>
    NATIVE_TOKEN_REMOTE_SUBNET=<native-token-remote-subnet-address>

    # L1 blockchain name
    L1NAME=<l1-blockchain-name>
   ```

   Adjust the values according to your setup and requirements.

## Running the Scripts

### Teleport Native to USDC

To teleport native tokens from the L1 blockchain to USDC on the C-Chain:

```sh
node teleport-native-to-usdc.js
```

This script:

- Checks initial balances on both chains
- Sends a teleport transaction from the L1 to the C-Chain
- Waits for the transaction to be processed
- Checks final balances and reports the results

#### Gas Spent Consideration

In the `teleport-native-to-usdc.js` script, the balance change calculation includes the gas spent for the transaction. This means that when the script reports the native balance change, it's considering both the amount teleported and the gas fees paid. The script uses the following logic:

```javascript
if (nativeBalanceChange < 0) {
  console.log(chalk.green(`${timestamp()} Native balance change successful: ${nativeBalanceChange} tokens (inclusive of gas spent)`));
} else {
  console.log(chalk.red(`${timestamp()} Native balance change failed: ${nativeBalanceChange} tokens`));
}
```

The native balance change is expected to be negative and larger than the amount teleported due to the additional gas fees. This approach ensures that the test accurately reflects the total cost of the teleport operation, including transaction fees.

### Teleport USDC to Native

To teleport USDC from the C-Chain to native tokens on the L1 blockchain:

```sh
node teleport-usdc-to-native.js
```

This script:

- Checks initial balances on both chains
- Approves the ERC20 transfer if necessary
- Sends a teleport transaction from the C-Chain to the L1
- Waits for the transaction to be processed
- Checks final balances and reports the results

## Configuration

Both scripts use the following configurable parameters:

- `WAIT_TIME_MS`: Time to wait for transaction processing (default: 60000ms)
- `AMOUNT_TO_BRIDGE`: Amount of tokens to bridge (default: 0.001)

You can adjust these values in the scripts as needed.

### Tolerance Setting in teleport-usdc-to-native.js

The `teleport-usdc-to-native.js` script includes a tolerance setting to account for small discrepancies in balance changes due to floating-point precision:

```javascript
const tolerance = 0.01; // 1% test tolerance
```

This tolerance is used when verifying the success of the transaction. The script checks if the actual balance change is within 1% of the expected change. This allows for small variations that might occur due to:

1. Floating-point calculations between 6 (USDC) and 18 (USDC Native) decimal places

You can adjust this tolerance value if needed, depending on the precision required for your specific use case. A lower tolerance (e.g., 0.001 for 0.1%) will make the test more strict, while a higher tolerance will allow for larger discrepancies.

## Troubleshooting

- Ensure all environment variables are correctly set in the `.env` file.
- Make sure your wallet has sufficient balance for the transactions on both chains.
- Check the console output for detailed error messages and suggestions.
- If transactions are failing, try increasing the `WAIT_TIME_MS` value.

## Security Note

Keep your private key secure and never commit it to version control. Use environment variables or secure secret management practices in production environments.

## About XKOVA

This project was developed by [Chris Fusillo](https://x.com/chrisfusillo), founder of XKOVA, to facilitate token teleportation between USDC on the C-Chain and native tokens on the XKOVA blockchain.

XKOVA is decentralized wireless blockchain infrastructure combined with a payment platform and powered by an Avalanche L1. Designed to empower people with blockchain access and personal finance management - no internet access required.

For more information, visit [xkova.com](https://xkova.com).
