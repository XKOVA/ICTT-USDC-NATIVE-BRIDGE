require('dotenv').config();
const ethers = require('ethers');
const chalk = require('chalk');

// This script teleports native tokens from on an Avalanche L1 blockchain to USDC on the C-Chain 

// Load environment variables
const HOME_CHAIN_RPC_URL = process.env.HOME_CHAIN_RPC_URL;
const REMOTE_CHAIN_RPC_URL = process.env.REMOTE_CHAIN_RPC_URL;
const C_CHAIN_BLOCKCHAIN_ID_HEX = process.env.C_CHAIN_BLOCKCHAIN_ID_HEX;
const ERC20_HOME_C_CHAIN = process.env.ERC20_HOME_C_CHAIN;
const ERC20_HOME_TRANSFERER_C_CHAIN = process.env.ERC20_HOME_TRANSFERER_C_CHAIN;
const NATIVE_TOKEN_REMOTE_SUBNET = process.env.NATIVE_TOKEN_REMOTE_SUBNET;
const FUNDED_ADDRESS = process.env.FUNDED_ADDRESS;
const PRIVATE_KEY = process.env.PKXKOVA;
const L1NAME = process.env.L1NAME;

const WAIT_TIME_MS = 60000; // Adjust the wait time as needed
const AMOUNT_TO_BRIDGE = 0.001; // Adjust the amount to bridge as needed

// Validate environment variables
if (!HOME_CHAIN_RPC_URL || !REMOTE_CHAIN_RPC_URL || !FUNDED_ADDRESS || !C_CHAIN_BLOCKCHAIN_ID_HEX || !ERC20_HOME_C_CHAIN || !ERC20_HOME_TRANSFERER_C_CHAIN || !NATIVE_TOKEN_REMOTE_SUBNET || !L1NAME || !PRIVATE_KEY) {
    console.error("Error: One or more required environment variables are missing.");
    process.exit(1);
}

// Log the environment variables
console.log("HOME_CHAIN_RPC_URL:", HOME_CHAIN_RPC_URL);
console.log("REMOTE_CHAIN_RPC_URL:", REMOTE_CHAIN_RPC_URL);

const provider = new ethers.providers.JsonRpcProvider(HOME_CHAIN_RPC_URL);
const remoteProvider = new ethers.providers.JsonRpcProvider(REMOTE_CHAIN_RPC_URL);

// ABI for the contract function we will call
const NATIVE_TOKEN_REMOTE_SUBNET_ABI = [
    "function send((bytes32,address,address,address,uint256,uint256,uint256,address) calldata input) payable"
];

// Helper function to format timestamps consistently
function timestamp() {
    return `[${new Date().toISOString()}]`;
}

// Function to get the ERC20 token balance of an address
async function getERC20Balance(address) {
    const abi = ["function balanceOf(address) view returns (uint256)"];
    const contract = new ethers.Contract(ERC20_HOME_C_CHAIN, abi, provider);
    const balance = await contract.balanceOf(address);
    return ethers.utils.formatUnits(balance, 6);
}

// Function to get the native token balance of an address
async function getNativeBalance(address) {
    const balance = await remoteProvider.getBalance(address);
    return ethers.utils.formatEther(balance);
}

// Function to send a teleport transaction
async function sendTeleportTransaction(privateKey, amount) {
    const wallet = new ethers.Wallet(privateKey, remoteProvider);
    const contract = new ethers.Contract(NATIVE_TOKEN_REMOTE_SUBNET, NATIVE_TOKEN_REMOTE_SUBNET_ABI, wallet);

    // Data required for the teleport transaction ie: NativeTokenRemote.sol
    const teleportData = [
        C_CHAIN_BLOCKCHAIN_ID_HEX,        // Blockchain ID of the C-Chain
        ERC20_HOME_TRANSFERER_C_CHAIN,    // Address of the ERC20 token transferer on the C-Chain
        FUNDED_ADDRESS,                   // Address that will receive the tokens
        ethers.constants.AddressZero,     // Address of the token to be transferred (zero address for native token)
        0,                                // Amount of tokens to be transferred (0 for native token)
        0,                                // Fee amount (0 for no fee)
        250000,                           // Gas limit for the transaction
        ethers.constants.AddressZero      // Address to receive the fee (zero address for no fee)
    ];

    try {
        const amountInWei = ethers.utils.parseEther(amount.toString());
        const tx = await contract.send(teleportData, { value: amountInWei });
        const receipt = await tx.wait();
        return { receipt, gasUsed: receipt.gasUsed };
    } catch (error) {
        throw error;
    }
}

