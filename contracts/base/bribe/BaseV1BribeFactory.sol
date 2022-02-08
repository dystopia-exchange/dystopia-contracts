// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./Bribe.sol";
import "../../interface/IBribeFactory.sol";

contract BaseV1BribeFactory is IBribeFactory {
  address public last_gauge;

  function createBribe() external override returns (address) {
    last_gauge = address(new Bribe(msg.sender));
    return last_gauge;
  }
}
