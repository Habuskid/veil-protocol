import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Deploy Mock ERC-20 (e.g., 6 decimals like USDC)
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mock = await MockERC20.deploy("My USDC", "mUSDC", 6);
  await mock.waitForDeployment();
  console.log("MockERC20 deployed to:", mock.target);

  // 2. Deploy Confidential Wrapper
  const ConfidentialWrapper = await hre.ethers.getContractFactory("ConfidentialWrapper");
  const wrapper = await ConfidentialWrapper.deploy(
    mock.target,
    "Confidential mUSDC",  // name
    "cmUSDC",              // symbol
    ""                     // tokenURI (leave empty)
  );
  await wrapper.waitForDeployment();
  console.log("ConfidentialWrapper deployed to:", wrapper.target);
}

main().catch(console.error);
