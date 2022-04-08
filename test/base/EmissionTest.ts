import {
  BaseV1Pair,
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
import {TestHelper} from "../TestHelper";
import {TimeUtils} from "../TimeUtils";
import {Misc} from "../../scripts/Misc";
import {parseUnits} from "ethers/lib/utils";

const {expect} = chai;

const amount1000At6 = parseUnits('1000', 6);
const amount100At18 = parseUnits('100', 18);
const WEEK = 60 * 60 * 24 * 7;

describe("emission tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let core: CoreAddresses;
  let ust: Token;
  let mim: Token;
  let dai: Token;
  let mimUstPair: BaseV1Pair;
  let mimDaiPair: BaseV1Pair;
  let ustDaiPair: BaseV1Pair;

  let gaugeMimUst: Gauge;

  let bribeMimUst: Bribe;

  let staking: StakingRewards;

  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();

    [ust, mim, dai] = await TestHelper.createMockTokensAndMint(owner);

    core = await Deploy.deployCore(
      owner,
      MaticTestnetAddresses.WMATIC_TOKEN,
      [MaticTestnetAddresses.WMATIC_TOKEN, ust.address, mim.address, dai.address],
      [owner.address, owner2.address],
      [amount100At18, amount100At18],
      amount100At18.mul(2)
    );

    // -------------- create pairs ---------------------

    mimUstPair = await TestHelper.addLiquidity(
      core,
      owner,
      mim.address,
      ust.address,
      parseUnits('1'),
      parseUnits('1', 6),
      true
    );
    mimDaiPair = await TestHelper.addLiquidity(
      core,
      owner,
      mim.address,
      dai.address,
      parseUnits('1'),
      parseUnits('1'),
      true
    );
    ustDaiPair = await TestHelper.addLiquidity(
      core,
      owner,
      ust.address,
      dai.address,
      parseUnits('1', 6),
      parseUnits('1'),
      true
    );

    // ------------- setup gauges and bribes --------------

    await core.voter.createGauge(mimUstPair.address);
    expect(await core.voter.gauges(mimUstPair.address)).to.not.equal(Misc.ZERO_ADDRESS);

    const sr = await ethers.getContractFactory("StakingRewards");
    staking = await sr.deploy(mimUstPair.address, core.token.address);

    const gaugeMimUstAddress = await core.voter.gauges(mimUstPair.address);
    const bribeMimUstAddress = await core.voter.bribes(gaugeMimUstAddress);

    gaugeMimUst = Gauge__factory.connect(gaugeMimUstAddress, owner);

    bribeMimUst = Bribe__factory.connect(bribeMimUstAddress, owner);

    await TestHelper.depositToGauge(owner, gaugeMimUst, mimUstPair, amount1000At6, 0);

    await mimUstPair.approve(staking.address, amount1000At6);
    await staking.stake(amount1000At6);

    expect(await gaugeMimUst.totalSupply()).to.equal(amount1000At6);
    expect(await gaugeMimUst.earned(core.ve.address, owner.address)).to.equal(0);

    await core.voter.vote(1, [mimUstPair.address], [100]);
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

  it("early update period should do nothing", async function () {
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);

    await core.minter.update_period();

    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);
  });

  it("update period 10 weeks", async function () {
    await TimeUtils.advanceBlocksOnTs(WEEK * 10);
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);

    await core.minter.update_period();

    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    // not exact amount coz veDYST balance fluctuation during time
    TestHelper.closer(await core.token.balanceOf(core.veDist.address), parseUnits('961622'), parseUnits('1000'));
    TestHelper.closer(await core.token.balanceOf(core.voter.address), parseUnits('1014098'), parseUnits('1000'));
  });

  it("update period and distribute reward to voter and veDist", async function () {
    await TimeUtils.advanceBlocksOnTs(WEEK * 2);
    // should be empty before the first update
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);

    await core.minter.update_period();

    // minter without enough token should distribute everything to veDist and voter
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    // not exact amount coz veDYST balance fluctuation during time
    TestHelper.closer(await core.token.balanceOf(core.veDist.address), parseUnits('258628'), parseUnits('1000'));
    TestHelper.closer(await core.token.balanceOf(core.voter.address), parseUnits('262134'), parseUnits('1000'));

    // ------------ CHECK CLAIM VE ----------

    const toClaim = await core.veDist.claimable(1);
    TestHelper.closer(toClaim, parseUnits('58287'), parseUnits('1000'));

    expect(await core.token.balanceOf(owner.address)).is.eq(0, "before the first update we should have 0 DYST");
    const veBalance = (await core.ve.locked(1)).amount;

    await core.veDist.claim(1);

    // claimed DYST will be deposited to veDYST
    TestHelper.closer((await core.ve.locked(1)).amount, toClaim.add(veBalance), parseUnits('1000'));

    // ----------- CHECK CLAIM GAUGE ----------
    expect(await core.token.balanceOf(gaugeMimUst.address)).is.eq(0);

    // distribute DYST to all gauges
    await core.voter.distro();

    // voter has some dust after distribution
    TestHelper.closer(await core.token.balanceOf(core.voter.address), parseUnits('0'), parseUnits('100'));
    TestHelper.closer(await core.token.balanceOf(gaugeMimUst.address), parseUnits('262134'), parseUnits('1000'));

    expect(await core.token.balanceOf(owner.address)).is.eq(0);

    await gaugeMimUst.getReward(owner.address, [core.token.address]);
    // some little amount after distribute
    TestHelper.closer(await core.token.balanceOf(owner.address), parseUnits('0.5'), parseUnits('0.1'));

    // wait 1 week for 100% rewards
    await TimeUtils.advanceBlocksOnTs(WEEK);

    await gaugeMimUst.getReward(owner.address, [core.token.address]);
    TestHelper.closer(await core.token.balanceOf(owner.address), parseUnits('262134'), parseUnits('1000'));
  });

});
