// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../base/reward/MultiRewardsPoolBase.sol";


contract MultiRewardsPoolMock is MultiRewardsPoolBase {

  constructor(
    address _stake,
    address _operator,
    address[] memory _rewards
  ) MultiRewardsPoolBase(_stake, _operator, _rewards) {}

  // for test 2 deposits in one tx
  function testDoubleDeposit(uint amount) external {
    uint amount0 = amount / 2;
    uint amount1 = amount - amount0;
    _deposit(amount0);
    _deposit(amount1);
  }

  // for test 2 withdraws in one tx
  function testDoubleWithdraw(uint amount) external {
    uint amount0 = amount / 2;
    uint amount1 = amount - amount0;
    _withdraw(amount0);
    _withdraw(amount1);
  }

  function deposit(uint amount) external {
    _deposit(amount);
  }

  function withdraw(uint amount) external {
    _withdraw(amount);
  }

  function getReward(address account, address[] memory tokens) external {
    require(msg.sender == account, "Forbidden");
    _getReward(account, tokens, account);
  }

  function notifyRewardAmount(address token, uint amount) external {
    _notifyRewardAmount(token, amount);
  }

}
