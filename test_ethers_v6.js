import { Contract } from "ethers";

const WRAPPER_ABI = [
  "function wrap(uint64 amount) external",
  "function unwrap(uint64 amount) external",
  "function wrap(address to, uint256 amount) external",
  "function unwrap(uint256 amount) external",
  "function unwrap(address tokenOut, address to, bytes32 encryptedAmount) external"
];

const c = new Contract("0x0000000000000000000000000000000000000000", WRAPPER_ABI);
console.log(typeof c["unwrap(uint256)"]);
console.log(typeof c["unwrap(uint64)"]);
