// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "../../interface/IVe.sol";
import "../../interface/IVoter.sol";
import "../../interface/IERC20.sol";
import "../../interface/IERC721.sol";
import "../../interface/IGauge.sol";
import "../../interface/IFactory.sol";
import "../../interface/IPair.sol";
import "../../interface/IBribeFactory.sol";
import "../../interface/IGaugeFactory.sol";
import "../../interface/IMinter.sol";
import "../../interface/IBribe.sol";
import "../../interface/IMultiRewardsPool.sol";
import "../Reentrancy.sol";
import "../../lib/SafeERC20.sol";

contract DystVoter is IVoter, Reentrancy {
  using SafeERC20 for IERC20;

  /// @dev The ve token that governs these contracts
  address public immutable override ve;
  /// @dev DystFactory
  address public immutable factory;
  address public immutable token;
  address public immutable gaugeFactory;
  address public immutable bribeFactory;
  /// @dev Rewards are released over 7 days
  uint internal constant DURATION = 7 days;
  address public minter;

  /// @dev Total voting weight
  uint public totalWeight;

  /// @dev All pools viable for incentives
  address[] public pools;
  /// @dev pool => gauge
  mapping(address => address) public gauges;
  /// @dev gauge => pool
  mapping(address => address) public poolForGauge;
  /// @dev gauge => bribe
  mapping(address => address) public bribes;
  /// @dev pool => weight
  mapping(address => int256) public weights;
  /// @dev nft => pool => votes
  mapping(uint => mapping(address => int256)) public votes;
  /// @dev nft => pools
  mapping(uint => address[]) public poolVote;
  /// @dev nft => total voting weight of user
  mapping(uint => uint) public usedWeights;
  mapping(address => bool) public isGauge;
  mapping(address => bool) public isWhitelisted;

  uint public index;
  mapping(address => uint) public supplyIndex;
  mapping(address => uint) public claimable;

  event GaugeCreated(address indexed gauge, address creator, address indexed bribe, address indexed pool);
  event Voted(address indexed voter, uint tokenId, int256 weight);
  event Abstained(uint tokenId, int256 weight);
  event Deposit(address indexed lp, address indexed gauge, uint tokenId, uint amount);
  event Withdraw(address indexed lp, address indexed gauge, uint tokenId, uint amount);
  event NotifyReward(address indexed sender, address indexed reward, uint amount);
  event DistributeReward(address indexed sender, address indexed gauge, uint amount);
  event Attach(address indexed owner, address indexed gauge, uint tokenId);
  event Detach(address indexed owner, address indexed gauge, uint tokenId);
  event Whitelisted(address indexed whitelister, address indexed token);

  constructor(address _ve, address _factory, address _gaugeFactory, address _bribeFactory) {
    ve = _ve;
    factory = _factory;
    token = IVe(_ve).token();
    gaugeFactory = _gaugeFactory;
    bribeFactory = _bribeFactory;
    minter = msg.sender;
  }

  function initialize(address[] memory _tokens, address _minter) external {
    require(msg.sender == minter, "!minter");
    for (uint i = 0; i < _tokens.length; i++) {
      _whitelist(_tokens[i]);
    }
    minter = _minter;
  }

  /// @dev Amount of tokens required to be hold for whitelisting.
  function listingFee() external view returns (uint) {
    return _listingFee();
  }

  /// @dev 20% of circulation supply.
  function _listingFee() internal view returns (uint) {
    return (IERC20(token).totalSupply() - IERC20(ve).totalSupply()) / 5;
  }

  /// @dev Remove all votes for given tokenId.
  function reset(uint _tokenId) external {
    require(IVe(ve).isApprovedOrOwner(msg.sender, _tokenId), "!owner");
    _reset(_tokenId);
    IVe(ve).abstain(_tokenId);
  }

  function _reset(uint _tokenId) internal {
    address[] storage _poolVote = poolVote[_tokenId];
    uint _poolVoteCnt = _poolVote.length;
    int256 _totalWeight = 0;

    for (uint i = 0; i < _poolVoteCnt; i ++) {
      address _pool = _poolVote[i];
      int256 _votes = votes[_tokenId][_pool];
      _updateFor(gauges[_pool]);
      weights[_pool] -= _votes;
      votes[_tokenId][_pool] -= _votes;
      if (_votes > 0) {
        IBribe(bribes[gauges[_pool]])._withdraw(uint(_votes), _tokenId);
        _totalWeight += _votes;
      } else {
        _totalWeight -= _votes;
      }
      emit Abstained(_tokenId, _votes);
    }
    totalWeight -= uint(_totalWeight);
    usedWeights[_tokenId] = 0;
    delete poolVote[_tokenId];
  }

  /// @dev Resubmit exist votes for given token. For internal purposes.
  function poke(uint _tokenId) external {
    address[] memory _poolVote = poolVote[_tokenId];
    uint _poolCnt = _poolVote.length;
    int256[] memory _weights = new int256[](_poolCnt);

    for (uint i = 0; i < _poolCnt; i ++) {
      _weights[i] = votes[_tokenId][_poolVote[i]];
    }

    _vote(_tokenId, _poolVote, _weights);
  }

  function _vote(uint _tokenId, address[] memory _poolVote, int256[] memory _weights) internal {
    _reset(_tokenId);
    uint _poolCnt = _poolVote.length;
    int256 _weight = int256(IVe(ve).balanceOfNFT(_tokenId));
    int256 _totalVoteWeight = 0;
    int256 _totalWeight = 0;
    int256 _usedWeight = 0;

    for (uint i = 0; i < _poolCnt; i++) {
      _totalVoteWeight += _weights[i] > 0 ? _weights[i] : - _weights[i];
    }

    for (uint i = 0; i < _poolCnt; i++) {
      address _pool = _poolVote[i];
      address _gauge = gauges[_pool];

      int256 _poolWeight = _weights[i] * _weight / _totalVoteWeight;
      require(votes[_tokenId][_pool] == 0, "duplicate pool");
      require(_poolWeight != 0, "zero power");
      _updateFor(_gauge);

      poolVote[_tokenId].push(_pool);

      weights[_pool] += _poolWeight;
      votes[_tokenId][_pool] += _poolWeight;
      if (_poolWeight > 0) {
        IBribe(bribes[_gauge])._deposit(uint(_poolWeight), _tokenId);
      } else {
        _poolWeight = - _poolWeight;
      }
      _usedWeight += _poolWeight;
      _totalWeight += _poolWeight;
      emit Voted(msg.sender, _tokenId, _poolWeight);
    }
    if (_usedWeight > 0) IVe(ve).voting(_tokenId);
    totalWeight += uint(_totalWeight);
    usedWeights[_tokenId] = uint(_usedWeight);
  }

  /// @dev Vote for given pools using a vote power of given tokenId. Reset previous votes.
  function vote(uint tokenId, address[] calldata _poolVote, int256[] calldata _weights) external {
    require(IVe(ve).isApprovedOrOwner(msg.sender, tokenId), "!owner");
    require(_poolVote.length == _weights.length, "!arrays");
    _vote(tokenId, _poolVote, _weights);
  }

  /// @dev Add token to whitelist. Only pools with whitelisted tokens can be added to gauge.
  function whitelist(address _token, uint _tokenId) external {
    require(_tokenId > 0, "!token");
    require(msg.sender == IERC721(ve).ownerOf(_tokenId), "!owner");
    require(IVe(ve).balanceOfNFT(_tokenId) > _listingFee(), "!power");
    _whitelist(_token);
  }

  function _whitelist(address _token) internal {
    require(!isWhitelisted[_token], "already whitelisted");
    isWhitelisted[_token] = true;
    emit Whitelisted(msg.sender, _token);
  }

  /// @dev Add a token to a gauge/bribe as possible reward.
  function registerRewardToken(address _token, address _gaugeOrBribe, uint _tokenId) external {
    require(_tokenId > 0, "!token");
    require(msg.sender == IERC721(ve).ownerOf(_tokenId), "!owner");
    require(IVe(ve).balanceOfNFT(_tokenId) > _listingFee(), "!power");
    IMultiRewardsPool(_gaugeOrBribe).registerRewardToken(_token);
  }

  /// @dev Remove a token from a gauge/bribe allowed rewards list.
  function removeRewardToken(address _token, address _gaugeOrBribe, uint _tokenId) external {
    require(_tokenId > 0, "!token");
    require(msg.sender == IERC721(ve).ownerOf(_tokenId), "!owner");
    require(IVe(ve).balanceOfNFT(_tokenId) > _listingFee(), "!power");
    IMultiRewardsPool(_gaugeOrBribe).removeRewardToken(_token);
  }

  /// @dev Create gauge for given pool. Only for a pool with whitelisted tokens.
  function createGauge(address _pool) external returns (address) {
    require(gauges[_pool] == address(0x0), "exists");
    require(IFactory(factory).isPair(_pool), "!pool");
    (address tokenA, address tokenB) = IPair(_pool).tokens();
    require(isWhitelisted[tokenA] && isWhitelisted[tokenB], "!whitelisted");

    address[] memory allowedRewards = new address[](3);
    allowedRewards[0] = tokenA;
    allowedRewards[1] = tokenB;
    if (token != tokenA && token != tokenB) {
      allowedRewards[2] = token;
    }

    address _bribe = IBribeFactory(bribeFactory).createBribe(allowedRewards);
    address _gauge = IGaugeFactory(gaugeFactory).createGauge(_pool, _bribe, ve, allowedRewards);
    IERC20(token).safeIncreaseAllowance(_gauge, type(uint).max);
    bribes[_gauge] = _bribe;
    gauges[_pool] = _gauge;
    poolForGauge[_gauge] = _pool;
    isGauge[_gauge] = true;
    _updateFor(_gauge);
    pools.push(_pool);
    emit GaugeCreated(_gauge, msg.sender, _bribe, _pool);
    return _gauge;
  }

  /// @dev A gauge should be able to attach a token for preventing transfers/withdraws.
  function attachTokenToGauge(uint tokenId, address account) external override {
    require(isGauge[msg.sender], "!gauge");
    if (tokenId > 0) {
      IVe(ve).attachToken(tokenId);
    }
    emit Attach(account, msg.sender, tokenId);
  }

  /// @dev Emit deposit event for easily handling external actions.
  function emitDeposit(uint tokenId, address account, uint amount) external override {
    require(isGauge[msg.sender], "!gauge");
    emit Deposit(account, msg.sender, tokenId, amount);
  }

  /// @dev Detach given token.
  function detachTokenFromGauge(uint tokenId, address account) external override {
    require(isGauge[msg.sender], "!gauge");
    if (tokenId > 0) {
      IVe(ve).detachToken(tokenId);
    }
    emit Detach(account, msg.sender, tokenId);
  }

  /// @dev Emit withdraw event for easily handling external actions.
  function emitWithdraw(uint tokenId, address account, uint amount) external override {
    require(isGauge[msg.sender], "!gauge");
    emit Withdraw(account, msg.sender, tokenId, amount);
  }

  /// @dev Length of pools
  function poolsLength() external view returns (uint) {
    return pools.length;
  }

  /// @dev Add rewards to this contract. Usually it is DystMinter.
  function notifyRewardAmount(uint amount) external override {
    require(amount != 0, "zero amount");
    uint _totalWeight = totalWeight;
    // without votes rewards can not be added
    require(_totalWeight != 0, "!weights");
    // transfer the distro in
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    // 1e18 adjustment is removed during claim
    uint _ratio = amount * 1e18 / _totalWeight;
    if (_ratio > 0) {
      index += _ratio;
    }
    emit NotifyReward(msg.sender, token, amount);
  }

  /// @dev Update given gauges.
  function updateFor(address[] memory _gauges) external {
    for (uint i = 0; i < _gauges.length; i++) {
      _updateFor(_gauges[i]);
    }
  }

  /// @dev Update gauges by indexes in a range.
  function updateForRange(uint start, uint end) public {
    for (uint i = start; i < end; i++) {
      _updateFor(gauges[pools[i]]);
    }
  }

  /// @dev Update all gauges.
  function updateAll() external {
    updateForRange(0, pools.length);
  }

  /// @dev Update reward info for given gauge.
  function updateGauge(address _gauge) external {
    _updateFor(_gauge);
  }

  function _updateFor(address _gauge) internal {
    address _pool = poolForGauge[_gauge];
    int256 _supplied = weights[_pool];
    if (_supplied > 0) {
      uint _supplyIndex = supplyIndex[_gauge];
      // get global index for accumulated distro
      uint _index = index;
      // update _gauge current position to global position
      supplyIndex[_gauge] = _index;
      // see if there is any difference that need to be accrued
      uint _delta = _index - _supplyIndex;
      if (_delta > 0) {
        // add accrued difference for each supplied token
        uint _share = uint(_supplied) * _delta / 1e18;
        claimable[_gauge] += _share;
      }
    } else {
      // new users are set to the default global state
      supplyIndex[_gauge] = index;
    }
  }

  /// @dev Batch claim rewards from given gauges.
  function claimRewards(address[] memory _gauges, address[][] memory _tokens) external {
    for (uint i = 0; i < _gauges.length; i++) {
      IGauge(_gauges[i]).getReward(msg.sender, _tokens[i]);
    }
  }

  /// @dev Batch claim rewards from given bribe contracts for given tokenId.
  function claimBribes(address[] memory _bribes, address[][] memory _tokens, uint _tokenId) external {
    require(IVe(ve).isApprovedOrOwner(msg.sender, _tokenId), "!owner");
    for (uint i = 0; i < _bribes.length; i++) {
      IBribe(_bribes[i]).getRewardForOwner(_tokenId, _tokens[i]);
    }
  }

  /// @dev Claim fees from given bribes.
  function claimFees(address[] memory _bribes, address[][] memory _tokens, uint _tokenId) external {
    require(IVe(ve).isApprovedOrOwner(msg.sender, _tokenId), "!owner");
    for (uint i = 0; i < _bribes.length; i++) {
      IBribe(_bribes[i]).getRewardForOwner(_tokenId, _tokens[i]);
    }
  }

  /// @dev Move fees from deposited pools to bribes for given gauges.
  function distributeFees(address[] memory _gauges) external {
    for (uint i = 0; i < _gauges.length; i++) {
      IGauge(_gauges[i]).claimFees();
    }
  }

  /// @dev Get emission from minter and notify rewards for given gauge.
  function distribute(address _gauge) external override {
    _distribute(_gauge);
  }

  function _distribute(address _gauge) internal lock {
    IMinter(minter).updatePeriod();
    _updateFor(_gauge);
    uint _claimable = claimable[_gauge];
    if (_claimable > IMultiRewardsPool(_gauge).left(token) && _claimable / DURATION > 0) {
      claimable[_gauge] = 0;
      IGauge(_gauge).notifyRewardAmount(token, _claimable);
      emit DistributeReward(msg.sender, _gauge, _claimable);
    }
  }

  /// @dev Distribute rewards for all pools.
  function distributeAll() external {
    uint length = pools.length;
    for (uint x; x < length; x++) {
      _distribute(gauges[pools[x]]);
    }
  }

  function distributeForPoolsInRange(uint start, uint finish) external {
    for (uint x = start; x < finish; x++) {
      _distribute(gauges[pools[x]]);
    }
  }

  function distributeForGauges(address[] memory _gauges) external {
    for (uint x = 0; x < _gauges.length; x++) {
      _distribute(_gauges[x]);
    }
  }
}
