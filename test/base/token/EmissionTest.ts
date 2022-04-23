import {
  DystMinter__factory,
  DystPair,
  Bribe,
  Bribe__factory,
  Gauge,
  Gauge__factory,
  Multicall2,
  StakingRewards,
  Token
} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {CoreAddresses} from "../../../scripts/deploy/CoreAddresses";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {TestHelper} from "../../TestHelper";
import {TimeUtils} from "../../TimeUtils";
import {Misc} from "../../../scripts/Misc";
import {formatUnits, parseUnits} from "ethers/lib/utils";
import {appendFileSync, writeFileSync} from "fs";
import {BigNumber} from "ethers";
import {MaticTestnetAddresses} from "../../../scripts/addresses/MaticTestnetAddresses";

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
  let wmatic: Token;
  let ust: Token;
  let mim: Token;
  let dai: Token;
  let mimUstPair: DystPair;

  let gaugeMimUst: Gauge;

  let bribeMimUst: Bribe;

  let staking: StakingRewards;

  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();

    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
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
      core.factory,
      core.router,
      owner,
      mim.address,
      ust.address,
      parseUnits('1'),
      parseUnits('1', 6),
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

  it("gauge deposit/withdraw all test", async function () {
    await mimUstPair.approve(gaugeMimUst.address, parseUnits('999999999999'));
    await gaugeMimUst.depositAll(0);
    await gaugeMimUst.withdrawAll();
    await gaugeMimUst.depositAll(1);
    await gaugeMimUst.withdrawAll();
  });

  it("early update period should do nothing", async function () {
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);

    await core.minter.updatePeriod();

    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);
  });

  it("update period 10 weeks", async function () {
    await TimeUtils.advanceBlocksOnTs(WEEK * 10);
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);

    await core.minter.updatePeriod();

    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    // not exact amount coz veDYST balance fluctuation during time
    TestHelper.closer(await core.token.balanceOf(core.veDist.address), parseUnits('188000'), parseUnits('3000'));
    TestHelper.closer(await core.token.balanceOf(core.voter.address), parseUnits('2000000'), parseUnits('0'));
  });

  it("update period twice", async function () {
    await TimeUtils.advanceBlocksOnTs(WEEK * 2);
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);

    await core.minter.updatePeriod();

    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    // not exact amount coz veDYST balance fluctuation during time
    const veDistBal = await core.token.balanceOf(core.veDist.address);
    const voterBal = await core.token.balanceOf(core.voter.address);
    TestHelper.closer(veDistBal, parseUnits('196000'), parseUnits('3000'));
    TestHelper.closer(voterBal, parseUnits('2000000'), parseUnits('0'));

    await TimeUtils.advanceBlocksOnTs(WEEK);

    await core.minter.updatePeriod();

    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    // not exact amount coz veDYST balance fluctuation during time
    TestHelper.closer((await core.token.balanceOf(core.veDist.address)).sub(veDistBal), parseUnits('150'), parseUnits('50'));
    TestHelper.closer((await core.token.balanceOf(core.voter.address)).sub(voterBal), parseUnits('17000000'), parseUnits('1000000'));
  });

  it("update period and distribute reward to voter and veDist", async function () {
    await TimeUtils.advanceBlocksOnTs(WEEK * 2);
    // should be empty before the first update
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    expect(await core.token.balanceOf(core.veDist.address)).is.eq(0);
    expect(await core.token.balanceOf(core.voter.address)).is.eq(0);

    await core.minter.updatePeriod();

    // minter without enough token should distribute everything to veDist and voter
    expect(await core.token.balanceOf(core.minter.address)).is.eq(0);
    // not exact amount coz veDYST balance fluctuation during time
    TestHelper.closer(await core.token.balanceOf(core.veDist.address), parseUnits('196000'), parseUnits('10000'));
    TestHelper.closer(await core.token.balanceOf(core.voter.address), parseUnits('2000000'), parseUnits('10000'));

    // ------------ CHECK CLAIM VE ----------

    const toClaim = await core.veDist.claimable(1);
    expect(toClaim).is.above(parseUnits('30000'));

    expect(await core.token.balanceOf(owner.address)).is.eq(0, "before the first update we should have 0 DYST");
    const veBalance = (await core.ve.locked(1)).amount;

    await core.veDist.claim(1);

    // claimed DYST will be deposited to veDYST
    TestHelper.closer((await core.ve.locked(1)).amount, toClaim.add(veBalance), parseUnits('10000'));

    // ----------- CHECK CLAIM GAUGE ----------
    expect(await core.token.balanceOf(gaugeMimUst.address)).is.eq(0);

    // distribute DYST to all gauges
    await core.voter.distributeAll();

    // voter has some dust after distribution
    TestHelper.closer(await core.token.balanceOf(core.voter.address), parseUnits('0'), parseUnits('100'));
    TestHelper.closer(await core.token.balanceOf(gaugeMimUst.address), parseUnits('2000000'), parseUnits('10000'));

    expect(await core.token.balanceOf(owner.address)).is.eq(0);

    await gaugeMimUst.getReward(owner.address, [core.token.address]);
    // some little amount after distribute
    TestHelper.gte(await core.token.balanceOf(owner.address), parseUnits('0'));

    // wait 1 week for 100% rewards
    await TimeUtils.advanceBlocksOnTs(WEEK);

    await gaugeMimUst.getReward(owner.address, [core.token.address]);
    TestHelper.closer(await core.token.balanceOf(owner.address), parseUnits('2000000'), parseUnits('10000'));
  });

  // for manual testing
  it.skip("emission loop", async function () {
    await emissionLoop(owner, ust, mim, wmatic, parseUnits('20000000'), 70);
  });

});


