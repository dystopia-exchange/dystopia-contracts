// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface IOldMinter {
  event Mint(address indexed sender, uint weekly, uint circulating_supply, uint circulating_emission);
}
