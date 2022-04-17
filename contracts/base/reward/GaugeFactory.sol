// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../../interface/IGaugeFactory.sol";
import "./Gauge.sol";

contract GaugeFactory is IGaugeFactory {
  address public lastGauge;

  function createGauge(
    address _pool,
    address _bribe,
    address _ve
  ) external override returns (address) {
    address _lastGauge = address(new Gauge(_pool, _bribe, _ve, msg.sender));
    lastGauge = _lastGauge;
    return _lastGauge;
  }

  function createGaugeSingle(
    address _pool,
    address _bribe,
    address _ve,
    address _voter
  ) external override returns (address) {
    address _lastGauge = address(new Gauge(_pool, _bribe, _ve, _voter));
    lastGauge = _lastGauge;
    return _lastGauge;
  }
}
