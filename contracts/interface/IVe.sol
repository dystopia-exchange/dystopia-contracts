// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface IVe {

  struct Point {
    int128 bias;
    int128 slope; // # -dweight / dt
    uint ts;
    uint blk; // block
  }
  /* We cannot really do block numbers per se b/c slope is per time, not per block
  * and per block could be fairly bad b/c Ethereum changes blocktimes.
  * What we can do is to extrapolate ***At functions */

  struct LockedBalance {
    int128 amount;
    uint end;
  }

  function token() external view returns (address);

  function balanceOfNFT(uint) external view returns (uint);

  function isApprovedOrOwner(address, uint) external view returns (bool);

  function create_lock_for(uint, uint, address) external returns (uint);

  function user_point_epoch(uint tokenId) external view returns (uint);

  function epoch() external view returns (uint);

  function user_point_history(uint tokenId, uint loc) external view returns (Point memory);

  function point_history(uint loc) external view returns (Point memory);

  function checkpoint() external;

  function deposit_for(uint tokenId, uint value) external;

  function attach(uint tokenId) external;

  function detach(uint tokenId) external;

  function voting(uint tokenId) external;

  function abstain(uint tokenId) external;
}
