// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.5.0;

import "../interface/IPair.sol";
import "../interface/IFactory.sol";

import "../lib/Math.sol";

library DystopiaLibrary {
    using Math for uint;

  struct Route {
    address from;
    address to;
    bool stable;
  }

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "DystopiaLibrary: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "DystopiaLibrary: ZERO_ADDRESS");
    }

    // calculates the CREATE2 address for a pair without making any external calls
  function pairFor(address factory,address tokenA, address tokenB, bool stable) public view returns (address pair) {
    (address token0, address token1) = sortTokens(tokenA, tokenB);
    pair = address(uint160(uint256(keccak256(abi.encodePacked(
        hex"ff",
        factory,
        keccak256(abi.encodePacked(token0, token1, stable)),
        hex"db868886fa0a8b0a09c64b8b4388eb7104dd74fceab8b8e98a929ed4eaf54406" // init code hash
      )))));
  }

    // fetches and sorts the reserves for a pair
    function getReserves(address factory, address tokenA, address tokenB, bool stable) internal view returns (uint reserveA, uint reserveB) {
        (address token0,) = sortTokens(tokenA, tokenB);
        (uint reserve0, uint reserve1,) = IPair(pairFor(factory, tokenA, tokenB,stable)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quoteLiquidity(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
        require(amountA > 0, "DystopiaLibrary: INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "DystopiaLibrary: INSUFFICIENT_LIQUIDITY");
        amountB = amountA*(reserveB) / reserveA;
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        require(amountIn > 0, "DystopiaLibrary: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "DystopiaLibrary: INSUFFICIENT_LIQUIDITY");
        uint amountInWithFee = amountIn*(997);
        uint numerator = amountInWithFee*(reserveOut);
        uint denominator = reserveIn*(1000)+(amountInWithFee);
        amountOut = numerator / denominator;
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn) {
        require(amountOut > 0, "DystopiaLibrary: INSUFFICIENT_OUTPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "DystopiaLibrary: INSUFFICIENT_LIQUIDITY");
        uint numerator = reserveIn*(amountOut)*(1000);
        uint denominator = reserveOut-(amountOut)*(997);
        amountIn = (numerator / denominator)+(1);
    }

      // performs chained getAmountOut calculations on any number of pairs
  function getAmountsOut(address factory,uint amountIn, Route[] memory routes) public view returns (uint[] memory amounts) {
    require(routes.length >= 1, "BaseV1Router: INVALID_PATH");
    amounts = new uint[](routes.length + 1);
    amounts[0] = amountIn;
    for (uint i = 0; i < routes.length; i++) {
      address pair = pairFor(factory,routes[i].from, routes[i].to, routes[i].stable);
      if (IFactory(factory).isPair(pair)) {
        amounts[i + 1] = IPair(pair).getAmountOut(amounts[i], routes[i].from);
      }
    }
  }

}