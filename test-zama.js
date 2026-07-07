import { createInstance } from 'fhevmjs';

async function test() {
  try {
    const instance = await createInstance({
      chainId: 11155111,
      gatewayChainId: 55815,
      networkUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
      relayerUrl: 'https://relayer.testnet.zama.cloud',
      aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
      kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
    });
    console.log("Success");
  } catch (e) {
    console.error("Failed:", e);
  }
}

test();
