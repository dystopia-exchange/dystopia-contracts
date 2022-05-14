/* tslint:disable:variable-name no-shadowed-variable ban-types no-var-requires no-any */
import {
  Bribe, Controller,
  Dyst,
  DystFactory,
  DystMinter,
  DystPair,
  DystRouter01,
  Gauge,
  GaugeFactory,
  GovernanceTreasury__factory,
  StakingRewards,
  Token,
  Ve,
  VeDist
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {network} from "hardhat";
import {Deploy} from "../../scripts/deploy/Deploy";

const {expect} = require("chai");
const {ethers} = require("hardhat");

describe("base old tests", function () {

  let token;
  let token0: String;
  let token1: String;
  let ust: Token;
  let mim: Token;
  let dai: Token;
  let ve_underlying: Dyst;
  let late_reward: Token;
  let ve: Ve;
  let factory: DystFactory;
  let router: DystRouter01;
  let pair: DystPair;
  let pair2: DystPair;
  let pair3: DystPair;
  let owner: SignerWithAddress;
  let voter: any;
  let gauge: Gauge;
  let gauge2: Gauge;
  let gauge3: Gauge;
  let bribe: Bribe;
  let bribe2: Bribe;
  let bribe3: Bribe;
  let minter: DystMinter;
  let ve_dist: VeDist;
  let staking: StakingRewards;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let vecontract;
  let controller: Controller;
  let gauges_factory;
  let bribeToken1Adr: string;

  it("deploy base coins", async function () {
    [owner, owner2, owner3] = await ethers.getSigners(3);
    token = await ethers.getContractFactory("Token");
    ust = await token.deploy('ust', 'ust', 6, owner.address);
    await ust.mint(owner.address, ethers.BigNumber.from("1000000000000000000"));
    await ust.mint(owner2.address, ethers.BigNumber.from("1000000000000000000"));
    await ust.mint(owner3.address, ethers.BigNumber.from("1000000000000000000"));
    mim = await token.deploy('MIM', 'MIM', 18, owner.address);
    await mim.mint(owner.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    await mim.mint(owner2.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    await mim.mint(owner3.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    dai = await token.deploy('DAI', 'DAI', 18, owner.address);
    await dai.mint(owner.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    await dai.mint(owner2.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    await dai.mint(owner3.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    ve_underlying = await token.deploy('VE', 'VE', 18, owner.address);
    await ve_underlying.mint(owner.address, ethers.BigNumber.from("20000000000000000000000000"));
    await ve_underlying.mint(owner2.address, ethers.BigNumber.from("10000000000000000000000000"));
    await ve_underlying.mint(owner3.address, ethers.BigNumber.from("10000000000000000000000000"));
    late_reward = await token.deploy('LR', 'LR', 18, owner.address);
    await late_reward.mint(owner.address, ethers.BigNumber.from("20000000000000000000000000"));
    vecontract = await ethers.getContractFactory("Ve");
    const controllerContract = await ethers.getContractFactory("Controller");
    controller = await controllerContract.deploy();
    ve = await vecontract.deploy(ve_underlying.address, controller.address);

    await ust.deployed();
    await mim.deployed();
  });

  it("create lock", async function () {
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("500000000000000000"));
    await ve.createLock(ethers.BigNumber.from("500000000000000000"), 4 * 365 * 86400);
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("495063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("500000000000000000"));
  });

  it("increase lock", async function () {
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("500000000000000000"));
    await ve.increaseAmount(1, ethers.BigNumber.from("500000000000000000"));
    await expect(ve.increaseUnlockTime(1, 4 * 365 * 86400)).to.be.reverted;
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("1000000000000000000"));
  });

  it("ve views", async function () {
    const block = await ve.block_number();
    expect(await ve.balanceOfAtNFT(1, block)).to.equal(await ve.balanceOfNFT(1));
    expect(await ve.totalSupplyAt(block)).to.equal(await ve.totalSupply());

    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("1000000000000000000"));
  });


  it("steal NFT", async function () {
    await expect(ve.connect(owner2).transferFrom(owner.address, owner2.address, 1)).to.be.reverted
    await expect(ve.connect(owner2).approve(owner2.address, 1)).to.be.reverted
    await expect(ve.connect(owner2).merge(1, 2)).to.be.reverted
  });


  it("ve merge", async function () {
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("1000000000000000000"));
    await ve.createLock(ethers.BigNumber.from("1000000000000000000"), 4 * 365 * 86400);
    expect(await ve.balanceOfNFT(2)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("2000000000000000000"));
    console.log(await ve.totalSupply());
    await ve.merge(2, 1);
    console.log(await ve.totalSupply());
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("1990063075414519385"));
    expect(await ve.balanceOfNFT(2)).to.equal(ethers.BigNumber.from("0"));
    expect((await ve.locked(2)).amount).to.equal(ethers.BigNumber.from("0"));
    expect(await ve.ownerOf(2)).to.equal('0x0000000000000000000000000000000000000000');
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("1000000000000000000"));
    await ve.createLock(ethers.BigNumber.from("1000000000000000000"), 4 * 365 * 86400);
    expect(await ve.balanceOfNFT(3)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("3000000000000000000"));
    console.log(await ve.totalSupply());
    await ve.merge(3, 1);
    console.log(await ve.totalSupply());
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("1990063075414519385"));
    expect(await ve.balanceOfNFT(3)).to.equal(ethers.BigNumber.from("0"));
    expect((await ve.locked(3)).amount).to.equal(ethers.BigNumber.from("0"));
    expect(await ve.ownerOf(3)).to.equal('0x0000000000000000000000000000000000000000');
  });

  it("confirm ust deployment", async function () {
    expect(await ust.name()).to.equal("ust");
  });

  it("confirm mim deployment", async function () {
    expect(await mim.name()).to.equal("MIM");
  });

  it("deploy DystFactory and test pair length", async function () {
    const treasury = await Deploy.deployGovernanceTreasury(owner);
    const DystFactory = await ethers.getContractFactory("DystFactory");
    factory = await DystFactory.deploy(treasury.address);
    await factory.deployed();

    expect(await factory.allPairsLength()).to.equal(0);
  });

  it("deploy DystRouter01 and test factory address", async function () {
    const DystRouter01 = await ethers.getContractFactory("DystRouter01");
    router = await DystRouter01.deploy(factory.address, owner.address);
    await router.deployed();

    expect(await router.factory()).to.equal(factory.address);
  });

  it("deploy pair via DystFactory owner", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const dai_1 = ethers.BigNumber.from("1000000000000000000");
    await mim.approve(router.address, mim_1);
    await ust.approve(router.address, ust_1);
    await router.addLiquidity(mim.address, ust.address, true, mim_1, ust_1, 0, 0, owner.address, Date.now());
    await mim.approve(router.address, mim_1);
    await ust.approve(router.address, ust_1);
    await router.addLiquidity(mim.address, ust.address, false, mim_1, ust_1, 0, 0, owner.address, Date.now());
    await mim.approve(router.address, mim_1);
    await dai.approve(router.address, dai_1);
    await router.addLiquidity(mim.address, dai.address, true, mim_1, dai_1, 0, 0, owner.address, Date.now());
    expect(await factory.allPairsLength()).to.equal(3);
  });

  it("deploy pair via DystFactory owner2", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const dai_1 = ethers.BigNumber.from("1000000000000000000");
    await mim.connect(owner2).approve(router.address, mim_1);
    await ust.connect(owner2).approve(router.address, ust_1);
    await router.connect(owner2).addLiquidity(mim.address, ust.address, true, mim_1, ust_1, 0, 0, owner.address, Date.now());
    await mim.connect(owner2).approve(router.address, mim_1);
    await ust.connect(owner2).approve(router.address, ust_1);
    await router.connect(owner2).addLiquidity(mim.address, ust.address, false, mim_1, ust_1, 0, 0, owner.address, Date.now());
    await mim.connect(owner2).approve(router.address, mim_1);
    await dai.connect(owner2).approve(router.address, dai_1);
    await router.connect(owner2).addLiquidity(mim.address, dai.address, true, mim_1, dai_1, 0, 0, owner.address, Date.now());
    expect(await factory.allPairsLength()).to.equal(3);
  });

  it("confirm pair for mim-ust", async function () {
    const create2address = await router.pairFor(mim.address, ust.address, true);
    const DystPair = await ethers.getContractFactory("DystPair");
    const address = await factory.getPair(mim.address, ust.address, true);
    const allpairs0 = await factory.allPairs(0);
    pair = await DystPair.attach(address);
    const address2 = await factory.getPair(mim.address, ust.address, false);
    pair2 = await DystPair.attach(address2);
    const address3 = await factory.getPair(mim.address, dai.address, true);
    pair3 = await DystPair.attach(address3);

    expect(pair.address).to.equal(create2address);
  });

  it("confirm tokens for mim-ust", async function () {
    [token0, token1] = await router.sortTokens(ust.address, mim.address);
    expect((await pair.token0()).toUpperCase()).to.equal(token0.toUpperCase());
    expect((await pair.token1()).toUpperCase()).to.equal(token1.toUpperCase());
  });

  it("mint & burn tokens for pair mim-ust", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const before_balance = await ust.balanceOf(owner.address);
    await ust.transfer(pair.address, ust_1);
    await mim.transfer(pair.address, mim_1);
    await pair.mint(owner.address);
    expect(await pair.getAmountOut(ust_1, ust.address)).to.equal(ethers.BigNumber.from("981745351048687212"));
    const output = await router.getAmountOut(ust_1, ust.address, mim.address);
    expect(await pair.getAmountOut(ust_1, ust.address)).to.equal(output.amount);
    expect(output.stable).to.equal(true);
    expect(await router.isPair(pair.address)).to.equal(true);
  });

  it("mint & burn tokens for pair mim-ust owner2", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const before_balance = await ust.balanceOf(owner.address);
    await ust.connect(owner2).transfer(pair.address, ust_1);
    await mim.connect(owner2).transfer(pair.address, mim_1);
    await pair.connect(owner2).mint(owner2.address);
    expect(await pair.connect(owner2).getAmountOut(ust_1, ust.address)).to.equal(ethers.BigNumber.from("991833071663219513"));
  });

  it("DystRouter01 addLiquidity", async function () {
    const ust_1000 = ethers.BigNumber.from("100000000000");
    const mim_1000 = ethers.BigNumber.from("100000000000000000000000");
    const mim_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const dai_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const expected_2000 = ethers.BigNumber.from("2000000000000");
    await ust.approve(router.address, ust_1000);
    await mim.approve(router.address, mim_1000);
    const expected = await router.quoteAddLiquidity(mim.address, ust.address, true, mim_1000, ust_1000);
    await router.addLiquidity(mim.address, ust.address, true, mim_1000, ust_1000, expected.amountA, expected.amountB, owner.address, Date.now());
    await ust.approve(router.address, ust_1000);
    await mim.approve(router.address, mim_1000);
    await router.addLiquidity(mim.address, ust.address, false, mim_1000, ust_1000, mim_1000, ust_1000, owner.address, Date.now());
    await dai.approve(router.address, dai_100000000);
    await mim.approve(router.address, mim_100000000);
    await router.addLiquidity(mim.address, dai.address, true, mim_100000000, dai_100000000, 0, 0, owner.address, Date.now());
  });

  it("DystRouter01 removeLiquidity", async function () {
    const ust_1000 = ethers.BigNumber.from("100000000000");
    const mim_1000 = ethers.BigNumber.from("100000000000000000000000");
    const mim_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const dai_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const expected_2000 = ethers.BigNumber.from("2000000000000");
    await ust.approve(router.address, ust_1000);
    await mim.approve(router.address, mim_1000);
    const expected = await router.quoteAddLiquidity(mim.address, ust.address, true, mim_1000, ust_1000);
    const output = await router.quoteRemoveLiquidity(mim.address, ust.address, true, ust_1000);
  });

  it("DystRouter01 addLiquidity owner2", async function () {
    const ust_1000 = ethers.BigNumber.from("100000000000");
    const mim_1000 = ethers.BigNumber.from("100000000000000000000000");
    const mim_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const dai_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const expected_2000 = ethers.BigNumber.from("2000000000000");
    await ust.connect(owner2).approve(router.address, ust_1000);
    await mim.connect(owner2).approve(router.address, mim_1000);
    await router.connect(owner2).addLiquidity(mim.address, ust.address, true, mim_1000, ust_1000, mim_1000, ust_1000, owner.address, Date.now());
    await ust.connect(owner2).approve(router.address, ust_1000);
    await mim.connect(owner2).approve(router.address, mim_1000);
    await router.connect(owner2).addLiquidity(mim.address, ust.address, false, mim_1000, ust_1000, mim_1000, ust_1000, owner.address, Date.now());
    await dai.connect(owner2).approve(router.address, dai_100000000);
    await mim.connect(owner2).approve(router.address, mim_100000000);
    await router.connect(owner2).addLiquidity(mim.address, dai.address, true, mim_100000000, dai_100000000, 0, 0, owner.address, Date.now());
  });

  it("DystRouter01 pair1 getAmountsOut & swapExactTokensForTokens", async function () {
    const treasury = await factory.treasury();
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from: ust.address, to: mim.address, stable: true}

    expect((await router.getAmountsOut(ust_1, [route]))[1]).to.be.equal(await pair.getAmountOut(ust_1, ust.address));

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.approve(router.address, ust_1);
    await router.swapExactTokensForTokens(ust_1, expected_output[1], [route], owner.address, Date.now());
    const fees = await pair.fees()
    expect(await ust.balanceOf(fees)).to.be.equal(250);
    expect(await ust.balanceOf(treasury)).to.be.equal(250);
    const b = await ust.balanceOf(owner.address);
    await pair.claimFees();
    expect(await ust.balanceOf(owner.address)).to.be.above(b);
    const b2 = await ust.balanceOf(owner.address);
    await GovernanceTreasury__factory.connect(treasury, owner).claim([ust.address]);
    expect(await ust.balanceOf(owner.address)).to.be.above(b2);
  });

  it("DystRouter01 pair1 getAmountsOut & swapExactTokensForTokens owner2", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from: ust.address, to: mim.address, stable: true}

    expect((await router.getAmountsOut(ust_1, [route]))[1]).to.be.equal(await pair.getAmountOut(ust_1, ust.address));

    const before = await mim.balanceOf(owner2.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.connect(owner2).approve(router.address, ust_1);
    await router.connect(owner2).swapExactTokensForTokens(ust_1, expected_output[1], [route], owner2.address, Date.now());
    const fees = await pair.fees()
    expect(await ust.balanceOf(fees)).to.be.equal(251);
    const b = await ust.balanceOf(owner.address);
    await pair.connect(owner2).claimFees();
    expect(await ust.balanceOf(owner.address)).to.be.equal(b);
  });

  it("DystRouter01 pair2 getAmountsOut & swapExactTokensForTokens", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from: ust.address, to: mim.address, stable: false}

    expect((await router.getAmountsOut(ust_1, [route]))[1]).to.be.equal(await pair2.getAmountOut(ust_1, ust.address));

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.approve(router.address, ust_1);
    await router.swapExactTokensForTokens(ust_1, expected_output[1], [route], owner.address, Date.now());
  });

  it("DystRouter01 pair3 getAmountsOut & swapExactTokensForTokens", async function () {
    const mim_1000000 = ethers.BigNumber.from("1000000000000000000000000");
    const route = {from: mim.address, to: dai.address, stable: true}

    expect((await router.getAmountsOut(mim_1000000, [route]))[1]).to.be.equal(await pair3.getAmountOut(mim_1000000, mim.address));

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair3.getAmountOut(mim_1000000, mim.address);
    const expected_output = await router.getAmountsOut(mim_1000000, [route]);
    await mim.approve(router.address, mim_1000000);
    await router.swapExactTokensForTokens(mim_1000000, expected_output[1], [route], owner.address, Date.now());
  });

  it("deploy DystVoter", async function () {
    const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
    gauges_factory = await GaugeFactory.deploy();
    await gauges_factory.deployed();
    const BribeFactory = await ethers.getContractFactory("BribeFactory");
    const bribe_factory = await BribeFactory.deploy();
    await bribe_factory.deployed();
    const DystVoter = await ethers.getContractFactory("DystVoter");
    voter = await DystVoter.deploy(ve.address, factory.address, gauges_factory.address, bribe_factory.address);
    await voter.deployed();

    expect(await voter.poolsLength()).to.equal(0);
  });

  it("deploy Minter", async function () {
    const VeDist = await ethers.getContractFactory("VeDist");
    ve_dist = await VeDist.deploy(ve.address);
    await ve_dist.deployed();

    const Minter = await ethers.getContractFactory("DystMinter");
    minter = await Minter.deploy(ve.address, controller.address, 2);
    await minter.deployed();
    await ve_dist.setDepositor(minter.address);
    await controller.setVoter(voter.address);
    await controller.setVeDist(ve_dist.address);
    await voter.initialize([ust.address, mim.address, dai.address, ve_underlying.address], minter.address);
  });

  it("deploy DystFactory gauge", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");

    await ve_underlying.approve(voter.address, ethers.BigNumber.from("1500000000000000000000000"));
    await voter.createGauge(pair.address);
    await voter.createGauge(pair2.address);
    await voter.createGauge(pair3.address);
    expect(await voter.gauges(pair.address)).to.not.equal(0x0000000000000000000000000000000000000000);

    const sr = await ethers.getContractFactory("StakingRewards");
    staking = await sr.deploy(pair.address, ve_underlying.address);

    const gauge_address = await voter.gauges(pair.address);
    const bribe_address = await voter.bribes(gauge_address);

    const gauge_address2 = await voter.gauges(pair2.address);
    const bribe_address2 = await voter.bribes(gauge_address2);

    const gauge_address3 = await voter.gauges(pair3.address);
    const bribe_address3 = await voter.bribes(gauge_address3);

    const Gauge = await ethers.getContractFactory("Gauge");
    gauge = await Gauge.attach(gauge_address);
    gauge2 = await Gauge.attach(gauge_address2);
    gauge3 = await Gauge.attach(gauge_address3);

    const Bribe = await ethers.getContractFactory("Bribe");
    bribe = await Bribe.attach(bribe_address);
    bribe2 = await Bribe.attach(bribe_address2);
    bribe3 = await Bribe.attach(bribe_address3);

    await pair.approve(gauge.address, pair_1000);
    await pair.approve(staking.address, pair_1000);
    await pair2.approve(gauge2.address, pair_1000);
    await pair3.approve(gauge3.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await staking.stake(pair_1000);
    await gauge2.deposit(pair_1000, 0);
    await gauge3.deposit(pair_1000, 0);
    expect(await gauge.totalSupply()).to.equal(pair_1000);
    expect(await gauge.earned(ve.address, owner.address)).to.equal(0);

    bribeToken1Adr = await bribe.tokenIdToAddress(1);
  });

  it("veNFT gauge manipulate", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    expect(await gauge.tokenIds(owner.address)).to.equal(0);
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    expect(await gauge.tokenIds(owner.address)).to.equal(1);
    await pair.approve(gauge.address, pair_1000);
    await expect(gauge.deposit(pair_1000, 2)).to.be.reverted;
    expect(await gauge.tokenIds(owner.address)).to.equal(1);
    await expect(gauge.withdrawToken(0, 2)).to.be.reverted;
    expect(await gauge.tokenIds(owner.address)).to.equal(1);
    await gauge.withdrawToken(0, 1);
    expect(await gauge.tokenIds(owner.address)).to.equal(0);
  });


  it("deploy DystFactory gauge owner2", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    const pair_3000 = ethers.BigNumber.from("3000000000");

    await pair.connect(owner2).approve(gauge.address, pair_1000);
    await pair.connect(owner2).approve(staking.address, pair_1000);
    await gauge.connect(owner2).deposit(pair_1000, 0);
    await staking.connect(owner2).stake(pair_1000);
    expect(await gauge.totalSupply()).to.equal(pair_3000);
    expect(await gauge.earned(ve.address, owner2.address)).to.equal(0);
  });

  it("withdraw gauge stake", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await gauge.connect(owner2).withdraw(await gauge.balanceOf(owner2.address));
    await staking.withdraw(await staking._balances(owner.address));
    await staking.connect(owner2).withdraw(await staking._balances(owner2.address));
    await gauge2.withdraw(await gauge2.balanceOf(owner.address));
    await gauge3.withdraw(await gauge3.balanceOf(owner.address));
    expect(await gauge.totalSupply()).to.equal(0);
    expect(await gauge2.totalSupply()).to.equal(0);
    expect(await gauge3.totalSupply()).to.equal(0);
  });

  it("add gauge & bribe rewards", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");

    await ve_underlying.approve(gauge.address, pair_1000);
    await ve_underlying.approve(bribe.address, pair_1000);
    await ve_underlying.approve(staking.address, pair_1000);

    await gauge.notifyRewardAmount(ve_underlying.address, pair_1000);
    await bribe.notifyRewardAmount(ve_underlying.address, pair_1000);
    await staking.notifyRewardAmount(pair_1000);

    expect(await gauge.rewardRate(ve_underlying.address)).to.equal(ethers.BigNumber.from('1653439153439153439153'));
    expect(await bribe.rewardRate(ve_underlying.address)).to.equal(ethers.BigNumber.from('1653439153439153439153'));
    expect(await staking.rewardRate()).to.equal(ethers.BigNumber.from(1653));
  });

  it("exit & getReward gauge stake", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    const supply = await pair.balanceOf(owner.address);
    await pair.approve(gauge.address, supply);
    await gauge.deposit(supply, 1);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    expect(await gauge.totalSupply()).to.equal(0);
    await pair.approve(gauge.address, supply);
    await gauge.deposit(pair_1000, 1);
    await pair.approve(staking.address, supply);
    await staking.stake(pair_1000);
  });

  it("gauge reset", async function () {
    await voter.reset(1);
  });

  it("gauge poke self", async function () {
    await voter.poke(1);
  });

  it("create lock 2", async function () {
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("1000000000000000000"));
    await ve.createLock(ethers.BigNumber.from("1000000000000000000"), 4 * 365 * 86400);
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("4000000000000000000"));
  });

  it("vote hacking", async function () {
    await voter.vote(1, [pair.address], [5000]);
    expect(await voter.usedWeights(1)).to.closeTo((await ve.balanceOfNFT(1)), 1000);
    expect(await bribe.balanceOf(bribeToken1Adr)).to.equal(await voter.votes(1, pair.address));
    await voter.reset(1);
    expect(await voter.usedWeights(1)).to.below(await ve.balanceOfNFT(1));
    expect(await voter.usedWeights(1)).to.equal(0);
    expect(await bribe.balanceOf(bribeToken1Adr)).to.equal(await voter.votes(1, pair.address));
    expect(await bribe.balanceOf(bribeToken1Adr)).to.equal(0);
  });

  it("gauge poke hacking", async function () {
    expect(await voter.usedWeights(1)).to.equal(0);
    expect(await voter.votes(1, pair.address)).to.equal(0);
    await voter.poke(1);
    expect(await voter.usedWeights(1)).to.equal(0);
    expect(await voter.votes(1, pair.address)).to.equal(0);
  });

  it("gauge vote & bribe balanceOf", async function () {
    await voter.vote(1, [pair.address, pair2.address], [5000, 5000]);
    await voter.vote(4, [pair.address, pair2.address], [500000, 500000]);
    console.log(await voter.usedWeights(1));
    console.log(await voter.usedWeights(4));
    expect(await voter.totalWeight()).to.not.equal(0);
    expect(await bribe.balanceOf(bribeToken1Adr)).to.not.equal(0);
  });

  it("gauge poke hacking", async function () {
    const weight_before = (await voter.usedWeights(1));
    const votes_before = (await voter.votes(1, pair.address));
    await voter.poke(1);
    expect(await voter.usedWeights(1)).to.be.below(weight_before);
    expect(await voter.votes(1, pair.address)).to.be.below(votes_before);
  });

  it("vote hacking break mint", async function () {
    await voter.vote(1, [pair.address], [5000]);

    expect(await voter.usedWeights(1)).to.closeTo((await ve.balanceOfNFT(1)), 1000);
    expect(await bribe.balanceOf(bribeToken1Adr)).to.equal(await voter.votes(1, pair.address));
  });

  it("gauge poke hacking", async function () {
    expect(await voter.usedWeights(1)).to.equal(await voter.votes(1, pair.address));
    await voter.poke(1);
    expect(await voter.usedWeights(1)).to.equal(await voter.votes(1, pair.address));
  });

  it("gauge distribute based on voting", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await ve_underlying.approve(voter.address, pair_1000);
    await voter.notifyRewardAmount(pair_1000);
    await voter.updateAll();
    await voter.distributeAll();
  });

  it("bribe claim rewards", async function () {
    await bribe.getReward(1, [ve_underlying.address]);
    await network.provider.send("evm_increaseTime", [691200])
    await network.provider.send("evm_mine")
    await bribe.getReward(1, [ve_underlying.address]);
  });

  it("DystRouter01 pair1 getAmountsOut & swapExactTokensForTokens", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from: ust.address, to: mim.address, stable: true}

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.approve(router.address, ust_1);
    await router.swapExactTokensForTokens(ust_1, expected_output[1], [route], owner.address, Date.now());
    const fees = await pair.fees()
  });

  it("DystRouter01 pair2 getAmountsOut & swapExactTokensForTokens", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from: ust.address, to: mim.address, stable: false}

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.approve(router.address, ust_1);
    await router.swapExactTokensForTokens(ust_1, expected_output[1], [route], owner.address, Date.now());
    const fees = await pair2.fees()
  });

  it("DystRouter01 pair1 getAmountsOut & swapExactTokensForTokens", async function () {
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const route = {from: mim.address, to: ust.address, stable: true}

    const before = await ust.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(mim_1, mim.address);
    const expected_output = await router.getAmountsOut(mim_1, [route]);
    await mim.approve(router.address, mim_1);
    await router.swapExactTokensForTokens(mim_1, expected_output[1], [route], owner.address, Date.now());
    const fees = await pair.fees()
  });

  it("DystRouter01 pair2 getAmountsOut & swapExactTokensForTokens", async function () {
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const route = {from: mim.address, to: ust.address, stable: false}

    const before = await ust.balanceOf(owner.address);
    const expected_output = await router.getAmountsOut(mim_1, [route]);
    await mim.approve(router.address, mim_1);
    await router.swapExactTokensForTokens(mim_1, expected_output[1], [route], owner.address, Date.now());
  });

  it("DystRouter01 pair1>pair2 getAmountsOut & swapExactTokensForTokens", async function () {
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const route = [{from: mim.address, to: ust.address, stable: false}, {
      from: ust.address,
      to: mim.address,
      stable: true
    }]

    const before = (await mim.balanceOf(owner.address)).sub(mim_1);

    const expected_output = await router.getAmountsOut(mim_1, route);
    console.log(expected_output);
    await mim.approve(router.address, mim_1);
    await router.swapExactTokensForTokens(mim_1, expected_output[2], route, owner.address, Date.now());
    const after = await mim.balanceOf(owner.address);
    expect(after.sub(before)).to.equal(expected_output[2])
  });

  it("distribute and claim fees", async function () {

    await network.provider.send("evm_increaseTime", [691200])
    await network.provider.send("evm_mine")
    await bribe.getReward(1, [mim.address, ust.address]);

    await voter.distributeFees([gauge.address]);
  });

  it("staking rewards sense check", async function () {
    expect((await gauge.rewardRate(ve_underlying.address)).div('1000000000000000000')).to.be.equal(await staking.rewardRate());
  });

  it("minter mint", async function () {
    console.log(await ve_dist.lastTokenTime());
    console.log(await ve_dist.timestamp());
    await minter.initialize([owner.address], [ethers.BigNumber.from("1000000000000000000")], ethers.BigNumber.from("1000000000000000000"));
    await minter.updatePeriod();
    await voter.updateGauge(gauge.address);
    console.log(await ve_underlying.balanceOf(ve_dist.address));
    console.log(await ve_dist.claimable(1));
    const claimable = await voter.claimable(gauge.address);
    await ve_underlying.approve(staking.address, claimable);
    await staking.notifyRewardAmount(claimable);
    await voter.distributeAll();
    await network.provider.send("evm_increaseTime", [1800])
    await network.provider.send("evm_mine")
    expect((await gauge.rewardRate(ve_underlying.address)).div('1000000000000000000')).to.be.equal(await staking.rewardRate());
  });

  it("gauge claim rewards1", async function () {
    expect(owner.address).to.equal(await ve.ownerOf(1));
    expect(await ve.isApprovedOrOwner(owner.address, 1)).to.equal(true);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await staking.withdraw(await staking._balances(owner.address));
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await staking.getReward();
    const before = await ve_underlying.balanceOf(owner.address)
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    const earned = await gauge.earned(ve_underlying.address, owner.address);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    const after = await ve_underlying.balanceOf(owner.address)
    const received = after.sub(before);
    expect(received).to.be.below(earned)

    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await network.provider.send("evm_increaseTime", [604800])
    await network.provider.send("evm_mine")
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
  });

  it("gauge claim rewards (after expiry)", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await network.provider.send("evm_increaseTime", [604800])
    await network.provider.send("evm_mine")
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
  });

  it("ve decay", async function () {
    await voter.claimBribes([bribe.address], [[dai.address]], 1);
    await voter.claimFees([bribe.address], [[dai.address]], 1);
    const supply = await ve.totalSupply();
    expect(supply).to.be.above(0);
    await network.provider.send("evm_increaseTime", [4 * 365 * 86400])
    await network.provider.send("evm_mine")
    expect(await ve.balanceOfNFT(1)).to.be.equal(0);
    expect(await ve.totalSupply()).to.be.equal(0);
    await voter.reset(1);
    await ve.withdraw(1);
  });

  it("DystRouter01 addLiquidity owner3", async function () {
    const ust_1000 = ethers.BigNumber.from("1000000000000");
    const mim_1000 = ethers.BigNumber.from("1000000000000000000000000");
    const mim_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const dai_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const expected_2000 = ethers.BigNumber.from("2000000000000");
    await ust.connect(owner3).approve(router.address, ust_1000);
    await mim.connect(owner3).approve(router.address, mim_1000);
    await router.connect(owner3).addLiquidity(mim.address, ust.address, true, mim_1000, ust_1000, 0, 0, owner3.address, Date.now());
  });

  it("deploy DystFactory gauge owner3", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    const pair_2000 = ethers.BigNumber.from("2000000000");

    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
  });

  it("gauge claim rewards owner3", async function () {
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    const before = await ve_underlying.balanceOf(owner3.address)
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    await gauge.batchUpdateRewardPerToken(ve_underlying.address, 200);
    const earned = await gauge.earned(ve_underlying.address, owner3.address);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    const after = await ve_underlying.balanceOf(owner3.address)
    const received = after.sub(before);

    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner.address));
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
  });

  it("minter mint", async function () {
    await network.provider.send("evm_increaseTime", [86400 * 7 * 2])
    await network.provider.send("evm_mine")
    await minter.updatePeriod();
    await voter.updateGauge(gauge.address);
    const claimable = await voter.claimable(gauge.address);
    await ve_underlying.approve(staking.address, claimable);
    await staking.notifyRewardAmount(claimable);
    await voter.updateFor([gauge.address]);
    await voter.distributeAll();
    await voter.claimRewards([gauge.address], [[ve_underlying.address]]);
    expect((await gauge.rewardRate(ve_underlying.address)).div('1000000000000000000')).to.be.equal(await staking.rewardRate());
    console.log(await gauge.rewardPerTokenStored(ve_underlying.address))
  });

  it("gauge claim rewards owner3 next cycle", async function () {
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    const pair_1000 = ethers.BigNumber.from("1000000000");
    console.log(await gauge.rewardPerTokenStored(ve_underlying.address))
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    const before = await ve_underlying.balanceOf(owner3.address)
    const earned = await gauge.earned(ve_underlying.address, owner3.address);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    const after = await ve_underlying.balanceOf(owner3.address)
    const received = after.sub(before);
    expect(received).to.be.above(0)
    console.log(await gauge.rewardPerTokenStored(ve_underlying.address))

    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner.address));
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
  });

  // it("gauge claim rewards2", async function () {
  //   const pair_1000 = ethers.BigNumber.from("1000000000");
  //   await pair.approve(gauge.address, pair_1000);
  //   await gauge.deposit(pair_1000, 0);
  //   await late_reward.approve(gauge.address, await late_reward.balanceOf(owner.address));
  //   await voter.connect(owner).registerRewardToken(late_reward.address, gauge.address, 1);
  //   await gauge.notifyRewardAmount(late_reward.address, await late_reward.balanceOf(owner.address));
  //
  //   await network.provider.send("evm_increaseTime", [604800])
  //   await network.provider.send("evm_mine")
  //   const reward1 = (await gauge.earned(late_reward.address, owner.address));
  //   const reward3 = (await gauge.earned(late_reward.address, owner3.address));
  //   expect(reward1.add(reward3)).to.closeTo(ethers.BigNumber.from("20000000000000000000000000"), 100000);
  //   await gauge.getReward(owner.address, [late_reward.address]);
  //   await gauge.connect(owner2).getReward(owner2.address, [late_reward.address]);
  //   await gauge.connect(owner3).getReward(owner3.address, [late_reward.address]);
  //   await gauge.withdraw(await gauge.balanceOf(owner.address));
  // });

  it("gauge claim rewards3", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await ve_underlying.approve(gauge.address, await ve_underlying.balanceOf(owner.address));
    await gauge.notifyRewardAmount(ve_underlying.address, await ve_underlying.balanceOf(owner.address));

    await network.provider.send("evm_increaseTime", [604800])
    await network.provider.send("evm_mine")
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
  });

});
