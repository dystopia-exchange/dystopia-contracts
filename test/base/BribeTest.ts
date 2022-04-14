import {
  BaseV1Pair,
  BaseV1Pair__factory,
  Bribe,
  Bribe__factory,
  Gauge,
  Gauge__factory,
  StakingRewards,
  Token
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {CoreAddresses} from "../../scripts/deploy/CoreAddresses";
import {Deploy} from "../../scripts/deploy/Deploy";
import {MaticTestnetAddresses} from "../../scripts/addresses/MaticTestnetAddresses";
import {BigNumber, utils} from "ethers";
import {TestHelper} from "../TestHelper";
import {TimeUtils} from "../TimeUtils";
import {parseUnits} from "ethers/lib/utils";

const {expect} = chai;

const amount1000At6 = parseUnits('1000', 6);
const WEEK = 60 * 60 * 24 * 7;

describe("bribe tests", function () {

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
  let mimUstPair: BaseV1Pair;
  let mimDaiPair: BaseV1Pair;
  let ustDaiPair: BaseV1Pair;

  let gaugeMimUst: Gauge;
  let gaugeMimDai: Gauge;

  let bribeMimUst: Bribe;
  let bribeMimDai: Bribe;

  let staking: StakingRewards;

  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2, owner3] = await ethers.getSigners();

    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;

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
      [owner.address, owner2.address],
      [utils.parseUnits('100'), utils.parseUnits('100')],
      utils.parseUnits('200')
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
    ustDaiPair = await TestHelper.addLiquidity(
      core.factory,
      core.router,
      owner,
      ust.address,
      dai.address,
      utils.parseUnits('1', 6),
      utils.parseUnits('1'),
      true
    );

    // ------------- setup gauges and bribes --------------

    await core.token.approve(core.voter.address, BigNumber.from("1500000000000000000000000"));
    await core.voter.createGauge(mimUstPair.address);
    await core.voter.createGauge(mimDaiPair.address);
    expect(await core.voter.gauges(mimUstPair.address)).to.not.equal(0x0000000000000000000000000000000000000000);

    const sr = await ethers.getContractFactory("StakingRewards");
    staking = await sr.deploy(mimUstPair.address, core.token.address);

    const gaugeMimUstAddress = await core.voter.gauges(mimUstPair.address);
    const bribeMimUstAddress = await core.voter.bribes(gaugeMimUstAddress);

    const gaugeMimDaiAddress2 = await core.voter.gauges(mimDaiPair.address);
    const bribeMimDaiAddress2 = await core.voter.bribes(gaugeMimDaiAddress2);

    gaugeMimUst = Gauge__factory.connect(gaugeMimUstAddress, owner);
    gaugeMimDai = Gauge__factory.connect(gaugeMimDaiAddress2, owner);

    bribeMimUst = Bribe__factory.connect(bribeMimUstAddress, owner);
    bribeMimDai = Bribe__factory.connect(bribeMimDaiAddress2, owner);

    await TestHelper.depositToGauge(owner, gaugeMimUst, mimUstPair, amount1000At6, 1);
    await TestHelper.depositToGauge(owner, gaugeMimDai, mimDaiPair, amount1000At6, 1);

    await mimUstPair.approve(staking.address, amount1000At6);
    await staking.stake(amount1000At6);

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

  it("whitelist new token", async function () {
    const mockToken = await Deploy.deployContract(owner, 'Token', 'MOCK', 'MOCK', 10, owner.address) as Token;
    await mockToken.mint(owner.address, utils.parseUnits('1000000000000', 10));
    await core.voter.whitelist(mockToken.address, 1);
    expect(await core.voter.isWhitelisted(mockToken.address)).is.eq(true);
  });

  it("getPriorBalanceIndex for unknown token return 0", async function () {
    expect(await bribeMimDai.getPriorBalanceIndex(99, 0)).is.eq(0);
  });

  it("getPriorBalanceIndex test", async function () {
    await core.voter.vote(1, [mimUstPair.address], [100])
    await TimeUtils.advanceBlocksOnTs(1);
    await core.voter.reset(1);
    await TimeUtils.advanceBlocksOnTs(1);
    await core.voter.vote(1, [mimUstPair.address], [100]);

    const checkPointN = await bribeMimUst.numCheckpoints(1);
    expect(checkPointN).is.not.eq(0);
    const checkPoint = await bribeMimUst.checkpoints(1, checkPointN.sub(2));
    console.log("checkpoint timestamp", checkPoint.timestamp.toString())
    console.log("checkpoint bal", checkPoint.balanceOf.toString())
    expect(await bribeMimUst.getPriorBalanceIndex(1, checkPoint.timestamp)).is.eq(1);
    expect(await bribeMimUst.getPriorBalanceIndex(1, checkPoint.timestamp.add(1))).is.eq(1);
    expect(await bribeMimUst.getPriorBalanceIndex(1, checkPoint.timestamp.sub(1))).is.eq(0);
  });

  it("getPriorSupplyIndex for empty bribe", async function () {
    await core.voter.createGauge(ustDaiPair.address);
    const gauge = await core.voter.gauges(ustDaiPair.address);
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

    await bribeMimUst.batchRewardPerToken(mim.address, 3);

    await core.voter.vote(1, [mimUstPair.address], [100]);
    await mim.approve(bribeMimUst.address, parseUnits('100'));
    await bribeMimUst.notifyRewardAmount(mim.address, parseUnits('1'))
    await TimeUtils.advanceBlocksOnTs(1);

    await core.voter.reset(1);

    await bribeMimUst.batchRewardPerToken(mim.address, 3);
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

    await bribeMimUst.batchRewardPerToken(mim.address, 3);
    await bribeMimUst.batchRewardPerToken(mim.address, 3);

    const n = await bribeMimUst.rewardPerTokenNumCheckpoints(mim.address);
    expect(n).is.not.eq(0);
    const checkpoint = await bribeMimUst.rewardPerTokenCheckpoints(mim.address, n.sub(1));
    const c = await bribeMimUst.getPriorRewardPerToken(mim.address, checkpoint.timestamp);
    expect(c[1]).is.not.eq(0);
    expect(c[1]).is.not.eq(0);
    expect(await bribeMimUst.rewardsListLength()).is.eq(1);
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
    await core.voter.createGauge(ustDaiPair.address);
    const gauge = await core.voter.gauges(ustDaiPair.address);
    const bribe = await core.voter.bribes(gauge);

    expect(await Bribe__factory.connect(bribe, owner).rewardPerToken(mim.address)).is.eq(0);
  });

  it("third party stake to LP test", async function () {
    await core.voter.vote(1, [mimUstPair.address], [100]);
    expect(await core.token.balanceOf(owner3.address)).is.eq(0);

    await depositToGauge(core, owner, mim.address, ust.address, gaugeMimUst, 1);
    await depositToGauge(core, owner3, mim.address, ust.address, gaugeMimUst, 0);

    await TimeUtils.advanceBlocksOnTs(WEEK * 2);
    await core.minter.update_period()
    await core.voter.distro();

    await TimeUtils.advanceBlocksOnTs(WEEK / 2);

    // should not reset rewards after deposit and withdraw
    await depositToGauge(core, owner3, mim.address, ust.address, gaugeMimUst, 0);

    // await gaugeMimUst.connect(owner).getReward(owner.address, [core.token.address]);
    await gaugeMimUst.connect(owner3).getReward(owner3.address, [core.token.address]);

    TestHelper.closer(await core.token.balanceOf(owner.address), parseUnits('380000'), parseUnits('10000'))
    TestHelper.closer(await core.token.balanceOf(owner3.address), parseUnits('110000'), parseUnits('10000'))
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
  const pair = BaseV1Pair__factory.connect(pairAdr, owner);
  const pairBalance = await pair.balanceOf(owner.address);
  expect(pairBalance).is.not.eq(0);
  await pair.approve(gauge.address, pairBalance);
  await gauge.connect(owner).deposit(pairBalance, tokenId);
}
