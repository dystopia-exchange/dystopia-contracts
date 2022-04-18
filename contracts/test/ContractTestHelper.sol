// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../base/core/DystPair.sol";

contract ContractTestHelper {
  using SafeERC20 for IERC20;

  function pairCurrentTwice(address pair, address tokenIn, uint amountIn) external returns (uint, uint){
    uint c0 = DystPair(pair).current(tokenIn, amountIn);
    DystPair(pair).sync();
    uint c1 = DystPair(pair).current(tokenIn, amountIn);
    return (c0, c1);
  }

  function hook(address, uint amount0, uint amount1, bytes calldata data) external {
    address pair = abi.decode(data, (address));
    (address token0, address token1) = DystPair(pair).tokens();
    if (amount0 != 0) {
      IERC20(token0).safeTransfer(pair, amount0);
    }
    if (amount1 != 0) {
      IERC20(token1).safeTransfer(pair, amount1);
    }
  }

  function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) public pure returns (uint amountOut) {
    // without fee
    uint amountInWithFee = amountIn * 1000;
    uint numerator = amountInWithFee * reserveOut;
    uint denominator = reserveIn * 1000 + amountInWithFee;
    amountOut = numerator / denominator;
  }

}
