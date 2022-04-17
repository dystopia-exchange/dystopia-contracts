// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "./Bribe.sol";
import "../../interface/IBribeFactory.sol";

contract BribeFactory is IBribeFactory {
  address public lastGauge;

  function createBribe() external override returns (address) {
    address _lastGauge = address(new Bribe(msg.sender));
    lastGauge = _lastGauge;
    return _lastGauge;
  }
}
