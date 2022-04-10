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
import {BigNumber, utils} from "ethers";
import {TestHelper} from "../TestHelper";
import {TimeUtils} from "../TimeUtils";
import {parseUnits} from "ethers/lib/utils";

const {expect} = chai;

const amount1000At6 = parseUnits('1000', 6);
const amount100At18 = parseUnits('100', 18);
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

    [ust, mim, dai] = await TestHelper.createMockTokensAndMint(owner);
    await ust.transfer(owner2.address, utils.parseUnits('100', 6));
    await mim.transfer(owner2.address, utils.parseUnits('100'));
    await dai.transfer(owner2.address, utils.parseUnits('100'));

    await ust.transfer(owner3.address, utils.parseUnits('100', 6));
    await mim.transfer(owner3.address, utils.parseUnits('100'));
    await dai.transfer(owner3.address, utils.parseUnits('100'));

    core = await Deploy.deployCore(
      owner,
      MaticTestnetAddresses.WMATIC_TOKEN,
      [MaticTestnetAddresses.WMATIC_TOKEN, ust.address, mim.address, dai.address],
      [owner.address, owner2.address],
      [utils.parseUnits('100'), utils.parseUnits('100')],
      utils.parseUnits('200')
    );

    mimUstPair = await TestHelper.addLiquidity(
      core,
      owner,
      mim.address,
      ust.address,
      utils.parseUnits('1'),
      utils.parseUnits('1', 6),
      true
    );
    mimDaiPair = await TestHelper.addLiquidity(
      core,
      owner,
      mim.address,
      dai.address,
      utils.parseUnits('1'),
      utils.parseUnits('1'),
      true
    );
    ustDaiPair = await TestHelper.addLiquidity(
      core,
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

    const sr = await ethers.getContractFactory("StakingRewards");
    staking = await sr.deploy(mimUstPair.address, core.token.address);

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

    await TestHelper.depositToGauge(owner, gaugeMimUst, mimUstPair, amount1000At6, 0);
    await TestHelper.depositToGauge(owner, gaugeMimDai, mimDaiPair, amount1000At6, 0);
    await TestHelper.depositToGauge(owner, gaugeUstDai, ustDaiPair, amount1000At6, 0);

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

  it("test", async function () {



  });


});
