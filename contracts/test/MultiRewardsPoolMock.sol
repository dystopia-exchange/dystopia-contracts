// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../base/gauges/MultiRewardsPoolBase.sol";


contract MultiRewardsPoolMock is MultiRewardsPoolBase {

  constructor(address _stake) MultiRewardsPoolBase(_stake) {}

  function deposit(uint amount) external override {
    _deposit(amount);
  }

  function withdraw(uint amount) external override {
    _withdraw(amount);
  }

  function getReward(address account, address[] memory tokens) external override {
    _getReward(account, tokens);
  }

  function notifyRewardAmount(address token, uint amount) external override {
    _notifyRewardAmount(token, amount);
  }

}
