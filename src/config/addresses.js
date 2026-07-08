// Zama Sepolia Wrappers Registry
export const REGISTRY_ADDRESS = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";

export const REGISTRY_ABI = [
  "function getTokenConfidentialTokenPairs() external view returns (tuple(address tokenAddress, address confidentialTokenAddress, bool isValid)[] memory)"
];

export const ERC20_ABI = [
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  // Some cTokenMocks use faucet or mint. We will try both if needed, or assume faucet.
  "function faucet(address to, uint256 amount) external",
  "function mint(address to, uint256 amount) external"
];

export const ERC7984_ABI = [
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)",
  "function decimals() external view returns (uint8)",
  // fhevm specific balanceOf returns a handle (bytes32 or uint256 handle depending on version)
  // We'll treat it as uint256 in ethers but it's an encrypted handle.
  "function balanceOf(address) external view returns (uint256)",
  "function confidentialBalanceOf(address) external view returns (uint256)" 
];

// The wrapper has multiple standard versions deployed on Sepolia
export const WRAPPER_ABI = [
  "function wrap(uint256 amount) external",
  "function wrap(uint64 amount) external",
  "function wrap(address to, uint256 amount) external",
  "function unwrap(uint256 amount) external",
  "function unwrap(uint64 amount) external",
  "function unwrap(address to, uint256 amount) external",
  "function unwrap(address from, address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)",
  "function unwrapAmount(bytes32) view returns (bytes32)",
  "function finalizeUnwrap(bytes32 unwrapRequestId, uint64 unwrapAmountCleartext, bytes decryptionProof)",
  "event UnwrapRequested(address indexed receiver, bytes32 indexed unwrapRequestId, bytes32 amount)",
  "event Unwrap(address indexed owner, uint256 amount)"
];
