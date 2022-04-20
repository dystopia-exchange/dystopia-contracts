import {
  DystFactory,
  DystPair__factory,
  DystRouter01,
  Migrator,
  Token,
  UniswapV2Factory,
  UniswapV2Pair__factory
} from "../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../scripts/deploy/Deploy";
import {TimeUtils} from "./TimeUtils";
import {TestHelper} from "./TestHelper";
import {utils} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import {Misc} from "../scripts/Misc";

const {expect} = chai;

describe("migrator tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let factory: DystFactory;
  let router: DystRouter01;

  let wmatic: Token;
  let ust: Token;
  let mim: Token;
  let dai: Token;

  let uniFactory: UniswapV2Factory;
  let migrator: Migrator;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;

    factory = await Deploy.deployDystFactory(owner, owner.address);
    router = await Deploy.deployDystRouter01(owner, factory.address, wmatic.address);

    [ust, mim, dai] = await TestHelper.createMockTokensAndMint(owner);
    await ust.transfer(owner2.address, utils.parseUnits('100', 6));
    await mim.transfer(owner2.address, utils.parseUnits('100'));
    await dai.transfer(owner2.address, utils.parseUnits('100'));

    uniFactory = await Deploy.deployContract(owner, 'UniswapV2Factory', owner.address) as UniswapV2Factory;
    migrator = await Deploy.deployContract(owner, 'Migrator', uniFactory.address, router.address) as Migrator;

    await uniFactory.createPair(ust.address, mim.address);
    const oldPair = UniswapV2Pair__factory.connect(await uniFactory.getPair(ust.address, mim.address), owner);

    await ust.transfer(oldPair.address, parseUnits('1', 6));
    await mim.transfer(oldPair.address, parseUnits('1'));
    await oldPair.mint(owner.address);
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

  it("migrate", async function () {
    console.log('owner', owner.address);
    const oldPair = UniswapV2Pair__factory.connect(await migrator.getOldPair(mim.address, ust.address), owner);

    expect(await factory.getPair(mim.address, ust.address, true)).is.eq(Misc.ZERO_ADDRESS);
    let oldPairBalance = await oldPair.balanceOf(owner.address);
    expect(oldPairBalance).is.not.eq(0);

    let [amountMim, amountUst] = await migrator.getAmountsFromLiquidityForOldPair(mim.address, ust.address, oldPairBalance)

    const {
      v,
      r,
      s
    } = await TestHelper.permitForPair(
      owner,
      DystPair__factory.connect(oldPair.address, owner),
      migrator.address,
      oldPairBalance
    );

    await migrator.migrateWithPermit(
      mim.address,
      ust.address,
      true,
      oldPairBalance,
      amountMim.mul(999).div(1000),
      amountUst.mul(999).div(1000),
      99999999999,
      v, r, s
    );

    const pair = await factory.getPair(mim.address, ust.address, true);
    const bal = await DystPair__factory.connect(pair, owner).balanceOf(owner.address);
    // initial liquidity gap
    TestHelper.closer(bal, oldPairBalance, parseUnits('1', 6));

    // *** TWICE ***
    expect(await oldPair.balanceOf(owner.address)).is.eq(0);

    await ust.transfer(oldPair.address, parseUnits('1', 6));
    await mim.transfer(oldPair.address, parseUnits('1'));
    await oldPair.mint(owner.address);

    oldPairBalance = await oldPair.balanceOf(owner.address);
    expect(oldPairBalance).is.not.eq(0);

    [amountMim, amountUst] = await migrator.getAmountsFromLiquidityForOldPair(mim.address, ust.address, oldPairBalance)

    const {
      v: v1,
      r: r1,
      s: s1
    } = await TestHelper.permitForPair(
      owner,
      DystPair__factory.connect(oldPair.address, owner),
      migrator.address,
      oldPairBalance
    );

    await migrator.migrateWithPermit(
      mim.address,
      ust.address,
      true,
      oldPairBalance,
      amountMim.mul(999).div(1000),
      amountUst.mul(999).div(1000),
      99999999999,
      v1, r1, s1
    );

    const bal2 = await DystPair__factory.connect(pair, owner).balanceOf(owner.address);

    const ustBal = await ust.balanceOf(owner.address);
    const mimBal = await mim.balanceOf(owner.address);
    await DystPair__factory.connect(pair, owner).transfer(pair, bal2);
    await DystPair__factory.connect(pair, owner).burn(owner.address);
    const ustBalGap = (await ust.balanceOf(owner.address)).sub(ustBal);
    const mimBalGap = (await mim.balanceOf(owner.address)).sub(mimBal);

    TestHelper.closer(ustBalGap, parseUnits('2', 6), parseUnits('0.00001', 6));
    TestHelper.closer(mimBalGap, parseUnits('2'), parseUnits('0.00001'));

    expect(await ust.balanceOf(migrator.address)).is.eq(0);
    expect(await mim.balanceOf(migrator.address)).is.eq(0);
    expect(await DystPair__factory.connect(pair, owner).balanceOf(migrator.address)).is.eq(0);
    expect(await oldPair.balanceOf(migrator.address)).is.eq(0);
  });


});
