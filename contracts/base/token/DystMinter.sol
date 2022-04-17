// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../../lib/Math.sol";
import "../../lib/SafeERC20.sol";
import "../../interface/IUnderlying.sol";
import "../../interface/IVoter.sol";
import "../../interface/IVe.sol";
import "../../interface/IVeDist.sol";
import "../../interface/IMinter.sol";
import "../../interface/IERC20.sol";

/// @title Codifies the minting rules as per ve(3,3),
///        abstracted from the token to support any token that allows minting
contract DystMinter is IMinter {
  using SafeERC20 for IERC20;

  /// @dev Allows minting once per week (reset every Thursday 00:00 UTC)
  uint internal constant _WEEK = 86400 * 7;
  uint internal constant _EMISSION = 98;
  uint internal constant _TAIL_EMISSION = 2;
  uint internal constant _LOCK_PERIOD = 86400 * 7 * 52 * 4;
  /// @dev 2% per week target emission
  uint internal constant _TARGET_BASE = 100;
  /// @dev 0.2% per week target emission
  uint internal constant _TAIL_BASE = 1000;
  IUnderlying public immutable token;
  IVoter public immutable voter;
  IVe public immutable ve;
  IVeDist public immutable veDist;
  uint public weekly = 5_000_000e18;
  uint public initialStubCirculationSupply;
  uint public activePeriod;

  address internal initializer;

  event Mint(address indexed sender, uint weekly, uint growth, uint circulating_supply, uint circulating_emission);

  constructor(
    address voter_, // the voting & distribution system
    address ve_, // the ve(3,3) system that will be locked into
    address veDist_ // the distribution system that ensures users aren't diluted
  ) {
    initializer = msg.sender;
    token = IUnderlying(IVe(ve_).token());
    voter = IVoter(voter_);
    ve = IVe(ve_);
    veDist = IVeDist(veDist_);
    activePeriod = (block.timestamp + (2 * _WEEK)) / _WEEK * _WEEK;
  }

  /// @dev sum amounts / max = % ownership of top protocols,
  ///      so if initial 20m is distributed, and target is 25% protocol ownership,
  ///      then max - 4 x 20m = 80m
  function initialize(
    address[] memory claimants,
    uint[] memory amounts,
    uint totalAmount
  ) external {
    require(initializer == msg.sender, "Not initializer");
    token.mint(address(this), totalAmount);
    // 20% of minted will be a stub circulation supply for a warming up period
    initialStubCirculationSupply = totalAmount / 5;
    token.approve(address(ve), type(uint).max);
    uint sum;
    for (uint i = 0; i < claimants.length; i++) {
      ve.create_lock_for(amounts[i], _LOCK_PERIOD, claimants[i]);
      sum += amounts[i];
    }
    require(sum == totalAmount, "Wrong total_amount");
    initializer = address(0);
    activePeriod = (block.timestamp + _WEEK) / _WEEK * _WEEK;
  }

  /// @dev Calculate circulating supply as total token supply - locked supply - veDist balance - minter balance
  function circulatingSupply() external view returns (uint) {
    return _circulatingSupply();
  }

  function _circulatingSupply() internal view returns (uint) {
    return token.totalSupply() - IUnderlying(address(ve)).totalSupply()
    // exclude veDist token balance from circulation - users unable to claim them without lock
    // late claim will lead to wrong circulation supply calculation
    - token.balanceOf(address(veDist))
    // exclude balance on minter, it is obviously locked
    - token.balanceOf(address(this));
  }

  function _circulatingSupplyAdjusted() internal view returns (uint) {
    // we need a stub supply for cover initial gap when huge amount of tokens was distributed and locked
    return Math.max(_circulatingSupply(), initialStubCirculationSupply);
  }

  /// @dev Emission calculation is 2% of available supply to mint adjusted by circulating / total supply
  function calculateEmission() external view returns (uint) {
    return _calculateEmission();
  }

  function _calculateEmission() internal view returns (uint) {
    // use adjusted circulation supply for avoid first weeks gaps
    return weekly * _EMISSION * _circulatingSupplyAdjusted() / _TARGET_BASE / token.totalSupply();
  }

  /// @dev Weekly emission takes the max of calculated (aka target) emission versus circulating tail end emission
  function weeklyEmission() external view returns (uint) {
    return _weeklyEmission();
  }

  function _weeklyEmission() internal view returns (uint) {
    return Math.max(_calculateEmission(), _circulatingEmission());
  }

  /// @dev Calculates tail end (infinity) emissions as 0.2% of total supply
  function circulatingEmission() external view returns (uint) {
    return _circulatingEmission();
  }

  function _circulatingEmission() internal view returns (uint) {
    return _circulatingSupply() * _TAIL_EMISSION / _TAIL_BASE;
  }

  /// @dev Calculate inflation and adjust ve balances accordingly
  function calculateGrowth(uint _minted) external view returns (uint) {
    return _calculateGrowth(_minted);
  }

  function _calculateGrowth(uint _minted) internal view returns (uint) {
    return IUnderlying(address(ve)).totalSupply() * _minted / token.totalSupply();
  }

  /// @dev Update period can only be called once per cycle (1 week)
  function updatePeriod() external override returns (uint) {
    uint _period = activePeriod;
    if (block.timestamp >= _period + _WEEK && initializer == address(0)) {// only trigger if new week
      _period = block.timestamp / _WEEK * _WEEK;
      activePeriod = _period;
      uint _weekly = _weeklyEmission();
      // slightly decrease weekly emission
      weekly = weekly * _EMISSION / _TARGET_BASE;
      // decrease stub supply every week until reach nearly zero amount
      if (initialStubCirculationSupply > _circulatingEmission()) {
        initialStubCirculationSupply -= initialStubCirculationSupply / 10;
      }

      uint _growth = _calculateGrowth(_weekly);
      uint _required = _growth + _weekly;
      uint _balanceOf = token.balanceOf(address(this));
      if (_balanceOf < _required) {
        token.mint(address(this), _required - _balanceOf);
      }

      IERC20(address(token)).safeTransfer(address(veDist), _growth);
      // checkpoint token balance that was just minted in ve_dist
      veDist.checkpoint_token();
      // checkpoint supply
      veDist.checkpoint_total_supply();

      token.approve(address(voter), _weekly);
      voter.notifyRewardAmount(_weekly);

      emit Mint(msg.sender, _weekly, _growth, _circulatingSupply(), _circulatingEmission());
    }
    return _period;
  }

}