async function emissionLoop(
  owner: SignerWithAddress,
  ust: Token,
  mim: Token,
  wmatic: Token,
  initial: BigNumber,
  lockPercent = 0,
) {
  const file = 'tmp/emission.txt';
  writeFileSync(file, 'id;token supply;ve supply;circulation_supply;gauges rewards;ve rewards;locked\n');

  // ------------- setup a fresh core --------------

  const mc = await Deploy.deployContract(owner, 'Multicall2') as Multicall2;

  const core = await Deploy.deployCore(
    owner,
    wmatic.address,
    [wmatic.address, ust.address, mim.address],
    [owner.address],
    [initial],
    initial
  );
  const pair = await TestHelper.addLiquidity(
    core.factory,
    core.router,
    owner,
    mim.address,
    ust.address,
    parseUnits('1'),
    parseUnits('1', 6),
    true
  );
  const pairBalance = await pair.balanceOf(owner.address);
  await core.voter.createGauge(pair.address);
  const gauge = Gauge__factory.connect(await core.voter.gauges(pair.address), owner);
  await TestHelper.depositToGauge(owner, gauge, pair, pairBalance, 1);
  await core.voter.vote(1, [pair.address], [100]);
  await core.token.approve(core.ve.address, parseUnits('99999999999999999999'));
  // --------------------------- LOOPS -----------------------------

  for (let i = 0; i < 200; i++) {

    const activePeriod = (await core.minter.activePeriod()).toNumber();
    const now = (await mc.getCurrentBlockTimestamp()).toNumber();
    console.log('!!! PERIOD', activePeriod, now, activePeriod + WEEK - now);
    await TimeUtils.advanceBlocksOnTs(activePeriod + WEEK - now);

    await core.ve.increaseUnlockTime(1, 365 * 86400 * 4);

    // update period inside
    const tx = await gauge.getReward(owner.address, [core.token.address]);
    const receipt = await tx.wait(1);
    // tslint:disable-next-line
    const log = receipt.events?.find((l: any) => l.topics[0] === DystMinter__factory.createInterface().getEventTopic('Mint'));
    let weekly = '-1';
    let growth = '-1';
    if (log) {
      weekly = formatUnits(DystMinter__factory.createInterface().parseLog(log).args[1]);
      growth = formatUnits(DystMinter__factory.createInterface().parseLog(log).args[2]);
    }

    const tokenBalance = await core.token.balanceOf(owner.address);
    // if (i < 10) {
    //   lockPercent = 20;
    // } else if (i < 20) {
    //   lockPercent = 50;
    // } else if (i < 50) {
    //   lockPercent = 70;
    // } else {
    //   lockPercent = 90;
    // }
    if (lockPercent !== 0 && !tokenBalance.isZero()) {
      const amount = tokenBalance.mul(lockPercent).div(100);
      console.log('!!!AMOUNT FOR DEPOSIT FROM GAUGES', formatUnits(amount), lockPercent);
      await core.ve.depositFor(1, amount);
      // imitate sell
      await core.token.transfer(ust.address, tokenBalance.sub(amount))
    }

    const totalSupply = await core.token.totalSupply();
    const veSupply = await core.ve.totalSupply();
    const circulationSupply = await core.minter.circulatingSupply();

    const data = '' +
      `${i};` +
      `${formatUnits(totalSupply)};` +
      `${formatUnits(veSupply)};` +
      `${formatUnits(circulationSupply)};` +
      `${weekly};` +
      `${growth};` +
      `${+formatUnits(veSupply) / +formatUnits(veSupply.add(circulationSupply)) * 100}` +
      '\n';

    appendFileSync(file, data);
  }

}
