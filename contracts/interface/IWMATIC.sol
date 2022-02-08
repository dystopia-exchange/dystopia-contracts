// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IWFTM {
  function deposit() external payable returns (uint);

  function transfer(address to, uint value) external returns (bool);

  function withdraw(uint) external returns (uint);
}
