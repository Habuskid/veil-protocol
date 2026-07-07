import { createInstance, SepoliaConfig, initSDK } from '@zama-fhe/relayer-sdk/web';

// The re-encryption public key cache
let reencryptionKey = null;

// The global fhevmjs instance
let fhevmInstance = null;

export async function initZama() {
  if (fhevmInstance) return;
  console.log("Initializing FHEVM with relayer sdk...");

  await initSDK();

  fhevmInstance = await createInstance({
    ...SepoliaConfig,
    network: 'https://ethereum-sepolia-rpc.publicnode.com'
  });
  
  console.log('fhevmjs initialized successfully');
}

export function getFhevmInstance() {
  return fhevmInstance;
}

import { getAddress } from 'ethers';

// Cache for decryption sessions: userAddress -> contractAddress -> session
const decryptionSessions = {};

export async function decryptFhevm(contractAddress, userAddress, provider, balanceHandle) {
  if (!fhevmInstance) throw new Error("fhevmjs not initialized");

  const safeContractAddress = getAddress(contractAddress);
  const safeUserAddress = getAddress(userAddress);

  // If the handle is 0, the user has no balance yet (uninitialized ciphertext)
  // Calling the relayer with a 0 handle will hang/fail.
  if (balanceHandle === 0n || balanceHandle === 0 || balanceHandle === "0" || balanceHandle === "0x0") {
    return 0n;
  }

  const signer = await provider.getSigner(safeUserAddress);
  
  // Initialize cache for user if not exists
  if (!decryptionSessions[safeUserAddress]) {
    decryptionSessions[safeUserAddress] = {};
  }
  
  let session = decryptionSessions[safeUserAddress][safeContractAddress];
  
  if (!session) {
    const { publicKey, privateKey } = fhevmInstance.generateKeypair();
    const startTimeStamp = Math.floor(Date.now() / 1000);
    const durationDays = 7;
    const contractAddresses = [safeContractAddress];

    const eip712 = fhevmInstance.createEIP712(
      publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays
    );

    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    
    session = { publicKey, privateKey, signature, startTimeStamp, durationDays };
    decryptionSessions[safeUserAddress][safeContractAddress] = session;
  }
  
  // Format handle to hex string with 0x prefix if not already (assuming bigint or string input)
  let formattedHandle = balanceHandle;
  if (typeof balanceHandle === 'bigint') {
    formattedHandle = '0x' + balanceHandle.toString(16).padStart(64, '0');
  }

  const result = await fhevmInstance.userDecrypt(
    [{ handle: formattedHandle, contractAddress: safeContractAddress }],
    session.privateKey,
    session.publicKey,
    session.signature,
    [safeContractAddress],
    safeUserAddress,
    session.startTimeStamp,
    session.durationDays
  );

  const clearValues = Object.values(result);
  if (clearValues.length === 0) {
    throw new Error("No decryption result returned from KMS");
  }
  
  return clearValues[0];
}

export async function encryptFhevm(contractAddress, userAddress, amount) {
  if (!fhevmInstance) throw new Error("fhevmjs not initialized");

  const safeContractAddress = getAddress(contractAddress);
  const input = fhevmInstance.createEncryptedInput(safeContractAddress, userAddress);
  
  // Wrap amounts always use the wrapper's 6 decimals, so it fits in a 64-bit int
  input.add64(BigInt(amount));
  
  const encrypted = await input.encrypt();
  
  // encrypted.handles[0] is a Uint8Array, we must pass it as bytes32
  let handleHex = '0x';
  for (let i = 0; i < encrypted.handles[0].length; i++) {
    handleHex += encrypted.handles[0][i].toString(16).padStart(2, '0');
  }
  
  // Ethers expects bytes32 to be exactly 66 chars (0x + 64 hex chars).
  return handleHex.padEnd(66, '0');
}
