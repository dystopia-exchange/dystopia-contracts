import {
  DystFactory,
  DystPair__factory,
  DystRouter01,
  Token,
  TokenWithFee
} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {TimeUtils} from "../../TimeUtils";
import {TestHelper} from "../../TestHelper";
import {BigNumber, utils} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import {Misc} from "../../../scripts/Misc";

const {expect} = chai;

describe("router tests", function () {

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
  let tokenWithFee: TokenWithFee;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    await wmatic.mint(owner.address, parseUnits('1000'));
    factory = await Deploy.deployDystFactory(owner, owner.address);
    router = await Deploy.deployDystRouter01(owner, factory.address, wmatic.address);

    [ust, mim, dai] = await TestHelper.createMockTokensAndMint(owner);
    await ust.transfer(owner2.address, utils.parseUnits('100', 6));
    await mim.transfer(owner2.address, utils.parseUnits('100'));
    await dai.transfer(owner2.address, utils.parseUnits('100'));

    tokenWithFee = await Deploy.deployContract(owner, 'TokenWithFee', 'TWF', 'TWF', 18, owner.address) as TokenWithFee;
    await tokenWithFee.mint(owner.address, utils.parseUnits('1000000000000'));
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
      parseUnits('10', 6),
    );
  });

  it("quoteAddLiquidity on exist pair2", async function () {
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
      parseUnits('10'),
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

    const pairAdr = await factory.getPair(mim.address, wmatic.address, true);

    await DystPair__factory.connect(pairAdr, owner).approve(router.address, parseUnits('1111'));
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

    const pairAdr = await factory.getPair(mim.address, wmatic.address, true);
    const pair = DystPair__factory.connect(pairAdr, owner);

    const {
      v,
      r,
      s
    } = await TestHelper.permitForPair(owner, pair, router.address, parseUnits('0.1'));

    await router.removeLiquidityWithPermit(
      mim.address,
      wmatic.address,
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

    const pairAdr = await factory.getPair(mim.address, wmatic.address, true);
    const pair = DystPair__factory.connect(pairAdr, owner);

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
      wmatic.address,
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
        to: wmatic.address,
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
        to: wmatic.address,
        stable: true,
      }],
      owner.address,
      99999999999
    );
  });

  it("swapExactMATICForTokens test", async function () {
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

    await router.swapExactMATICForTokens(
      0,
      [{
        from: wmatic.address,
        to: mim.address,
        stable: true,
      }],
      owner.address,
      99999999999,
      {value: parseUnits('0.1')}
    );
  });

  it("add/remove liquidity with fee token test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('10'));
    const maticBalance = await owner.getBalance();
    const tokenBalance = await tokenWithFee.balanceOf(owner.address);

    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('1')}
    );

    const pairAdr = await factory.getPair(tokenWithFee.address, wmatic.address, true);
    const pair = DystPair__factory.connect(pairAdr, owner);
    const pairBal = await pair.balanceOf(owner.address);

    const {
      v,
      r,
      s
    } = await TestHelper.permitForPair(owner, pair, router.address, pairBal);

    await router.removeLiquidityMATICWithPermitSupportingFeeOnTransferTokens(
      tokenWithFee.address,
      true,
      pairBal,
      0,
      0,
      owner.address,
      99999999999,
      false, v, r, s
    );

    const maticBalanceAfter = await owner.getBalance();
    const tokenBalanceAfter = await tokenWithFee.balanceOf(owner.address);
    TestHelper.closer(maticBalanceAfter, maticBalance, parseUnits('0.1'));
    TestHelper.closer(tokenBalanceAfter, tokenBalance, parseUnits('0.3'));
  });


  it("swapExactTokensForTokensSupportingFeeOnTransferTokens test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('10'));

    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('1')}
    );

    const maticBalance = await owner.getBalance();
    const tokenBalance = await tokenWithFee.balanceOf(owner.address);

    await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      parseUnits('0.1'),
      0,
      [{from: tokenWithFee.address, to: wmatic.address, stable: true}],
      owner.address,
      99999999999
    );

    const maticBalanceAfter = await owner.getBalance();
    const tokenBalanceAfter = await tokenWithFee.balanceOf(owner.address);
    TestHelper.closer(maticBalanceAfter, maticBalance, parseUnits('11'));
    TestHelper.closer(tokenBalanceAfter, tokenBalance, parseUnits('0.5'));
  });

  it("swapExactMATICForTokensSupportingFeeOnTransferTokens test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('10'));

    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('1')}
    );

    const maticBalance = await owner.getBalance();
    const tokenBalance = await tokenWithFee.balanceOf(owner.address);

    await router.swapExactMATICForTokensSupportingFeeOnTransferTokens(
      0,
      [{to: tokenWithFee.address, from: wmatic.address, stable: true}],
      owner.address,
      99999999999,
      {value: parseUnits('0.1')}
    );

    const maticBalanceAfter = await owner.getBalance();
    const tokenBalanceAfter = await tokenWithFee.balanceOf(owner.address);
    TestHelper.closer(maticBalanceAfter, maticBalance, parseUnits('2'));
    TestHelper.closer(tokenBalanceAfter, tokenBalance, parseUnits('0.1'));
  });

  it("swapExactTokensForMATICSupportingFeeOnTransferTokens test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('10'));

    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('1')}
    );

    const maticBalance = await owner.getBalance();
    const tokenBalance = await tokenWithFee.balanceOf(owner.address);

    await router.swapExactTokensForMATICSupportingFeeOnTransferTokens(
      parseUnits('0.1'),
      0,
      [{from: tokenWithFee.address, to: wmatic.address, stable: true}],
      owner.address,
      99999999999,
    );

    const maticBalanceAfter = await owner.getBalance();
    const tokenBalanceAfter = await tokenWithFee.balanceOf(owner.address);
    TestHelper.closer(maticBalanceAfter, maticBalance, parseUnits('2'));
    TestHelper.closer(tokenBalanceAfter, tokenBalance, parseUnits('0.2'));
  });

  it("getExactAmountOut test", async function () {
    expect(await router.getExactAmountOut(
      parseUnits('0.1'),
      tokenWithFee.address,
      wmatic.address,
      true,
    )).is.eq(0);

    await tokenWithFee.approve(router.address, parseUnits('10'));

    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('1')}
    );

    expect(await router.getExactAmountOut(
      parseUnits('0.1'),
      tokenWithFee.address,
      wmatic.address,
      true,
    )).is.not.eq(0);
  });

  it("deadline reject", async function () {
    await expect(router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      1,
      {value: parseUnits('10')}
    )).revertedWith('DystRouter: EXPIRED');
  });

  it("sort tokens identical address", async function () {
    await expect(router.sortTokens(
      mim.address,
      mim.address,
    )).revertedWith('DystRouter: IDENTICAL_ADDRESSES');
  });

  it("sort tokens zero address", async function () {
    await expect(router.sortTokens(
      mim.address,
      Misc.ZERO_ADDRESS,
    )).revertedWith('DystRouter: ZERO_ADDRESS');
  });

  it("getAmountOut for not exist pair", async function () {
    expect((await router.getAmountOut(
      0,
      mim.address,
      dai.address,
    ))[0]).eq(0);
  });

  it("receive matic not from wmatic reject", async function () {
    await expect(owner.sendTransaction({value: 1, to: router.address})).revertedWith("DystRouter: NOT_WMATIC");
  });

  it("getReserves", async function () {
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
    await router.getReserves(mim.address, ust.address, true);
  });

  it("getAmountsOut wrong path", async function () {
    await expect(router.getAmountsOut(0, [])).revertedWith('DystRouter: INVALID_PATH');
  });

  it("quoteLiquidity zero amount", async function () {
    await expect(router.quoteLiquidity(0, 0, 0)).revertedWith('DystRouter: INSUFFICIENT_AMOUNT');
  });

  it("quoteLiquidity IL", async function () {
    await expect(router.quoteLiquidity(1, 0, 0)).revertedWith('DystRouter: INSUFFICIENT_LIQUIDITY');
  });

  it("getAmountsOut with not exist pair", async function () {
    expect((await router.getAmountsOut(0, [{
      from: wmatic.address,
      to: mim.address,
      stable: false
    }]))[0]).eq(0);
  });

  it("add liquidity amount desired check", async function () {
    await expect(router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      parseUnits('100'),
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    )).revertedWith('DystRouter: DESIRED_A_AMOUNT');
    await expect(router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1000'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    )).revertedWith('DystRouter: DESIRED_B_AMOUNT');
  });


  it("add liquidity IA check", async function () {
    await TestHelper.addLiquidity(
      factory,
      router,
      owner,
      mim.address,
      wmatic.address,
      utils.parseUnits('1'),
      utils.parseUnits('1'),
      true
    );

    await expect(router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('0.037'),
      parseUnits('0.037'),
      parseUnits('0.77'),
      owner.address,
      99999999999,
      {value: parseUnits('0.77')}
    )).revertedWith('DystRouter: INSUFFICIENT_B_AMOUNT');

    await expect(router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('0.037'),
      parseUnits('0.037'),
      parseUnits('0.01'),
      owner.address,
      99999999999,
      {value: parseUnits('0.01')}
    )).revertedWith('DystRouter: INSUFFICIENT_A_AMOUNT');
  });


  it("addLiquidityMATIC send back dust", async function () {
    await TestHelper.addLiquidity(
      factory,
      router,
      owner,
      mim.address,
      wmatic.address,
      utils.parseUnits('1'),
      utils.parseUnits('1'),
      true
    );

    await mim.approve(router.address, parseUnits('10'));
    await router.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      0,
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );
  });


  it("remove Liquidity IA test", async function () {
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

    const pairAdr = await factory.getPair(mim.address, wmatic.address, true);

    await DystPair__factory.connect(pairAdr, owner).approve(router.address, parseUnits('1111'));
    await expect(router.removeLiquidity(
      mim.address,
      wmatic.address,
      true,
      parseUnits('0.1'),
      parseUnits('0.1'),
      0,
      owner.address,
      99999999999,
    )).revertedWith('DystRouter: INSUFFICIENT_A_AMOUNT');
    await expect(router.removeLiquidity(
      mim.address,
      wmatic.address,
      true,
      parseUnits('0.1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
    )).revertedWith('DystRouter: INSUFFICIENT_B_AMOUNT');
  });

  it("removeLiquidityMATICSupportingFeeOnTransferTokens test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('1'));
    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    const pairAdr = await factory.getPair(tokenWithFee.address, wmatic.address, true);

    await DystPair__factory.connect(pairAdr, owner).approve(router.address, parseUnits('1111'));
    await router.removeLiquidityMATICSupportingFeeOnTransferTokens(
      tokenWithFee.address,
      true,
      parseUnits('0.1'),
      0,
      0,
      owner.address,
      99999999999,
    );
  });

  it("swapExactTokensForTokensSimple IOA test", async function () {
    await expect(router.swapExactTokensForTokensSimple(
      parseUnits('0.1'),
      parseUnits('0.1'),
      mim.address,
      wmatic.address,
      true,
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  });

  it("swapExactTokensForTokens IOA test", async function () {
    await expect(router.swapExactTokensForTokens(
      parseUnits('0.1'),
      parseUnits('0.1'),
      [{
        from: mim.address,
        to: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  });


  it("swapExactMATICForTokens IOA test", async function () {
    await expect(router.swapExactMATICForTokens(
      parseUnits('0.1'),
      [{
        to: mim.address,
        from: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  });

  it("swapExactMATICForTokens IP test", async function () {
    await expect(router.swapExactMATICForTokens(
      parseUnits('0.1'),
      [{
        from: mim.address,
        to: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INVALID_PATH');
  });

  it("swapExactTokensForMATIC IOA test", async function () {
    await expect(router.swapExactTokensForMATIC(
      parseUnits('0.1'),
      parseUnits('0.1'),
      [{
        from: mim.address,
        to: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  });

  it("swapExactTokensForMATIC IP test", async function () {
    await expect(router.swapExactTokensForMATIC(
      parseUnits('0.1'),
      parseUnits('0.1'),
      [{
        to: mim.address,
        from: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INVALID_PATH');
  });

  it("swapExactTokensForTokensSupportingFeeOnTransferTokens IOA test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('1'));
    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    await wmatic.approve(router.address, parseUnits('1000'));
    await expect(router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      parseUnits('0.1'),
      parseUnits('0.1'),
      [{
        to: tokenWithFee.address,
        from: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  });

  it("swapExactMATICForTokensSupportingFeeOnTransferTokens IP test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('1'));
    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    await wmatic.approve(router.address, parseUnits('1000'));
    await expect(router.swapExactMATICForTokensSupportingFeeOnTransferTokens(
      parseUnits('0.1'),
      [{
        from: tokenWithFee.address,
        to: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
      {value: parseUnits('0.1')}
    )).revertedWith('DystRouter: INVALID_PATH');
  });

  it("swapExactMATICForTokensSupportingFeeOnTransferTokens IOA test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('1'));
    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('10')}
    );

    await wmatic.approve(router.address, parseUnits('1000'));
    await expect(router.swapExactMATICForTokensSupportingFeeOnTransferTokens(
      parseUnits('0.1'),
      [{
        to: tokenWithFee.address,
        from: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
      {value: parseUnits('0.1')}
    )).revertedWith('DystRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  });

  it("swapExactTokensForMATICSupportingFeeOnTransferTokens IOA test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('100'));
    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('1')}
    );

    await wmatic.approve(router.address, parseUnits('1000'));
    await expect(router.swapExactTokensForMATICSupportingFeeOnTransferTokens(
      parseUnits('0.1'),
      parseUnits('0.1'),
      [{
        from: tokenWithFee.address,
        to: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  });

  it("swapExactTokensForMATICSupportingFeeOnTransferTokens IP test", async function () {
    await tokenWithFee.approve(router.address, parseUnits('100'));
    await router.addLiquidityMATIC(
      tokenWithFee.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('1')}
    );

    await wmatic.approve(router.address, parseUnits('1000'));
    await expect(router.swapExactTokensForMATICSupportingFeeOnTransferTokens(
      parseUnits('0.1'),
      parseUnits('0.1'),
      [{
        to: tokenWithFee.address,
        from: wmatic.address,
        stable: true
      }],
      owner.address,
      BigNumber.from('999999999999999999'),
    )).revertedWith('DystRouter: INVALID_PATH');
  });

  it("router with broken matic should revert", async function () {
    const brokenMatic = await Deploy.deployContract(owner, 'BrokenWMATIC', 'WMATIC', 'WMATIC', 18, owner.address)
    const routerWithBrokenMatic = await Deploy.deployDystRouter01(owner, factory.address, brokenMatic.address);

    await mim.approve(routerWithBrokenMatic.address, parseUnits('10'));

    await routerWithBrokenMatic.addLiquidityMATIC(
      mim.address,
      true,
      parseUnits('1'),
      0,
      parseUnits('1'),
      owner.address,
      99999999999,
      {value: parseUnits('1')}
    );

    await mim.approve(routerWithBrokenMatic.address, parseUnits('1000'));
    await expect(routerWithBrokenMatic.swapExactTokensForMATIC(
      parseUnits('0.01'),
      0,
      [{
        to: brokenMatic.address,
        from: mim.address,
        stable: true,
      }],
      owner.address,
      99999999999
    )).revertedWith('DystRouter: ETH_TRANSFER_FAILED');
  });

});
