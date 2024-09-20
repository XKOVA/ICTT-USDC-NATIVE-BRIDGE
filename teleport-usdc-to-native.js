require('dotenv').config();
const ethers = require('ethers');
const chalk = require('chalk');

// This script teleports USDC from the C-Chain to native tokens on an Avalanche L1 blockchain

// Load environment variables
const HOME_CHAIN_RPC_URL = process.env.HOME_CHAIN_RPC_URL;
const REMOTE_CHAIN_RPC_URL = process.env.REMOTE_CHAIN_RPC_URL;
const SUBNET_BLOCKCHAIN_ID_HEX = process.env.SUBNET_BLOCKCHAIN_ID_HEX;
const ERC20_HOME_C_CHAIN = process.env.ERC20_HOME_C_CHAIN;
const ERC20_HOME_TRANSFERER_C_CHAIN = process.env.ERC20_HOME_TRANSFERER_C_CHAIN;
const NATIVE_TOKEN_REMOTE_SUBNET = process.env.NATIVE_TOKEN_REMOTE_SUBNET;
const FUNDED_ADDRESS = process.env.FUNDED_ADDRESS;
const PRIVATE_KEY = process.env.PKXKOVA;
const L1NAME = process.env.L1NAME;

const MAX_UINT256 = ethers.constants.MaxUint256; // approve max USDC for testing purposes
const WAIT_TIME_MS = 60000; // Adjust the wait time as needed
const AMOUNT_TO_BRIDGE = 0.001; // Adjust the amount to bridge as needed

// Validate environment variables
if (!HOME_CHAIN_RPC_URL || !REMOTE_CHAIN_RPC_URL || !FUNDED_ADDRESS || !SUBNET_BLOCKCHAIN_ID_HEX || !ERC20_HOME_C_CHAIN || !ERC20_HOME_TRANSFERER_C_CHAIN || !NATIVE_TOKEN_REMOTE_SUBNET || !L1NAME || !PRIVATE_KEY) {
    console.error("Error: One or more required environment variables are missing.");
    process.exit(1);
}

// Log the environment variables
console.log("HOME_CHAIN_RPC_URL:", HOME_CHAIN_RPC_URL);
console.log("REMOTE_CHAIN_RPC_URL:", REMOTE_CHAIN_RPC_URL);

const provider = new ethers.providers.JsonRpcProvider(HOME_CHAIN_RPC_URL);
const remoteProvider = new ethers.providers.JsonRpcProvider(REMOTE_CHAIN_RPC_URL);

// ABI for the contract function we will call
const ERC20_HOME_TRANSFERER_C_CHAIN_ABI = ["function send((bytes32, address, address, address, uint256, uint256, uint256, address), uint256)"];

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

// Function to get the ERC20 token allowance of an address
async function getERC20Allowance(owner, spender) {
    const abi = ["function allowance(address owner, address spender) view returns (uint256)"];
    const contract = new ethers.Contract(ERC20_HOME_C_CHAIN, abi, provider);
    const allowance = await contract.allowance(owner, spender);
    return allowance;
}

// Function to approve ERC20 token transfer
async function approveERC20(privateKey, amount) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const abi = ["function approve(address spender, uint256 amount) returns (bool)"];
    const contract = new ethers.Contract(ERC20_HOME_C_CHAIN, abi, wallet);

    try {
        const tx = await contract.approve(ERC20_HOME_TRANSFERER_C_CHAIN, amount);
        await tx.wait();
        console.log('Approval successful! Amount approved:', amount.toString());
    } catch (error) {
        console.error('Approval failed:', error);
        throw error;
    }
}

// Function to send a teleport transaction
async function sendTeleportTransaction(privateKey, amount) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(ERC20_HOME_TRANSFERER_C_CHAIN, ERC20_HOME_TRANSFERER_C_CHAIN_ABI, wallet);

    // Data required for the teleport transaction ie: ERC20TokenHome.sol
    const teleportData = [
        SUBNET_BLOCKCHAIN_ID_HEX,        // Blockchain ID of the Subnet
        NATIVE_TOKEN_REMOTE_SUBNET,      // Address of the native token on the remote subnet
        FUNDED_ADDRESS,                  // Address that will receive the tokens
        ERC20_HOME_C_CHAIN,              // Address of the token to be transferred
        0,                               // Amount of tokens to be transferred (0 for native token)
        0,                               // Fee amount (0 for no fee)
        250000,                          // Gas limit for the transaction
        ethers.constants.AddressZero     // Address to receive the fee (zero address for no fee)
    ];

    try {
        const tx = await contract.send(teleportData, ethers.utils.parseUnits(amount.toString(), 6));
        const receipt = await tx.wait();
        return {
            transactionHash: receipt.transactionHash,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice
        };
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
}

