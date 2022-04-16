import {
  BaseV1Pair,
  Bribe,
  Bribe__factory,
  Gauge,
  Gauge__factory,
  IERC20__factory,
  StakingRewards,
  Token
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {CoreAddresses} from "../../scripts/deploy/CoreAddresses";
import {Deploy} from "../../scripts/deploy/Deploy";
import {BigNumber, utils} from "ethers";
import {TestHelper} from "../TestHelper";
import {TimeUtils} from "../TimeUtils";

const {expect} = chai;

const pair1000 = BigNumber.from("1000000000");

describe("voter tests", function () {

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
  let gaugeUstDai: Gauge;

  let bribeMimUst: Bribe;
  let bribeMimDai: Bribe;
  let bribeUstDai: Bribe;

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
    await core.voter.createGauge(ustDaiPair.address);
    expect(await core.voter.gauges(mimUstPair.address)).to.not.equal(0x0000000000000000000000000000000000000000);

    staking = await Deploy.deployContract(owner, 'StakingRewards', mimUstPair.address, core.token.address) as StakingRewards;

    const gaugeMimUstAddress = await core.voter.gauges(mimUstPair.address);
    const bribeMimUstAddress = await core.voter.bribes(gaugeMimUstAddress);

    const gaugeMimDaiAddress2 = await core.voter.gauges(mimDaiPair.address);
    const bribeMimDaiAddress2 = await core.voter.bribes(gaugeMimDaiAddress2);

    const gaugeUstDaiAddress3 = await core.voter.gauges(ustDaiPair.address);
    const bribeUstDaiAddress3 = await core.voter.bribes(gaugeUstDaiAddress3);

    gaugeMimUst = Gauge__factory.connect(gaugeMimUstAddress, owner);
    gaugeMimDai = Gauge__factory.connect(gaugeMimDaiAddress2, owner);
    gaugeUstDai = Gauge__factory.connect(gaugeUstDaiAddress3, owner);

    bribeMimUst = Bribe__factory.connect(bribeMimUstAddress, owner);
    bribeMimDai = Bribe__factory.connect(bribeMimDaiAddress2, owner);
    bribeUstDai = Bribe__factory.connect(bribeUstDaiAddress3, owner);

    await TestHelper.depositToGauge(owner, gaugeMimUst, mimUstPair, pair1000, 0);
    await TestHelper.depositToGauge(owner, gaugeMimDai, mimDaiPair, pair1000, 0);
    await TestHelper.depositToGauge(owner, gaugeUstDai, ustDaiPair, pair1000, 0);

    await mimUstPair.approve(staking.address, pair1000);
    await staking.stake(pair1000);

    expect(await gaugeMimUst.totalSupply()).to.equal(pair1000);
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

  it("BaseV1Voter length", async function () {
    expect(await core.voter.length()).to.equal(3);
  });

  it("gauge rewardsListLength", async function () {
    expect(await gaugeMimDai.rewardTokensLength()).to.equal(0);
  });

  it("veNFT gauge manipulate", async function () {
    expect(await gaugeMimUst.tokenIds(owner.address)).to.equal(0);
    await mimUstPair.approve(gaugeMimUst.address, pair1000);
    await gaugeMimUst.deposit(pair1000, 1);
    expect(await gaugeMimUst.tokenIds(owner.address)).to.equal(1);
    await mimUstPair.approve(gaugeMimUst.address, pair1000);
    await expect(gaugeMimUst.deposit(pair1000, 2)).to.be.reverted;
    expect(await gaugeMimUst.tokenIds(owner.address)).to.equal(1);
    await expect(gaugeMimUst.withdrawToken(0, 2)).to.be.reverted;
    expect(await gaugeMimUst.tokenIds(owner.address)).to.equal(1);
    await gaugeMimUst.withdrawToken(0, 1);
    expect(await gaugeMimUst.tokenIds(owner.address)).to.equal(0);
  });

  it("deposit/withdraw and check", async function () {

    await TestHelper.addLiquidity(
      core.factory,
      core.router,
      owner2,
      mim.address,
      ust.address,
      BigNumber.from("1000000000000000000"),
      BigNumber.from("1000000"),
      true
    );

    await TestHelper.depositToGauge(owner2, gaugeMimUst, mimUstPair, pair1000, 0);

    await mimUstPair.connect(owner2).approve(staking.address, pair1000);
    await staking.connect(owner2).stake(pair1000);

    expect(await gaugeMimUst.totalSupply()).to.equal("2000000000");
    expect(await gaugeMimUst.earned(core.ve.address, owner2.address)).to.equal(0);


    await gaugeMimUst.withdraw(await gaugeMimUst.balanceOf(owner.address));
    await gaugeMimUst.connect(owner2).withdraw(await gaugeMimUst.balanceOf(owner2.address));

    await staking.withdraw(await staking._balances(owner.address));
    await staking.connect(owner2).withdraw(await staking._balances(owner2.address));

    await gaugeMimDai.withdraw(await gaugeMimDai.balanceOf(owner.address));
    await gaugeUstDai.withdraw(await gaugeUstDai.balanceOf(owner.address));
    expect(await gaugeMimUst.totalSupply()).to.equal(0);
    expect(await gaugeMimDai.totalSupply()).to.equal(0);
    expect(await gaugeUstDai.totalSupply()).to.equal(0);
  });

  it("add gauge & bribe rewards", async function () {
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 4);
    await core.ve.withdraw(1);

    TestHelper.gte(await IERC20__factory.connect(core.token.address, owner).balanceOf(owner.address), pair1000.mul(3));

    await core.token.approve(gaugeMimUst.address, pair1000);
    await core.token.approve(bribeMimUst.address, pair1000);
    await core.token.approve(staking.address, pair1000);

    await gaugeMimUst.notifyRewardAmount(core.token.address, pair1000);
    await bribeMimUst.notifyRewardAmount(core.token.address, pair1000);
    await staking.notifyRewardAmount(pair1000);

    expect((await gaugeMimUst.rewardRate(core.token.address)).div('1000000000000000000')).to.equal(BigNumber.from(1653));
    expect((await bribeMimUst.rewardRate(core.token.address)).div('1000000000000000000')).to.equal(BigNumber.from(1653));
    expect(await staking.rewardRate()).to.equal(BigNumber.from(1653));
    expect((await gaugeMimUst.rewardRate(core.token.address)).div('1000000000000000000')).to.be.equal(await staking.rewardRate());
  });

  it("exit & getReward gauge stake", async function () {
    await gaugeMimUst.withdraw(await gaugeMimUst.balanceOf(owner.address));

    const balance = await mimUstPair.balanceOf(owner.address);
    await TestHelper.depositToGauge(owner, gaugeMimUst, mimUstPair, balance, 1);


    await gaugeMimUst.withdraw(await gaugeMimUst.balanceOf(owner.address));

    expect(await gaugeMimUst.totalSupply()).to.equal(0);

    await TestHelper.depositToGauge(owner, gaugeMimUst, mimUstPair, pair1000, 1);
    await mimUstPair.approve(staking.address, pair1000);
    await staking.stake(pair1000);
  });

  it("vote hacking", async function () {
    const adr1 = await bribeMimUst.tokenIdToAddress(1);
    await core.voter.vote(1, [mimUstPair.address], [5000]);
    expect(await core.voter.usedWeights(1)).to.closeTo((await core.ve.balanceOfNFT(1)), 1000);
    expect(await bribeMimUst.balanceOf(adr1)).to.equal(await core.voter.votes(1, mimUstPair.address));
    await core.voter.reset(1);
    expect(await core.voter.usedWeights(1)).to.below(await core.ve.balanceOfNFT(1));
    expect(await core.voter.usedWeights(1)).to.equal(0);
    expect(await bribeMimUst.balanceOf(adr1)).to.equal(await core.voter.votes(1, mimUstPair.address));
    expect(await bribeMimUst.balanceOf(adr1)).to.equal(0);
  });


  it("gauge poke without votes", async function () {
    expect(await core.voter.usedWeights(1)).to.equal(0);
    expect(await core.voter.votes(1, mimUstPair.address)).to.equal(0);
    await core.voter.poke(1);
    expect(await core.voter.usedWeights(1)).to.equal(0);
    expect(await core.voter.votes(1, mimUstPair.address)).to.equal(0);
  });

  it("gauge poke with votes", async function () {
    await core.voter.connect(owner2).vote(2, [mimDaiPair.address], [7000000]);
    TestHelper.closer(await core.voter.usedWeights(2), await core.ve.balanceOfNFT(2), BigNumber.from(0))
    TestHelper.closer(await core.voter.votes(2, mimDaiPair.address), utils.parseUnits('100'), utils.parseUnits('5'))


    await core.voter.vote(1, [mimUstPair.address], [5000]);
    TestHelper.closer(await core.voter.usedWeights(1), await core.ve.balanceOfNFT(1), BigNumber.from(0))
    TestHelper.closer(await core.voter.votes(1, mimUstPair.address), utils.parseUnits('100'), utils.parseUnits('5'))

    await core.voter.poke(1);

    TestHelper.closer(await core.voter.usedWeights(1), await core.ve.balanceOfNFT(1), BigNumber.from(0))
    TestHelper.closer(await core.voter.votes(1, mimUstPair.address), utils.parseUnits('100'), utils.parseUnits('5'))
  });

  it("gauge vote & bribe balanceOf", async function () {
    const adr1 = await bribeMimUst.tokenIdToAddress(1);
    await core.voter.vote(1, [mimUstPair.address, mimDaiPair.address], [5000, 5000]);
    expect(await core.voter.totalWeight()).to.not.equal(0);
    expect(await bribeMimUst.balanceOf(adr1)).to.not.equal(0);
  });

  it("gauge poke hacking2", async function () {
    await core.voter.vote(1, [mimUstPair.address, mimDaiPair.address], [5000, 5000]);
    const weightBefore = (await core.voter.usedWeights(1));
    const votesBefore = (await core.voter.votes(1, mimUstPair.address));
    await core.voter.poke(1);
    expect(await core.voter.usedWeights(1)).to.be.below(weightBefore);
    expect(await core.voter.votes(1, mimUstPair.address)).to.be.below(votesBefore);
  });

  it("vote hacking break mint", async function () {
    await core.voter.vote(1, [mimUstPair.address], [5000]);
    const adr1 = await bribeMimUst.tokenIdToAddress(1);
    expect(await core.voter.usedWeights(1)).to.closeTo((await core.ve.balanceOfNFT(1)), 1000);
    expect(await bribeMimUst.balanceOf(adr1)).to.equal(await core.voter.votes(1, mimUstPair.address));
  });

  it("gauge poke hacking3", async function () {
    expect(await core.voter.usedWeights(1)).to.equal(await core.voter.votes(1, mimUstPair.address));
    await core.voter.poke(1);
    expect(await core.voter.usedWeights(1)).to.equal(await core.voter.votes(1, mimUstPair.address));
  });

  it("bribe claim rewards", async function () {
    await bribeMimUst.getReward(1, [core.token.address]);
    await TimeUtils.advanceBlocksOnTs(691200);
    await bribeMimUst.getReward(1, [core.token.address]);
  });

  it("distribute and claim fees", async function () {

    await TimeUtils.advanceBlocksOnTs(691200);
    await bribeMimUst.getReward(1, [mim.address, ust.address]);

    await core.voter.distributeFees([gaugeMimUst.address]);
  });

  it("distribute gauge", async function () {
    await core.voter["distribute(address[])"]([gaugeMimUst.address]);
  });

  it("whitelist new token", async function () {
    const mockToken = await Deploy.deployContract(owner, 'Token', 'MOCK', 'MOCK', 10, owner.address) as Token;
    await mockToken.mint(owner.address, utils.parseUnits('1000000000000', 10));
    await core.voter.whitelist(mockToken.address, 1);
    expect(await core.voter.isWhitelisted(mockToken.address)).is.eq(true);
  });

});
