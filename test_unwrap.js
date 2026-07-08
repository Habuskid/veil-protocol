import { JsonRpcProvider, Contract } from 'ethers';

const rpc = "https://sepolia.infura.io/v3/4ab4fbfeeb6c459ca8c91a7065956799"; // Example, we can use public one
const provider = new JsonRpcProvider("https://rpc.sepolia.org");
const wrapperAddress = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639"; // mUSDC wrapper

const ABI = [
  "function unwrap(uint256 amount) external",
  "function unwrap(address to, uint256 amount) external",
  "function withdrawTo(address to, uint256 amount) external",
  "function unshield(uint256 amount) external",
  "function unshield(address to, uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function withdraw(address to, uint256 amount) external",
  "function requestUnwrap(uint256 amount) external",
];

async function main() {
  const contract = new Contract(wrapperAddress, ABI, provider);
  const from = "0xA217F46bD791Bbe2736C542F711132aCaAACFC7A"; // user address
  const amount = 100n;
  
  for (const func of ["unwrap(uint256)", "unwrap(address,uint256)", "withdrawTo", "unshield(uint256)", "unshield(address,uint256)", "withdraw(uint256)", "withdraw(address,uint256)", "requestUnwrap"]) {
    try {
      console.log(`Testing ${func}...`);
      if (func.includes("address")) {
        await contract[func].estimateGas(from, amount, { from });
      } else {
        await contract[func].estimateGas(amount, { from });
      }
      console.log(`✅ ${func} succeeded!`);
    } catch (e) {
      if (e.code === 'CALL_EXCEPTION' && !e.reason && !e.data) {
        console.log(`❌ ${func} missing function selector (CALL_EXCEPTION with no data)`);
      } else {
        console.log(`✅ ${func} exists, reverted with:`, e.reason || e.data || e.code);
      }
    }
  }
}

main().catch(console.error);
