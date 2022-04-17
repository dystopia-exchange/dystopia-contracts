// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../lib/SafeERC20.sol";

contract BrokenToken {

  function transfer(address _to, uint256 _value) external pure {
  }

  function testBrokenTransfer() external {
    SafeERC20.safeTransfer(IERC20(address(this)), address(this), 1);
  }
}
