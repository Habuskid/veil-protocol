// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ConfidentialWrapper is ZamaEthereumConfig, ERC7984 {
    IERC20 public immutable underlying;

    constructor(
        IERC20 _underlying,
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC7984(name_, symbol_, tokenURI_) {
        underlying = _underlying;
    }

    /**
     * @dev Wrap plain ERC-20 into confidential ERC-7984.
     * @param amount Plaintext amount to wrap (in underlying decimals).
     */
    function wrap(uint64 amount) external {
        require(amount > 0, "Amount must be > 0");
        // Transfer plain tokens from user to this contract
        underlying.transferFrom(msg.sender, address(this), amount);
        // Mint encrypted tokens to user
        _mint(msg.sender, FHE.asEuint64(amount));
    }

    /**
     * @dev Unwrap confidential ERC-7984 back to plain ERC-20.
     * @param amount Plaintext amount to unwrap.
     * Reverts if the user's encrypted balance is too low.
     */
    function unwrap(uint64 amount) external {
        require(amount > 0, "Amount must be > 0");
        // Burn encrypted tokens - automatically reverts on insufficient balance
        _burn(msg.sender, FHE.asEuint64(amount));
        // Send plain tokens back
        underlying.transfer(msg.sender, amount);
    }
}
