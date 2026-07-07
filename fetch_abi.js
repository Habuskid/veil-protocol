import { Contract, JsonRpcProvider } from "ethers";

async function main() {
  const provider = new JsonRpcProvider("https://rpc.sepolia.org");
  const wrapperAddress = "0x5824c9d9f583eb1492D8f12117565df2001A8A2c".toLowerCase(); // mUSDC wrapper

  const abis = [
    "function unwrap(uint64 amount)",
    "function unwrap(uint256 amount)",
    "function unwrap(uint256 amount) returns (uint256)",
    "function unwrap(bytes amount)",
    "function unwrap(bytes amount) returns (uint256)"
  ];

  for (const abi of abis) {
    const c = new Contract(wrapperAddress, [abi], provider);
    try {
      console.log("Trying", abi);
      if (abi.includes("uint64")) await c["unwrap(uint64)"].staticCall(0n);
      else if (abi.includes("uint256")) await c["unwrap(uint256)"].staticCall(0n);
      else if (abi.includes("bytes amount")) await c["unwrap(bytes)"].staticCall("0x00");
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
