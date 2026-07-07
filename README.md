# Veil Protocol - Zama Confidential Wrapper UI

Veil Protocol is a production-ready decentralized application built for the Zama ecosystem. It serves as a canonical interface for interacting with the official Zama Wrappers Registry on the Sepolia testnet. 

Veil Protocol solves ecosystem fragmentation by providing developers and users with a seamless, highly polished path of least resistance to find, shield (wrap), unshield (unwrap), and decrypt confidential ERC-7984 tokens.

## Live Deployment
- **URL:** [https://veil-protocol1.vercel.app/](https://veil-protocol1.vercel.app/)
- **Supported Network:** Sepolia Testnet

## Features

- **Hybrid Registry Browsing (Robust Fallback):** As per the hackathon requirements, the application natively reads from the official on-chain `WrappersRegistry` on Sepolia as the primary source of truth. However, querying multiple `ERC20` metadata values simultaneously often results in public RPC node rate-limiting. For absolute stability, Veil Protocol merges the on-chain data with a local configuration (`src/config/pairs.json`). If the RPC node fails to fetch a token's symbol dynamically, the app gracefully falls back to default values while preserving the pair, ensuring a seamless user experience.
- **Shield (Wrap) & Unshield (Unwrap):** Convert any public ERC-20 into its ERC-7984 confidential equivalent (Shielding), and convert it back (Unshielding) with a clean, one-click UX handling approvals and wrapping seamlessly.
- **EIP-712 User Decryption:** View the decrypted balance of *any* ERC-7984 token in your wallet via a paste-an-address flow. This utilizes the FHEVM KMS signature flow to securely reveal balances without exposing them on-chain.
- **Integrated Faucet:** Instantly claim 1,000 official `cTokenMock` test tokens directly from the interface to immediately test the Shield/Unshield flow.

## 🛡 Security & FHEVM
- Balances of ERC-7984 tokens are strictly confidential.
- Decryption relies on KMS EIP-712 wallet signatures.
- FHE operations run on the Zama FHEVM network.

## How to Add a New Wrapper Pair (Extensibility)

Adding a new ERC-20 ↔ ERC-7984 pair to Veil Protocol is incredibly simple and developer-friendly. The app uses a local configuration file that serves as the source of truth for the registry rendering.

**Steps to add a custom pair:**
1. Navigate to `src/config/pairs.json`.
2. Append your new wrapper pair object to the JSON array.
3. Ensure you provide the `erc20` (public token) address, the `erc7984` (confidential wrapper) address, and a boolean `isVerified`.

**Example:**
```json
{
  "erc20": "0xYourPublicERC20Address",
  "erc7984": "0xYourConfidentialWrapperAddress",
  "isVerified": true
}
```
Upon saving, the app will automatically render your new pair in both the Registry browsing tab and the Faucet tab (if the underlying ERC-20 has a public `mint` function).

## Shielding vs. Wrapping
In the context of Zama's FHEVM, **Shielding** a token is the act of encrypting a public balance into a confidential balance. **Unshielding** is the act of decrypting a confidential balance back into a public balance. 

In Veil Protocol, these actions are represented by the **Wrap** (Shield) and **Unwrap** (Unshield) actions. Wrapping an ERC-20 converts it to an ERC-7984, effectively shielding it.

## Local Development

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build
```

## Tech Stack
- React / Vite
- TailwindCSS
- Ethers.js v6
- `fhevmjs` (Zama FHEVM Relayer SDK)

## Deployed Contracts (Sepolia)

### Core Infrastructure
- **Wrappers Registry:** `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`

### Supported Confidential Wrapper Pairs
| Public Token (ERC-20) | Confidential Wrapper (ERC-7984) |
| --- | --- |
| `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` |
| `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0` | `0x4E7B06D78965594eB5EF5414c357ca21E1554491` |
| `0xff54739b16576FA5402F211D0b938469Ab9A5f3F` | `0x46208622DA27d91db4f0393733C8BA082ed83158` |
| `0xFf021fB13cA64e5354c62c954b949a88cfDEb25E` | `0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891` |
| `0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57` | `0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB` |
| `0x93c931278A2aad1916783F952f94276eA5111442` | `0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC` |
| `0x24377AE4AA0C45ecEe71225007f17c5D423dd940` | `0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7` |
| `0xf6Ef9ADB61A48E29E36bc873070A46A3D2667ff3` | `0x167DC962808B32CFFFc7e14B5018c0bE06A3A208` |
