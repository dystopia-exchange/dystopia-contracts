// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../interface/IPair.sol";
import "../interface/IRouter.sol";
import "../interface/IRouterOld.sol";
import "../interface/IFactory.sol";
import "../interface/IERC20.sol";
import "../interface/IUniswapV2Factory.sol";
import "../lib/SafeERC20.sol";

contract Migrator {
  using SafeERC20 for IERC20;

  IUniswapV2Factory public oldFactory;
  IRouter public router;

  constructor(IUniswapV2Factory _oldFactory, IRouter _router) {
    oldFactory = _oldFactory;
    router = _router;
  }

  function getOldPair(address tokenA, address tokenB) external view returns (address) {
    return oldFactory.getPair(tokenA, tokenB);
  }

  function migrateWithPermit(
    address tokenA,
    address tokenB,
    bool stable,
    uint liquidity,
    uint amountAMin,
    uint amountBMin,
    uint deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    IPair pair = IPair(oldFactory.getPair(tokenA, tokenB));
    pair.permit(msg.sender, address(this), liquidity, deadline, v, r, s);

    migrate(tokenA, tokenB, stable, liquidity, amountAMin, amountBMin, deadline);
  }

  // msg.sender should have approved "liquidity" amount of LP token of "tokenA" and "tokenB"
  function migrate(
    address tokenA,
    address tokenB,
    bool stable,
    uint liquidity,
    uint amountAMin,
    uint amountBMin,
    uint deadline
  ) public {
    require(deadline >= block.timestamp, "Migrator: EXPIRED");

    // Remove liquidity from the old router with permit
    (uint amountA, uint amountB) = removeLiquidity(
      tokenA,
      tokenB,
      liquidity,
      amountAMin,
      amountBMin
    );

    // Add liquidity to the new router
    (uint pooledAmountA, uint pooledAmountB) = addLiquidity(tokenA, tokenB, stable, amountA, amountB);

    // Send remaining tokens to msg.sender
    if (amountA > pooledAmountA) {
      IERC20(tokenA).safeTransfer(msg.sender, amountA - pooledAmountA);
    }
    if (amountB > pooledAmountB) {
      IERC20(tokenB).safeTransfer(msg.sender, amountB - pooledAmountB);
    }
  }

  function removeLiquidity(
    address tokenA,
    address tokenB,
    uint liquidity,
    uint amountAMin,
    uint amountBMin
  ) public returns (uint amountA, uint amountB) {
    IPair pair = IPair(oldFactory.getPair(tokenA, tokenB));
    IERC20(address(pair)).safeTransferFrom(msg.sender, address(pair), liquidity);
    (uint amount0, uint amount1) = pair.burn(address(this));
    (address token0,) = sortTokens(tokenA, tokenB);
    (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
    require(amountA >= amountAMin, "Migrator: INSUFFICIENT_A_AMOUNT");
    require(amountB >= amountBMin, "Migrator: INSUFFICIENT_B_AMOUNT");
  }

  function addLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint amountADesired,
    uint amountBDesired
  ) internal returns (uint amountA, uint amountB) {
    (amountA, amountB) = _addLiquidity(tokenA, tokenB, stable, amountADesired, amountBDesired);
    address pair = router.pairFor(tokenA, tokenB, stable);
    IERC20(tokenA).safeTransfer(pair, amountA);
    IERC20(tokenB).safeTransfer(pair, amountB);
    IPair(pair).mint(msg.sender);
  }

  function _addLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint amountADesired,
    uint amountBDesired
  ) internal returns (uint amountA, uint amountB) {
    // create the pair if it doesn"t exist yet
    IFactory factory = IFactory(router.factory());
    if (factory.getPair(tokenA, tokenB, stable) == address(0)) {
      factory.createPair(tokenA, tokenB, stable);
    }
    (uint reserveA, uint reserveB) = _getReserves(router.factory(), tokenA, tokenB, stable);
    if (reserveA == 0 && reserveB == 0) {
      (amountA, amountB) = (amountADesired, amountBDesired);
    } else {
      uint amountBOptimal = quoteLiquidity(amountADesired, reserveA, reserveB);
      if (amountBOptimal <= amountBDesired) {
        (amountA, amountB) = (amountADesired, amountBOptimal);
      } else {
        uint amountAOptimal = quoteLiquidity(amountBDesired, reserveB, reserveA);
        assert(amountAOptimal <= amountADesired);
        (amountA, amountB) = (amountAOptimal, amountBDesired);
      }
    }
  }

  // returns sorted token addresses, used to handle return values from pairs sorted in this order
  function sortTokens(address tokenA, address tokenB) public pure returns (address token0, address token1) {
    require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
    (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), "ZERO_ADDRESS");
  }

  // fetches and sorts the reserves for a pair
  function _getReserves(address factory, address tokenA, address tokenB, bool stable) internal view returns (uint reserveA, uint reserveB) {
    (address token0,) = sortTokens(tokenA, tokenB);
    (uint reserve0, uint reserve1,) = IPair(IFactory(factory).getPair(tokenA, tokenB, stable)).getReserves();
    (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
  }

  // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
  function quoteLiquidity(uint amountA, uint reserveA, uint reserveB) public pure returns (uint amountB) {
    require(amountA > 0, "INSUFFICIENT_AMOUNT");
    require(reserveA > 0 && reserveB > 0, "INSUFFICIENT_LIQUIDITY");
    amountB = amountA * (reserveB) / reserveA;
  }

}