// Main function to execute the teleport process
async function main() {
    const amount = AMOUNT_TO_BRIDGE;
    const amountInWei = ethers.utils.parseEther(amount.toString());

    console.log(`${timestamp()} Starting teleport of ${amount} native tokens to USDC`);

    // Check initial balances
    const balanceBefore = await getERC20Balance(FUNDED_ADDRESS);
    console.log(`${timestamp()} Initial C-Chain USDC balance: ${balanceBefore} USDC`);

    const nativeBalanceBefore = await getNativeBalance(FUNDED_ADDRESS);
    console.log(`${timestamp()} Initial ${L1NAME} native balance: ${nativeBalanceBefore} tokens`);

    // Check for sufficient balance
    if (ethers.utils.parseEther(nativeBalanceBefore).lt(amountInWei)) {
        console.error(`${timestamp()} Insufficient balance. Required: ${amount}, Available: ${nativeBalanceBefore}`);
        return;
    }

    console.log(`${timestamp()} Sufficient balance available. Proceeding with transaction.`);

    let transactionHash;
    let gasUsed;
    try {
        // Send the teleport transaction
        const result = await sendTeleportTransaction(PRIVATE_KEY, amount);
        transactionHash = result.receipt.transactionHash;
        gasUsed = result.gasUsed;
        console.log(`${timestamp()} Transaction sent. Transaction Hash: ${transactionHash}`);
        console.log(`${timestamp()} Gas used: ${gasUsed.toString()}`);
    } catch (error) {
        console.error(`${timestamp()} Operation failed:`, error);
        return;
    }

    console.log(`${timestamp()} Waiting for transaction to be processed...`);
    await new Promise(resolve => setTimeout(resolve, WAIT_TIME_MS)); // Wait for the configured time

    // Get final balances
    const balanceAfter = await getERC20Balance(FUNDED_ADDRESS);
    console.log(`${timestamp()} Final C-Chain USDC balance: ${balanceAfter} USDC`);

    const nativeBalanceAfter = await getNativeBalance(FUNDED_ADDRESS);
    console.log(`${timestamp()} Final ${L1NAME} native balance: ${nativeBalanceAfter} tokens`);

    // Calculate balance changes
    const balanceChange = balanceAfter - balanceBefore;
    const nativeBalanceChange = nativeBalanceAfter - nativeBalanceBefore;

    // Log the amount transferred
    console.log(`${timestamp()} Amount transferred: ${amount} tokens`);

    // Log the balance changes
    console.log(`${timestamp()} Amount changed in C-Chain USDC balance: ${balanceChange} tokens`);
    console.log(`${timestamp()} Amount changed in ${L1NAME} native balance: ${nativeBalanceChange} tokens`);

    // Check if the test is successful
    if (balanceChange > 0) {
        console.log(chalk.green(`${timestamp()} Balance change successful: ${balanceChange} tokens`));
    } else {
        console.log(chalk.red(`${timestamp()} Balance change failed: ${balanceChange} tokens`));
    }

    if (nativeBalanceChange < 0) {
        console.log(chalk.green(`${timestamp()} Native balance change successful: ${nativeBalanceChange} tokens (inclusive of gas spent)`));
    } else {
        console.log(chalk.red(`${timestamp()} Native balance change failed: ${nativeBalanceChange} tokens`));
    }

    console.log(`${timestamp()} Teleport complete. Transaction Hash: ${transactionHash}`);
}

// Execute the main function and catch any unhandled errors
main().catch(console.error);