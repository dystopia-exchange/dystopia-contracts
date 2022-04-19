// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../base/core/DystPair.sol";
import "../base/vote/Ve.sol";

contract ContractTestHelper2 is IERC721Receiver {
  using SafeERC20 for IERC20;

  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) external pure returns (bytes4) {
    revert("stub revert");
  }

}
