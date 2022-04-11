// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../../interface/IERC20.sol";

contract GovernanceTreasury {

  address public owner;
  address public pendingOwner;

  event Claimed(address receipent, address token, uint amount);

  constructor() {
    owner = msg.sender;
  }

  function setOwner(address _owner) external {
    require(msg.sender == owner);
    pendingOwner = _owner;
  }

  function acceptOwner() external {
    require(msg.sender == pendingOwner);
    owner = pendingOwner;
  }

  function claim(address[] memory tokens) external {
    require(msg.sender == owner, "Not owner");
    for (uint i; i < tokens.length; i++) {
      address token = tokens[i];
      uint balance = IERC20(token).balanceOf(address(this));
      require(balance != 0, "Zero balance");
      _safeTransfer(token, msg.sender, balance);
      emit Claimed(msg.sender, token, balance);
    }
  }

  function _safeTransfer(address token, address to, uint256 value) internal {
    require(token.code.length > 0);
    (bool success, bytes memory data) =
    token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))));
  }

}
