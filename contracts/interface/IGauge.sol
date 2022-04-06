// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface IGauge {

  /// @notice A checkpoint for marking balance
  struct Checkpoint {
    uint timestamp;
    uint balanceOf;
  }

  /// @notice A checkpoint for marking reward rate
  struct RewardPerTokenCheckpoint {
    uint timestamp;
    uint rewardPerToken;
  }

  /// @notice A checkpoint for marking supply
  struct SupplyCheckpoint {
    uint timestamp;
    uint supply;
  }

  function notifyRewardAmount(address token, uint amount) external;

  function getReward(address account, address[] memory tokens) external;

  function claimFees() external returns (uint claimed0, uint claimed1);

  function left(address token) external view returns (uint);

}
