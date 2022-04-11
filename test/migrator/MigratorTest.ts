/* tslint:disable:variable-name no-shadowed-variable ban-types no-var-requires no-any */
import {
  BaseV1Factory,
  BaseV1Pair,
  BaseV1Router01,
  Token,
  IUniswapV2Factory,
  IUniswapV2Pair,
  IUniswapV2Router02
} from "../../typechain";
import { MaticTestnetAddresses } from "../../scripts/addresses/MaticTestnetAddresses";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { network } from "hardhat";
import { Deploy } from "../../scripts/deploy/Deploy";
import { BigNumber } from "ethers";

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("core", function () {
  let ust: Token;
  let dai: Token;
  let factory: BaseV1Factory;
  let router: BaseV1Router01;
  let quickswapRouter: IUniswapV2Router02;
  let quickswapFactory: IUniswapV2Factory;
  let pair: String;
  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let balanceOfQuickPair: BigNumber;
  let pairContract: BaseV1Pair;
  let MAX_UINT = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

  it("deploy base coins", async function () {
    [owner, owner2, owner3] = await ethers.getSigners(3);

    let token = await ethers.getContractFactory("Token");

    ust = await token.deploy("ust", "ust", 6, owner.address);
    await ust.deployed();
    await ust.mint(owner.address, ethers.BigNumber.from("1000000000000000000"));

    dai = await token.deploy("DAI", "DAI", 18, owner.address);
    await dai.mint(
      owner.address,
      ethers.BigNumber.from("1000000000000000000000000000000")
    );
    await dai.deployed();
  });

  it("confirm ust deployment", async function () {
    expect(await ust.name()).to.equal("ust");
  });

  it("confirm mim deployment", async function () {
    expect(await dai.name()).to.equal("DAI");
  });

  it("deploy BaseV1Factory and test pair length", async function () {
    const BaseV1Factory = await ethers.getContractFactory("BaseV1Factory");
    factory = await BaseV1Factory.deploy(owner.address);

    expect(await factory.allPairsLength()).to.equal(0);
  });

  it("deploy BaseV1Router and test factory address", async function () {
    const BaseV1Router = await ethers.getContractFactory("BaseV1Router01");
    router = await BaseV1Router.deploy(factory.address, owner.address);
    await router.deployed();

    expect(await router.factory()).to.equal(factory.address);
  });

  it("addLiquidity pair via quickswap router owner", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const dai_1 = ethers.BigNumber.from("1000000000000000000");
    quickswapFactory = await ethers.getContractAt(
      "IUniswapV2Factory",
      MaticTestnetAddresses.QUICKSWAP_FACTORY
    );
    quickswapRouter = await ethers.getContractAt(
      "IUniswapV2Router02",
      MaticTestnetAddresses.QUICKSWAP_ROUTER
    );
    await dai.approve(quickswapRouter.address, dai_1);
    await ust.approve(quickswapRouter.address, ust_1);
    await quickswapRouter.addLiquidity(
      dai.address,
      ust.address,
      dai_1,
      ust_1,
      0,
      0,
      owner.address,
      Date.now()
    );
    pair = await quickswapFactory.getPair(
      dai.address,
      ust.address
    );
    pairContract = await ethers.getContractAt("IUniswapV2Pair", pair);
    balanceOfQuickPair = await pairContract.balanceOf(owner.address);
    console.log(balanceOfQuickPair);
    expect(balanceOfQuickPair).to.gt(0);
  });

  it("should do the migration successfully", async function () {

    const migrator = await ethers.getContractFactory("MigratorQuickSwap");
    let Migrator = await migrator.deploy(
      quickswapRouter.address,
      router.address,
      "0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f"
    );
    await Migrator.deployed();

    await pairContract.approve(Migrator.address,MAX_UINT);
    await Migrator.migrate(
      dai.address,
      ust.address,
      true,
      balanceOfQuickPair,
      0,
      0,
      Date.now()
    );
    const pairAddress = await factory.getPair(dai.address, ust.address, true);
    let basePairContract = await ethers.getContractAt(
      "BaseV1Pair",
      pairAddress
    );
    const balanceOf = await basePairContract.balanceOf(owner.address);
    balanceOfQuickPair = await pairContract.balanceOf(owner.address);

    expect(balanceOf).to.gt(0);
    expect(balanceOfQuickPair).to.equal(0);

  });
 
});
