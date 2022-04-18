import {
  DystPair,
  DystPair__factory,
  Bribe,
  Bribe__factory,
  Gauge,
  Gauge__factory,
  Token
} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {CoreAddresses} from "../../../scripts/deploy/CoreAddresses";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {BigNumber, utils} from "ethers";
import {TestHelper} from "../../TestHelper";
import {TimeUtils} from "../../TimeUtils";
import {formatUnits, parseUnits} from "ethers/lib/utils";
import {Misc} from "../../../scripts/Misc";

const {expect} = chai;

const amount1000At6 = parseUnits('1000', 6);
const WEEK = 60 * 60 * 24 * 7;

describe("gauge and bribe tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let core: CoreAddresses;
  let ust: Token;
  let mim: Token;
  let dai: Token;
  let wmatic: Token;
  let mimUstPair: DystPair;
  let mimDaiPair: DystPair;
  // let ustDaiPair: DystPair;

  let gaugeMimUst: Gauge;
  // let gaugeMimDai: Gauge;

  let bribeMimUst: Bribe;
  // let bribeMimDai: Bribe;

  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2, owner3] = await ethers.getSigners();

    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    await wmatic.mint(owner.address, parseUnits('100000'));

    [ust, mim, dai] = await TestHelper.createMockTokensAndMint(owner);
    await ust.transfer(owner2.address, utils.parseUnits('100', 6));
    await mim.transfer(owner2.address, utils.parseUnits('100'));
    await dai.transfer(owner2.address, utils.parseUnits('100'));

    await ust.transfer(owner3.address, utils.parseUnits('100', 6));
    await mim.transfer(owner3.address, utils.parseUnits('100'));
    await dai.transfer(owner3.address, utils.parseUnits('100'));

    core = await Deploy.deployCore(
      owner,
      wmatic.address,
      [wmatic.address, ust.address, mim.address, dai.address],
      [owner.address, owner2.address, owner.address],
      [utils.parseUnits('100'), utils.parseUnits('100'), BigNumber.from(100)],
      utils.parseUnits('200').add(100)
    );

    mimUstPair = await TestHelper.addLiquidity(
      core.factory,
      core.router,
      owner,
      mim.address,
      ust.address,
      utils.parseUnits('1'),
      utils.parseUnits('1', 6),
      true
    );
    mimDaiPair = await TestHelper.addLiquidity(
      core.factory,
      core.router,
      owner,
      mim.address,
      dai.address,
      utils.parseUnits('1'),
      utils.parseUnits('1'),
      true
    );

    // ------------- setup gauges and bribes --------------

    await core.token.approve(core.voter.address, BigNumber.from("1500000000000000000000000"));
    await core.voter.createGauge(mimUstPair.address);
    expect(await core.voter.gauges(mimUstPair.address)).to.not.equal(0x0000000000000000000000000000000000000000);

    const gaugeMimUstAddress = await core.voter.gauges(mimUstPair.address);
    const bribeMimUstAddress = await core.voter.bribes(gaugeMimUstAddress);

    gaugeMimUst = Gauge__factory.connect(gaugeMimUstAddress, owner);

    bribeMimUst = Bribe__factory.connect(bribeMimUstAddress, owner);

    await TestHelper.depositToGauge(owner, gaugeMimUst, mimUstPair, amount1000At6, 1);

    expect(await gaugeMimUst.totalSupply()).to.equal(amount1000At6);
    expect(await gaugeMimUst.earned(core.ve.address, owner.address)).to.equal(0);
  });

  after(async function () {
    await TimeUtils.rollback(snapshotBefore);
  });


  beforeEach(async function () {
    snapshot = await TimeUtils.snapshot();
  });

  afterEach(async function () {
    await TimeUtils.rollback(snapshot);
  });

  it("getPriorBalanceIndex for unknown token return 0", async function () {
    expect(await bribeMimUst.getPriorBalanceIndex(Misc.ZERO_ADDRESS, 0)).is.eq(0);
  });

  it("getPriorBalanceIndex test", async function () {
    await core.voter.vote(1, [mimUstPair.address], [100])
    await TimeUtils.advanceBlocksOnTs(1);
    await core.voter.reset(1);
    await TimeUtils.advanceBlocksOnTs(1);
    await core.voter.vote(1, [mimUstPair.address], [100]);

    const adr1 = await bribeMimUst.tokenIdToAddress(1);

    const checkPointN = await bribeMimUst.numCheckpoints(adr1);
    expect(checkPointN).is.not.eq(0);
    const checkPoint = await bribeMimUst.checkpoints(adr1, checkPointN.sub(2));
    console.log("checkpoint timestamp", checkPoint.timestamp.toString())
    console.log("checkpoint bal", checkPoint.value.toString())
    expect(await bribeMimUst.getPriorBalanceIndex(adr1, checkPoint.timestamp)).is.eq(1);
    expect(await bribeMimUst.getPriorBalanceIndex(adr1, checkPoint.timestamp.add(1))).is.eq(1);
    expect(await bribeMimUst.getPriorBalanceIndex(adr1, checkPoint.timestamp.sub(1))).is.eq(0);
  });

  it("getPriorSupplyIndex for empty bribe", async function () {
    await core.voter.createGauge(mimDaiPair.address);
    const gauge = await core.voter.gauges(mimDaiPair.address);
    const bribe = await core.voter.bribes(gauge);

    expect(await Bribe__factory.connect(bribe, owner).getPriorSupplyIndex(0)).is.eq(0);
  });

  it("getPriorSupplyIndex test", async function () {
    await core.voter.vote(1, [mimUstPair.address], [100])
    await TimeUtils.advanceBlocksOnTs(1);
    await core.voter.reset(1);
    await TimeUtils.advanceBlocksOnTs(1);
    await core.voter.vote(1, [mimUstPair.address], [100]);

    const n = await bribeMimUst.supplyNumCheckpoints();
    expect(n).is.not.eq(0);
    const checkpoint = await bribeMimUst.supplyCheckpoints(n.sub(2));
    expect(await bribeMimUst.getPriorSupplyIndex(checkpoint.timestamp)).is.eq(1);
    expect(await bribeMimUst.getPriorSupplyIndex(checkpoint.timestamp.add(1))).is.eq(1);
    expect(await bribeMimUst.getPriorSupplyIndex(checkpoint.timestamp.sub(1))).is.eq(0);
  });


  it("custom reward test", async function () {
    await bribeMimUst.batchUpdateRewardPerToken(mim.address, 3);

    await core.voter.vote(1, [mimUstPair.address], [100]);
    await mim.approve(bribeMimUst.address, parseUnits('100'));
    await bribeMimUst.notifyRewardAmount(mim.address, parseUnits('1'))
    await TimeUtils.advanceBlocksOnTs(1);

    await core.voter.reset(1);

    await bribeMimUst.batchUpdateRewardPerToken(mim.address, 3);
    await bribeMimUst.notifyRewardAmount(mim.address, parseUnits('1'))
    await TimeUtils.advanceBlocksOnTs(1);

    await core.voter.vote(1, [mimUstPair.address], [100]);

    await bribeMimUst.notifyRewardAmount(mim.address, parseUnits('10'))
    await TimeUtils.advanceBlocksOnTs(1);

    await core.voter.reset(1);
    await TimeUtils.advanceBlocksOnTs(1);
    await core.voter.vote(1, [mimUstPair.address], [100]);

    expect(bribeMimUst.supplyNumCheckpoints()).is.not.eq(0);
    expect(bribeMimUst.rewardRate(mim.address)).is.not.eq(0);

    await bribeMimUst.batchUpdateRewardPerToken(mim.address, 3);
    await bribeMimUst.batchUpdateRewardPerToken(mim.address, 3);

    const n = await bribeMimUst.rewardPerTokenNumCheckpoints(mim.address);
    expect(n).is.not.eq(0);
    const checkpoint = await bribeMimUst.rewardPerTokenCheckpoints(mim.address, n.sub(1));
    const c = await bribeMimUst.getPriorRewardPerToken(mim.address, checkpoint.timestamp);
    expect(c[1]).is.not.eq(0);
    expect(c[1]).is.not.eq(0);
    expect(await bribeMimUst.rewardTokensLength()).is.eq(1);
    expect(await bribeMimUst.left(mim.address)).is.not.eq(0);
  });


  it("getRewardForOwner through voter", async function () {
    await core.voter.vote(1, [mimUstPair.address], [100]);
    await mim.approve(bribeMimUst.address, parseUnits('100'));
    await bribeMimUst.notifyRewardAmount(mim.address, parseUnits('10'))

    const balanceBefore = await mim.balanceOf(owner.address);
    await core.voter.claimBribes([bribeMimUst.address], [[mim.address]], 1);
    expect((await mim.balanceOf(owner.address)).sub(balanceBefore)).is.not.eq(0);
  });

  it("reward per token for empty bribe", async function () {
    await core.voter.createGauge(mimDaiPair.address);
    const gauge = await core.voter.gauges(mimDaiPair.address);
    const bribe = await core.voter.bribes(gauge);

    expect(await Bribe__factory.connect(bribe, owner).rewardPerToken(mim.address)).is.eq(0);
  });

  it("double deposit should not reset rewards", async function () {
    await core.voter.vote(1, [mimUstPair.address], [100]);

    await depositToGauge(core, owner2, mim.address, ust.address, gaugeMimUst, 2);
    await depositToGauge(core, owner3, mim.address, ust.address, gaugeMimUst, 0);

    await TimeUtils.advanceBlocksOnTs(WEEK * 2);
    await core.minter.updatePeriod()
    await core.voter.distributeAll();

    await TimeUtils.advanceBlocksOnTs(WEEK / 2);

    // should not reset rewards after deposit and withdraw
    await gaugeMimUst.connect(owner3).withdrawAll()
    await depositToGauge(core, owner2, mim.address, ust.address, gaugeMimUst, 2);

    await gaugeMimUst.connect(owner2).getReward(owner2.address, [core.token.address]);
    await gaugeMimUst.connect(owner3).getReward(owner3.address, [core.token.address]);

    expect(await core.token.balanceOf(owner2.address)).is.above(parseUnits('150000'))
    expect(await core.token.balanceOf(owner3.address)).is.above(parseUnits('150000'))
  });

  it("ve boost test", async function () {
    await core.voter.vote(1, [mimUstPair.address], [100]);
    const veBal = await core.ve.balanceOfNFT(2)
    expect(veBal).is.not.eq(0);
    expect(await core.ve.balanceOf(owner3.address)).is.eq(0);

    await depositToGauge(core, owner2, mim.address, ust.address, gaugeMimUst, 2);
    await depositToGauge(core, owner3, mim.address, ust.address, gaugeMimUst, 0);

    await TimeUtils.advanceBlocksOnTs(WEEK * 2);
    await core.minter.updatePeriod()
    await core.voter.distributeAll();

    await TimeUtils.advanceBlocksOnTs(WEEK);

    await gaugeMimUst.connect(owner2).getReward(owner2.address, [core.token.address]);
    await gaugeMimUst.connect(owner3).getReward(owner3.address, [core.token.address]);

    const balanceWithFullBoost = await core.token.balanceOf(owner2.address);
    const balanceWithoutBoost = await core.token.balanceOf(owner3.address);
    const rewardsSum = balanceWithFullBoost.add(balanceWithoutBoost);
    console.log('veBal 2', formatUnits(veBal))
    console.log('ve total supply', formatUnits(await core.ve.totalSupply()))
    console.log('balanceWithFullBoost', formatUnits(balanceWithFullBoost))
    console.log('balanceWithoutBoost', formatUnits(balanceWithoutBoost))
    console.log('rewardsSum', formatUnits(rewardsSum))
    const withoutBoostRatio = balanceWithoutBoost.mul(100).div(rewardsSum).toNumber();
    const withBoostRatio = balanceWithFullBoost.mul(100).div(rewardsSum).toNumber();
    expect(withoutBoostRatio).is.below(40);
    expect(withBoostRatio).is.above(40);
  });

  it("claim fees", async function () {
    const EXPECTED_FEE = '0.25';
    await mim.approve(core.router.address, parseUnits('10000'));
    await core.router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('10000'),
      0,
      0,
      owner.address,
      BigNumber.from('999999999999999999'),
      {value: parseUnits('10000')}
    );
    const pairAdr = await core.factory.getPair(mim.address, wmatic.address, true);
    const pair = DystPair__factory.connect(pairAdr, owner);

    await core.voter.createGauge(pairAdr);

    const gaugeAdr = await core.voter.gauges(pairAdr);
    const gauge = await Gauge__factory.connect(gaugeAdr, owner);

    const bribeAdr = await core.voter.bribes(gaugeAdr);
    const bribe = await Bribe__factory.connect(bribeAdr, owner);

    await TestHelper.depositToGauge(owner, gauge, pair, await pair.balanceOf(owner.address), 1);
    const fees = await pair.fees();

    expect(await mim.balanceOf(bribeAdr)).is.eq(0);
    expect(await wmatic.balanceOf(bribeAdr)).is.eq(0);
    expect(await mim.balanceOf(fees)).is.eq(0);
    expect(await wmatic.balanceOf(fees)).is.eq(0);

    await mim.approve(core.router.address, parseUnits('99999'));
    await core.router.swapExactTokensForTokens(
      parseUnits('1000'),
      0,
      [{from: mim.address, to: wmatic.address, stable: true}],
      owner.address,
      BigNumber.from('999999999999999999'),
    );
    await wmatic.approve(core.router.address, parseUnits('99999', 6));
    await core.router.swapExactTokensForTokens(
      parseUnits('1000', 6),
      0,
      [{to: mim.address, from: wmatic.address, stable: true}],
      owner.address,
      BigNumber.from('999999999999999999'),
    );

    expect(await mim.balanceOf(fees)).is.eq(parseUnits(EXPECTED_FEE));
    expect(await wmatic.balanceOf(fees)).is.eq(parseUnits(EXPECTED_FEE, 6));

    await gauge.claimFees();

    expect(await mim.balanceOf(fees)).is.below(2);
    expect(await wmatic.balanceOf(fees)).is.below(2);

    expect(await gauge.fees0()).is.eq(0);
    expect(await gauge.fees1()).is.eq(0);

    expect(await mim.balanceOf(bribe.address)).is.above(parseUnits(EXPECTED_FEE).sub(2));
    expect(await wmatic.balanceOf(bribe.address)).is.above(parseUnits(EXPECTED_FEE, 6).sub(2));

    expect(await bribe.left(mim.address)).is.above(100);
    expect(await bribe.left(wmatic.address)).is.above(100);

    const EXPECTED_FEE2 = 3;
    const SWAP_AMOUNT = 10000;

    await core.router.swapExactTokensForTokens(
      SWAP_AMOUNT,
      0,
      [{from: mim.address, to: wmatic.address, stable: true}],
      owner.address,
      BigNumber.from('999999999999999999'),
    );
    await core.router.swapExactTokensForTokens(
      SWAP_AMOUNT,
      0,
      [{to: mim.address, from: wmatic.address, stable: true}],
      owner.address,
      BigNumber.from('999999999999999999'),
    );

    expect(await mim.balanceOf(fees)).is.eq(EXPECTED_FEE2 + 1);
    expect(await wmatic.balanceOf(fees)).is.eq(EXPECTED_FEE2 + 1);

    await gauge.claimFees();

    expect(await mim.balanceOf(fees)).is.below(3);
    expect(await wmatic.balanceOf(fees)).is.below(3);

    expect(await gauge.fees0()).is.eq(EXPECTED_FEE2 - 1);
    expect(await gauge.fees1()).is.eq(EXPECTED_FEE2 - 1);
  });

  it("gauge getReward for not owner or voter should be forbidden", async function () {
    await expect(gaugeMimUst.getReward(owner2.address, [])).revertedWith('Forbidden');
  });

  it("bribe getReward for not owner should reject", async function () {
    await expect(bribeMimUst.getReward(0, [Misc.ZERO_ADDRESS])).revertedWith('Not token owner');
  });

  it("bribe getRewardForOwner for not voter should reject", async function () {
    await expect(bribeMimUst.getRewardForOwner(0, [Misc.ZERO_ADDRESS])).revertedWith('Not voter');
  });

  it("bribe deposit for not voter should reject", async function () {
    await expect(bribeMimUst._deposit(0, 0)).revertedWith('Not voter');
  });

  it("bribe withdraw for not voter should reject", async function () {
    await expect(bribeMimUst._withdraw(0, 0)).revertedWith('Not voter');
  });

  it("bribe deposit with zero amount should reject", async function () {
    const voter = await Misc.impersonate(core.voter.address)
    await expect(bribeMimUst.connect(voter)._deposit(0, 0)).revertedWith('Zero amount');
  });

  it("bribe withdraw with zero amount should reject", async function () {
    const voter = await Misc.impersonate(core.voter.address)
    await expect(bribeMimUst.connect(voter)._withdraw(0, 0)).revertedWith('Zero amount');
  });

  it("bribe tokenIdToAddress should be rejected with too high tokenId", async function () {
    await expect(bribeMimUst.tokenIdToAddress(Misc.MAX_UINT)).revertedWith('Wrong convert');
  });

  it("bribe tokenIdToAddress should be rejected with too high tokenId", async function () {
    expect(await bribeMimUst.addressToTokenId(await bribeMimUst.tokenIdToAddress(1))).is.eq(1);
  });

  it("deposit with another tokenId should be rejected", async function () {
    expect(await gaugeMimUst.tokenIds(owner.address)).is.eq(1);
    await TestHelper.addLiquidity(
      core.factory,
      core.router,
      owner,
      mim.address,
      ust.address,
      utils.parseUnits('1'),
      utils.parseUnits('1', 6),
      true
    );
    const pairAdr = await core.factory.getPair(mim.address, ust.address, true)
    const pair = DystPair__factory.connect(pairAdr, owner);
    const pairBalance = await pair.balanceOf(owner.address);
    expect(pairBalance).is.not.eq(0);
    await pair.approve(gaugeMimUst.address, pairBalance);
    await expect(gaugeMimUst.deposit(pairBalance, 3)).revertedWith('Wrong token');
  });

});


async function depositToGauge(
  core: CoreAddresses,
  owner: SignerWithAddress,
  token0: string,
  token1: string,
  gauge: Gauge,
  tokenId: number
) {
  await TestHelper.addLiquidity(
    core.factory,
    core.router,
    owner,
    token0,
    token1,
    utils.parseUnits('1'),
    utils.parseUnits('1', 6),
    true
  );
  const pairAdr = await core.factory.getPair(token0, token1, true)
  const pair = DystPair__factory.connect(pairAdr, owner);
  const pairBalance = await pair.balanceOf(owner.address);
  expect(pairBalance).is.not.eq(0);
  await pair.approve(gauge.address, pairBalance);
  await gauge.connect(owner).deposit(pairBalance, tokenId);
}
