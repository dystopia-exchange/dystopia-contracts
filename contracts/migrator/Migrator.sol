// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../interface/IPair.sol";
import "../interface/IRouter.sol";
import "../interface/IRouterOld.sol";
import "../interface/IFactory.sol";
import "../interface/IERC20.sol";
import "../interface/IUniswapV2Factory.sol";

contract Migrator {

  IUniswapV2Factory public oldFactory;
  IRouter public router;
  bytes32 public pairInitHashCode;

  constructor(IUniswapV2Factory _oldFactory, IRouter _router) {
    oldFactory = _oldFactory;
    router = _router;
  }

  function getOldPair(address tokenA, address tokenB) external view returns (address) {
    return oldFactory.getPair(tokenA, tokenB);
  }

  function getAmountsFromLiquidityForOldPair(
    address tokenA,
    address tokenB,
    uint liquidity
  ) external view returns (uint, uint){
    uint balanceA = IERC20(tokenA).balanceOf(address(this));
    uint balanceB = IERC20(tokenB).balanceOf(address(this));
    address pair = oldFactory.getPair(tokenA, tokenB);
    uint _totalSupply = IERC20(pair).totalSupply();
    return (liquidity * balanceA / _totalSupply, liquidity * balanceB / _totalSupply);
  }

  function migrateWithPermit(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public {
    IPair pair = IPair(oldFactory.getPair(tokenA, tokenB));
    pair.permit(msg.sender, address(this), liquidity, deadline, v, r, s);

    migrate(tokenA, tokenB, stable, liquidity, amountAMin, amountBMin, deadline);
  }

  // msg.sender should have approved "liquidity" amount of LP token of "tokenA" and "tokenB"
  function migrate(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    uint256 deadline
  ) public {
    require(deadline >= block.timestamp, "Swap: EXPIRED");

    // Remove liquidity from the old router with permit
    (uint256 amountA, uint256 amountB) = removeLiquidity(
      tokenA,
      tokenB,
      liquidity,
      amountAMin,
      amountBMin
    );

    // Add liquidity to the new router
    (uint256 pooledAmountA, uint256 pooledAmountB) = addLiquidity(tokenA, tokenB, stable, amountA, amountB);

    // Send remaining tokens to msg.sender
    if (amountA > pooledAmountA) {
      _safeTransfer(tokenA, msg.sender, amountA - pooledAmountA);
    }
    if (amountB > pooledAmountB) {
      _safeTransfer(tokenB, msg.sender, amountB - pooledAmountB);
    }
  }

  function removeLiquidity(
    address tokenA,
    address tokenB,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin
  ) public returns (uint256 amountA, uint256 amountB) {
    IPair pair = IPair(oldFactory.getPair(tokenA, tokenB));
    IERC20(address(pair)).transferFrom(msg.sender, address(pair), liquidity);
    (uint256 amount0, uint256 amount1) = pair.burn(address(this));
    (address token0,) = sortTokens(tokenA, tokenB);
    (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
    require(amountA >= amountAMin, "Migrator: INSUFFICIENT_A_AMOUNT");
    require(amountB >= amountBMin, "Migrator: INSUFFICIENT_B_AMOUNT");
  }

  function addLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 amountADesired,
    uint256 amountBDesired
  ) internal returns (uint amountA, uint amountB) {
    (amountA, amountB) = _addLiquidity(tokenA, tokenB, stable, amountADesired, amountBDesired);
    address pair = router.pairFor(tokenA, tokenB, stable);
    _safeTransfer(tokenA, pair, amountA);
    _safeTransfer(tokenB, pair, amountB);
    IPair(pair).mint(msg.sender);
  }

  function _addLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 amountADesired,
    uint256 amountBDesired
  ) internal returns (uint256 amountA, uint256 amountB) {
    // create the pair if it doesn"t exist yet
    IFactory factory = IFactory(router.factory());
    if (factory.getPair(tokenA, tokenB, stable) == address(0)) {
      factory.createPair(tokenA, tokenB, stable);
    }
    (uint256 reserveA, uint256 reserveB) = getReserves(router.factory(), tokenA, tokenB, stable);
    if (reserveA == 0 && reserveB == 0) {
      (amountA, amountB) = (amountADesired, amountBDesired);
    } else {
      uint256 amountBOptimal = quoteLiquidity(amountADesired, reserveA, reserveB);
      if (amountBOptimal <= amountBDesired) {
        (amountA, amountB) = (amountADesired, amountBOptimal);
      } else {
        uint256 amountAOptimal = quoteLiquidity(amountBDesired, reserveB, reserveA);
        assert(amountAOptimal <= amountADesired);
        (amountA, amountB) = (amountAOptimal, amountBDesired);
      }
    }
  }

  // returns sorted token addresses, used to handle return values from pairs sorted in this order
  function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
    require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
    (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), "ZERO_ADDRESS");
  }

  // fetches and sorts the reserves for a pair
  function getReserves(address factory, address tokenA, address tokenB, bool stable) internal view returns (uint reserveA, uint reserveB) {
    (address token0,) = sortTokens(tokenA, tokenB);
    (uint reserve0, uint reserve1,) = IPair(IFactory(factory).getPair(tokenA, tokenB, stable)).getReserves();
    (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
  }

  // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
  function quoteLiquidity(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
    require(amountA > 0, "INSUFFICIENT_AMOUNT");
    require(reserveA > 0 && reserveB > 0, "INSUFFICIENT_LIQUIDITY");
    amountB = amountA * (reserveB) / reserveA;
  }

  function _safeTransfer(address token, address to, uint256 value) internal {
    require(token.code.length > 0);
    (bool success, bytes memory data) =
    token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))));
  }
}
