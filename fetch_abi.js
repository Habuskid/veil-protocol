import { Contract, JsonRpcProvider } from "ethers";

async function main() {
  const provider = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
  const wrapperAddress = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639".toLowerCase(); // The user's contract

  const abis = [
    "function unwrap(uint64 amount)",
    "function unwrap(uint256 amount)",
    "function unwrap(bytes amount)"
  ];

  for (const abi of abis) {
    const c = new Contract(wrapperAddress, [abi], provider);
    try {
      console.log("Trying estimateGas for", abi);
      const dummyAddress = "0xA217F46bD791Bbe2736C542F711132aCaAACFC7A"; // random address
      if (abi.includes("uint64")) await c["unwrap(uint64)"].estimateGas(0n, { from: dummyAddress });
      else if (abi.includes("uint256")) await c["unwrap(uint256)"].estimateGas(0n, { from: dummyAddress });
      else if (abi.includes("bytes amount")) await c["unwrap(bytes)"].estimateGas("0x00", { from: dummyAddress });
      console.log("SUCCESS for", abi);
    } catch (e) {
      if (e.code === 'CALL_EXCEPTION') {
        if (e.message.includes("missing revert data")) {
           console.log("FAILED (Missing Revert Data - Function doesn't exist):", abi);
        } else {
           console.log("EXISTS (Reverted but exists):", abi);
        }
      } else {
        console.log("FAILED:", abi, e.message.split('\n')[0]);
      }
    }
  }
}
main();