// Helper function to format timestamps consistently
function timestamp() {
    return `[${new Date().toISOString()}]`;
}

// Main function to execute the teleport process
async function main() {
    const amount = AMOUNT_TO_BRIDGE;
    const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);

    console.log(`${timestamp()} Starting teleport of ${amount} USDC to native tokens`);

    // Check initial balances
    const balanceBefore = await getERC20Balance(FUNDED_ADDRESS);
    console.log(`${timestamp()} Initial C-Chain USDC balance: ${balanceBefore} USDC`);

    const nativeBalanceBefore = await getNativeBalance(FUNDED_ADDRESS);
    console.log(`${timestamp()} Initial ${L1NAME} native balance: ${nativeBalanceBefore} tokens`);

    // Check for sufficient balance
    if (ethers.utils.parseUnits(balanceBefore, 6).lt(amountInWei)) {
        console.error(`${timestamp()} Insufficient USDC balance. Required: ${amount}, Available: ${balanceBefore}`);
        return;
    }

    console.log(`${timestamp()} Sufficient USDC balance available. Proceeding with transaction.`);

    // Check and approve allowance if necessary
    const allowance = await getERC20Allowance(FUNDED_ADDRESS, ERC20_HOME_TRANSFERER_C_CHAIN);
    if (allowance.lt(amountInWei)) {
        console.log(`${timestamp()} Insufficient allowance. Approving required amount...`);
        try {
            await approveERC20(PRIVATE_KEY, MAX_UINT256);
            console.log(`${timestamp()} Approval successful.`);
        } catch (error) {
            console.error(`${timestamp()} Approval failed:`, error);
            return;
        }
    } else {
        console.log(`${timestamp()} Sufficient allowance available.`);
    }

    let transactionDetails;
    try {
        // Send the teleport transaction
        transactionDetails = await sendTeleportTransaction(PRIVATE_KEY, amount);
        console.log(`${timestamp()} Transaction sent. Transaction Hash: ${transactionDetails.transactionHash}`);
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

    // Calculate gas cost
    let gasCost = ethers.BigNumber.from(0);
    if (transactionDetails.gasUsed && transactionDetails.effectiveGasPrice) {
        gasCost = transactionDetails.gasUsed.mul(transactionDetails.effectiveGasPrice);
    }
    const gasCostEther = ethers.utils.formatEther(gasCost);

    // Calculate balance changes
    const balanceChange = parseFloat(balanceAfter) - parseFloat(balanceBefore);
    const nativeBalanceChange = parseFloat(nativeBalanceAfter) - parseFloat(nativeBalanceBefore);
    const expectedNativeBalanceChange = parseFloat(amount) - parseFloat(gasCostEther);

    // Log the amount transferred and gas cost
    console.log(`${timestamp()} Amount transferred: ${amount} tokens`);
    console.log(`${timestamp()} Gas cost: ${gasCostEther} tokens`);

    // Log the balance changes
    console.log(`${timestamp()} Amount changed in C-Chain USDC balance: ${balanceChange.toFixed(18)} tokens`);
    console.log(`${timestamp()} Amount changed in ${L1NAME} native balance: ${nativeBalanceChange.toFixed(18)} tokens`);
    console.log(`${timestamp()} Expected change in ${L1NAME} native balance: ${expectedNativeBalanceChange.toFixed(18)} tokens`);

    // Check if the test is successful
    const tolerance = 0.01; // 1% test tolerance to account for floating point precision

    if (Math.abs(balanceChange + parseFloat(amount)) < tolerance * parseFloat(amount)) {
        console.log(chalk.green(`${timestamp()} C-Chain USDC balance change successful: ${balanceChange.toFixed(18)} tokens`));
    } else {
        console.log(chalk.red(`${timestamp()} C-Chain USDC balance change failed: ${balanceChange.toFixed(18)} tokens`));
    }

    if (Math.abs(nativeBalanceChange - parseFloat(amount)) < tolerance * parseFloat(amount)) {
        console.log(chalk.green(`${timestamp()} ${L1NAME} native balance change successful: ${nativeBalanceChange.toFixed(18)} tokens tokens (inclusive of tolerance)`));
    } else {
        console.log(chalk.red(`${timestamp()} ${L1NAME} native balance change failed: ${nativeBalanceChange.toFixed(18)} tokens`));
    }

    console.log(`${timestamp()} Teleport complete. Transaction Hash: ${transactionDetails.transactionHash}`);
}

// Execute the main function and catch any unhandled errors
main().catch(console.error);

