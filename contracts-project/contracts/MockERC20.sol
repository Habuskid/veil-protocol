// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    // Public faucet – anyone can mint
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // decimals override if you need a custom value (e.g., 6)
    uint8 private _decimals;
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
