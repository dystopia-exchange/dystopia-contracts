// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface IGaugeFactory {
  function createGauge(address _pool, address _bribe, address _ve) external returns (address);

  function createGaugeSingle(address _pool, address _bribe, address _ve, address _voter) external returns (address);
}
