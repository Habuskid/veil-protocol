import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk';
// or fhevmjs? We need to see what is exported.
import { getInstance } from 'fhevmjs';

console.log("Imports succeeded. Let's inspect exports.");
console.log("getInstance:", typeof getInstance);

import * as relayerSdk from '@zama-fhe/relayer-sdk';
console.log("relayerSdk exports:", Object.keys(relayerSdk));

