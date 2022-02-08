// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IVeDist {
  function checkpoint_token() external;

  function checkpoint_total_supply() external;
}
