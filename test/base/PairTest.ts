import {BaseV1Factory, BaseV1Pair, BaseV1Router01, Token} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../scripts/deploy/Deploy";
import {TimeUtils} from "../TimeUtils";
import {TestHelper} from "../TestHelper";
import {BigNumber, utils} from "ethers";
import {MaticTestnetAddresses} from "../../scripts/addresses/MaticTestnetAddresses";
import {parseUnits} from "ethers/lib/utils";

const {expect} = chai;

describe("pair tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let factory: BaseV1Factory;
  let router: BaseV1Router01;

  let ust: Token;
  let mim: Token;
  let dai: Token;

  let pair: BaseV1Pair;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2, owner3] = await ethers.getSigners();
    factory = await Deploy.deployBaseV1Factory(owner, owner.address);
    router = await Deploy.deployBaseV1Router01(owner, factory.address, MaticTestnetAddresses.WMATIC_TOKEN);

    [ust, mim, dai] = await TestHelper.createMockTokensAndMint(owner);
    await ust.transfer(owner2.address, utils.parseUnits('100', 6));
    await mim.transfer(owner2.address, utils.parseUnits('100'));
    await dai.transfer(owner2.address, utils.parseUnits('100'));

    pair = await TestHelper.addLiquidity(
      factory,
      router,
      owner,
      mim.address,
      ust.address,
      utils.parseUnits('1'),
      utils.parseUnits('1', 6),
      true
    );
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

  it("observationLength test", async function () {
    expect(await pair.observationLength()).is.eq(1);
  });

  it("currentCumulativePrices test", async function () {
    await mim.approve(router.address, parseUnits('1'));
    await router.swapExactTokensForTokens(parseUnits('0.01'), BigNumber.from(0), [{
      from: mim.address,
      to: ust.address,
      stable: true,
    }], owner.address, 9999999999);
    expect((await pair.currentCumulativePrices())[0]).is.not.eq(0);
  });

  it("current twap price test", async function () {
    await mim.approve(router.address, parseUnits('1'));
    await router.swapExactTokensForTokens(parseUnits('0.01'), BigNumber.from(0), [{
      from: mim.address,
      to: ust.address,
      stable: true,
    }], owner.address, 9999999999);
    expect(await pair.current(mim.address, parseUnits('1'))).is.eq(BigNumber.from(753733));
  });

  it("current twap price test with quote", async function () {
    await mim.approve(router.address, parseUnits('1'));
    await router.swapExactTokensForTokens(parseUnits('0.01'), BigNumber.from(0), [{
      from: mim.address,
      to: ust.address,
      stable: true,
    }], owner.address, 9999999999);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await router.swapExactTokensForTokens(parseUnits('0.01'), BigNumber.from(0), [{
      from: mim.address,
      to: ust.address,
      stable: true,
    }], owner.address, 9999999999);
    expect(await pair.quote(mim.address, parseUnits('1'), 1)).is.eq(BigNumber.from(747257));
  });

  it("current twap price test with points", async function () {
    await mim.approve(router.address, parseUnits('1'));
    await router.swapExactTokensForTokens(parseUnits('0.01'), BigNumber.from(0), [{
      from: mim.address,
      to: ust.address,
      stable: true,
    }], owner.address, 9999999999);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await router.swapExactTokensForTokens(parseUnits('0.01'), BigNumber.from(0), [{
      from: mim.address,
      to: ust.address,
      stable: true,
    }], owner.address, 9999999999);
    expect((await pair.prices(mim.address, parseUnits('1'), 1))[0]).is.eq(BigNumber.from(747257));
  });

  it("burn test", async function () {
    await pair.approve(router.address, parseUnits('10000'));
    await router.removeLiquidity(
      mim.address,
      ust.address,
      true,
      await pair.balanceOf(owner.address),
      0,
      0,
      owner.address,
      999999999999
    );
    expect(await pair.balanceOf(owner.address)).is.eq(0);
  });

  it("skim test", async function () {
    const balA = await mim.balanceOf(pair.address);
    const balB = await ust.balanceOf(pair.address);
    await mim.transfer(pair.address, parseUnits('0.001'));
    await ust.transfer(pair.address, parseUnits('0.001', 6));
    await pair.skim(owner.address);
    expect(await mim.balanceOf(pair.address)).is.eq(balA);
    expect(await ust.balanceOf(pair.address)).is.eq(balB);
  });

  it("sync test", async function () {
    const balA = await pair.reserve0();
    const balB = await pair.reserve1();
    await mim.transfer(pair.address, parseUnits('0.001'));
    await ust.transfer(pair.address, parseUnits('0.001', 6));
    await pair.sync();
    expect(await pair.reserve0()).is.not.eq(0);
    expect(await pair.reserve1()).is.not.eq(0);
  });

});
