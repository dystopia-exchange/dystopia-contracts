import {Bribe, Bribe__factory, DystPair, Gauge, Gauge__factory, Token} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {TimeUtils} from "../../TimeUtils";
import {TestHelper} from "../../TestHelper";
import {MaticTestnetAddresses} from "../../../scripts/addresses/MaticTestnetAddresses";
import {parseUnits} from "ethers/lib/utils";
import {CoreAddresses} from "../../../scripts/deploy/CoreAddresses";

const {expect} = chai;

describe("ve tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let core: CoreAddresses;
  let wmatic: Token;
  let ust: Token;
  let mim: Token;
  let dai: Token;
  let pair: DystPair;

  let gauge: Gauge;

  let bribe: Bribe;


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
      [parseUnits('100'), parseUnits('100')],
      parseUnits('200')
    );

    // -------------- create pairs ---------------------

    pair = await TestHelper.addLiquidity(
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

    await core.voter.createGauge(pair.address);
    const gaugeMimUstAddress = await core.voter.gauges(pair.address);
    const bribeMimUstAddress = await core.voter.bribes(gaugeMimUstAddress);
    gauge = Gauge__factory.connect(gaugeMimUstAddress, owner);
    bribe = Bribe__factory.connect(bribeMimUstAddress, owner);
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

  it("", async function () {

  });


});
