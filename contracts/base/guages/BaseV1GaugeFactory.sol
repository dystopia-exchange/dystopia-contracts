// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../../interface/IGaugeFactory.sol";
import "./Gauge.sol";

contract BaseV1GaugeFactory is IGaugeFactory {
  address public last_gauge;

  function createGauge(
    address _pool,
    address _bribe,
    address _ve
  ) external override returns (address) {
    last_gauge = address(new Gauge(_pool, _bribe, _ve, msg.sender));
    return last_gauge;
  }

  function createGaugeSingle(
    address _pool,
    address _bribe,
    address _ve,
    address _voter
  ) external override returns (address) {
    last_gauge = address(new Gauge(_pool, _bribe, _ve, _voter));
    return last_gauge;
  }
}
