// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../../interface/IFactory.sol";
import "./BaseV1Pair.sol";

contract BaseV1Factory is IFactory {

  bool public override isPaused;
  address public pauser;
  address public pendingPauser;

  mapping(address => mapping(address => mapping(bool => address))) public override getPair;
  address[] public allPairs;
  /// @dev Simplified check if its a pair, given that `stable` flag might not be available in peripherals
  mapping(address => bool) public override isPair;

  address internal _temp0;
  address internal _temp1;
  bool internal _temp;

  event PairCreated(
    address indexed token0,
    address indexed token1,
    bool stable,
    address pair,
    uint allPairsLength
  );

  constructor() {
    pauser = msg.sender;
    isPaused = false;
  }

  function allPairsLength() external view returns (uint) {
    return allPairs.length;
  }

  function setPauser(address _pauser) external {
    require(msg.sender == pauser);
    pendingPauser = _pauser;
  }

  function acceptPauser() external {
    require(msg.sender == pendingPauser);
    pauser = pendingPauser;
  }

  function setPause(bool _state) external {
    require(msg.sender == pauser);
    isPaused = _state;
  }

  function pairCodeHash() external pure override returns (bytes32) {
    return keccak256(type(BaseV1Pair).creationCode);
  }

  function getInitializable() external view override returns (address, address, bool) {
    return (_temp0, _temp1, _temp);
  }

  function createPair(address tokenA, address tokenB, bool stable)
  external override returns (address pair) {
    // BaseV1: IDENTICAL_ADDRESSES
    require(tokenA != tokenB, 'IA');
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    // BaseV1: ZERO_ADDRESS
    require(token0 != address(0), 'ZA');
    // BaseV1: PAIR_EXISTS - single check is sufficient
    require(getPair[token0][token1][stable] == address(0), 'PE');
    // notice salt includes stable as well, 3 parameters
    bytes32 salt = keccak256(abi.encodePacked(token0, token1, stable));
    (_temp0, _temp1, _temp) = (token0, token1, stable);
    pair = address(new BaseV1Pair{salt : salt}());
    getPair[token0][token1][stable] = pair;
    // populate mapping in the reverse direction
    getPair[token1][token0][stable] = pair;
    allPairs.push(pair);
    isPair[pair] = true;
    emit PairCreated(token0, token1, stable, pair, allPairs.length);
  }
}
