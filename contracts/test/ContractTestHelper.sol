// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../base/core/DystPair.sol";
import "../base/vote/Ve.sol";
import "../interface/IVeDist.sol";

contract ContractTestHelper is IERC721Receiver {
  using SafeERC20 for IERC20;
  using Math for uint;

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

  function veFlashTransfer(address ve, uint tokenId) external {
    Ve(ve).safeTransferFrom(msg.sender, address(this), tokenId);
    require(Ve(ve).balanceOfNFT(tokenId) == 0, "not zero balance");
    Ve(ve).tokenURI(tokenId);
    Ve(ve).totalSupplyAt(block.number);
    Ve(ve).checkpoint();
    Ve(ve).checkpoint();
    Ve(ve).checkpoint();
    Ve(ve).checkpoint();
    Ve(ve).totalSupplyAt(block.number);
    Ve(ve).totalSupplyAt(block.number - 1);
    Ve(ve).safeTransferFrom(address(this), msg.sender, tokenId);
  }

  function multipleVeDistCheckpoints(address veDist) external {
    IVeDist(veDist).checkpointToken();
    IVeDist(veDist).checkpointToken();
    IVeDist(veDist).checkpointTotalSupply();
    IVeDist(veDist).checkpointTotalSupply();
  }

  function closeTo(uint a, uint b, uint target) external pure returns (bool){
    return a.closeTo(b, target);
  }

  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) external pure returns (bytes4) {
    return this.onERC721Received.selector;
  }

}
