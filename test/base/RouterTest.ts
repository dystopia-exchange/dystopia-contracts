import {BaseV1Factory, BaseV1Pair__factory, BaseV1Router01, Token} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../scripts/deploy/Deploy";
import {TimeUtils} from "../TimeUtils";
import {MaticTestnetAddresses} from "../../scripts/addresses/MaticTestnetAddresses";
import {TestHelper} from "../TestHelper";
import {utils} from "ethers";
import {parseUnits} from "ethers/lib/utils";

const {expect} = chai;

describe("router tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let factory: BaseV1Factory;
  let router: BaseV1Router01;

  let ust: Token;
  let mim: Token;
  let dai: Token;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    factory = await Deploy.deployBaseV1Factory(owner, owner.address);
    router = await Deploy.deployBaseV1Router01(owner, factory.address, MaticTestnetAddresses.WMATIC_TOKEN);

    [ust, mim, dai] = await TestHelper.createMockTokensAndMint(owner);
    await ust.transfer(owner2.address, utils.parseUnits('100', 6));
    await mim.transfer(owner2.address, utils.parseUnits('100'));
    await dai.transfer(owner2.address, utils.parseUnits('100'));
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

  it("quoteAddLiquidity on empty pair", async function () {
    await router.quoteAddLiquidity(
      mim.address,
      ust.address,
      true,
      parseUnits('1'),
      parseUnits('1', 6),
    );
  });

  it("quoteAddLiquidity on exist pair", async function () {
    await TestHelper.addLiquidity(
      factory,
      router,
      owner,
      mim.address,
      ust.address,
      utils.parseUnits('1'),
      utils.parseUnits('1', 6),
      true
    );

    await router.quoteAddLiquidity(
      mim.address,
      ust.address,
      true,
      parseUnits('1'),
      parseUnits('1', 6),
    );
  });

  it("quoteRemoveLiquidity on empty pair", async function () {
    await router.quoteRemoveLiquidity(
      mim.address,
      ust.address,
      true,
      parseUnits('1'),
    );
  });

  it("addLiquidityMATIC test", async function () {
    await mim.approve(router.address, parseUnits('1'));
    await router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );
  });

  it("removeLiquidityMATIC test", async function () {
    await mim.approve(router.address, parseUnits('1'));
    await router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    const pairAdr = await factory.getPair(mim.address, MaticTestnetAddresses.WMATIC_TOKEN, true);

    await BaseV1Pair__factory.connect(pairAdr, owner).approve(router.address, parseUnits('1111'));
    await router.removeLiquidityMATIC(
      mim.address,
      true,
      parseUnits('0.1'),
      0,
      0,
      owner.address,
      99999999999,
    );
  });


  it("removeLiquidityWithPermit test", async function () {
    await mim.approve(router.address, parseUnits('1'));
    await router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    const pairAdr = await factory.getPair(mim.address, MaticTestnetAddresses.WMATIC_TOKEN, true);
    const pair = BaseV1Pair__factory.connect(pairAdr, owner);

    const {
      v,
      r,
      s
    } = await TestHelper.permitForPair(owner, pair, router.address, parseUnits('0.1'));

    await router.removeLiquidityWithPermit(
      mim.address,
      MaticTestnetAddresses.WMATIC_TOKEN,
      true,
      parseUnits('0.1'),
      0,
      0,
      owner.address,
      99999999999,
      false, v, r, s
    );
  });

  it("removeLiquidityMATICWithPermit test", async function () {
    await mim.approve(router.address, parseUnits('1'));
    await router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    const pairAdr = await factory.getPair(mim.address, MaticTestnetAddresses.WMATIC_TOKEN, true);
    const pair = BaseV1Pair__factory.connect(pairAdr, owner);

    const {
      v,
      r,
      s
    } = await TestHelper.permitForPair(owner, pair, router.address, parseUnits('0.1'));

    await router.removeLiquidityMATICWithPermit(
      mim.address,
      true,
      parseUnits('0.1'),
      0,
      0,
      owner.address,
      99999999999,
      false, v, r, s
    );
  });

  it("swapExactTokensForTokensSimple test", async function () {
    await mim.approve(router.address, parseUnits('10'));

    await router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    await router.swapExactTokensForTokensSimple(
      parseUnits('0.1'),
      0,
      mim.address,
      MaticTestnetAddresses.WMATIC_TOKEN,
      true,
      owner.address,
      99999999999
    );
  });

  it("swapExactTokensForMATIC test", async function () {
    await mim.approve(router.address, parseUnits('10'));

    await router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    await router.swapExactTokensForMATIC(
      parseUnits('0.1'),
      0,
      [{
        from: mim.address,
        to: MaticTestnetAddresses.WMATIC_TOKEN,
        stable: true,
      }],
      owner.address,
      99999999999
    );
  });

  it("UNSAFE_swapExactTokensForTokens test", async function () {
    await mim.approve(router.address, parseUnits('10'));

    await router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    await router.UNSAFE_swapExactTokensForTokens(
      [parseUnits('0.1'), parseUnits('0.1')],
      [{
        from: mim.address,
        to: MaticTestnetAddresses.WMATIC_TOKEN,
        stable: true,
      }],
      owner.address,
      99999999999
    );
  });


});
