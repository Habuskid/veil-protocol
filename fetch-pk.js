import { ethers } from 'ethers';

const rpc = 'https://ethereum-sepolia-rpc.publicnode.com';
const provider = new ethers.JsonRpcProvider(rpc);

async function getPublicKey() {
    const kmsAddress = '0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC';
    // Let's try to fetch ABI for this address from etherscan, or just try common Zama KMS methods
    // Common methods: getPublicKey(), getTfhePublicKey(), publicKey()
    const abis = [
        "function getPublicKey() view returns (bytes)",
        "function getTfhePublicKey() view returns (bytes)",
        "function publicKey() view returns (bytes)",
        "function getPublicKeyInfo() view returns (bytes, bytes32)"
    ];
    
    for (const abi of abis) {
        const contract = new ethers.Contract(kmsAddress, [abi], provider);
        const methodName = abi.split(' ')[1].split('(')[0];
        try {
            console.log(`Trying ${methodName}...`);
            const res = await contract[methodName]();
            console.log(`Success with ${methodName}:`, res);
        } catch (e) {
            console.log(`Failed ${methodName}:`, e.message.slice(0, 50));
        }
    }
}

getPublicKey();
