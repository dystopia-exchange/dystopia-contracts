/* tslint:disable:variable-name no-shadowed-variable ban-types no-var-requires no-any */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { network } from "hardhat";
import { Dyst, DystMinter, Token, Ve, VeDist } from "../../typechain";
import {Deploy} from "../../scripts/deploy/Deploy";

const { expect } = require("chai");
const { ethers } = require("hardhat");

// function getCreate2Address(
//   factoryAddress,
//   [tokenA, tokenB],
//   bytecode
// ) {
//   const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
//   const create2Inputs = [
//     '0xff',
//     factoryAddress,
//     keccak256(solidityPack(['address', 'address'], [token0, token1])),
//     keccak256(bytecode)
//   ]
//   const sanitizedInputs = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
//   return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
// }

describe("minter", function () {

  let token;
  let ve_underlying:Dyst;
  let ve:Ve;
  let owner:SignerWithAddress;
  let minter:DystMinter;
  let ve_dist:VeDist;

  it("deploy base", async function () {
    [owner] = await ethers.getSigners(0);
    console.log(owner,ethers.getSigners(1))
    token = await ethers.getContractFactory("Token");
    const Dyst = await ethers.getContractFactory("Dyst");
    const mim = await token.deploy('MIM', 'MIM', 18, owner.address);
    await mim.mint(owner.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    ve_underlying = await Dyst.deploy();
    const vecontract = await ethers.getContractFactory("Ve");
    ve = await vecontract.deploy(ve_underlying.address);
    await ve_underlying.mint(owner.address, ethers.BigNumber.from("10000000000000000000000000"));
    const treasury = await Deploy.deployGovernanceTreasury(owner);
    const DystFactory = await ethers.getContractFactory("DystFactory");
    const factory = await DystFactory.deploy(treasury.address);
    await factory.deployed();
    const DystRouter01 = await ethers.getContractFactory("DystRouter01");
    const router = await DystRouter01.deploy(factory.address, owner.address);
    await router.deployed();
    const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
    const gauges_factory = await GaugeFactory.deploy();
    await gauges_factory.deployed();
    const BribeFactory = await ethers.getContractFactory("BribeFactory");
    const bribe_factory = await BribeFactory.deploy();
    await bribe_factory.deployed();
    const DystVoter = await ethers.getContractFactory("DystVoter");
    const gauge_factory = await DystVoter.deploy(ve.address, factory.address, gauges_factory.address, bribe_factory.address);
    await gauge_factory.deployed();

    await gauge_factory.initialize([mim.address, ve_underlying.address],owner.address);
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("1000000000000000000"));
    await ve.createLock(ethers.BigNumber.from("1000000000000000000"), 4 * 365 * 86400);
    const VeDist = await ethers.getContractFactory("VeDist");
    ve_dist = await VeDist.deploy(ve.address);
    await ve_dist.deployed();
    await ve.setVoter(gauge_factory.address);

    const Minter = await ethers.getContractFactory("DystMinter");
    minter = await Minter.deploy(gauge_factory.address, ve.address, ve_dist.address);
    await minter.deployed();
    await ve_dist.setDepositor(minter.address);
    await ve_underlying.setMinter(minter.address);

    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const ve_underlying_1 = ethers.BigNumber.from("1000000000000000000");
    await ve_underlying.approve(router.address, ve_underlying_1);
    await mim.approve(router.address, mim_1);
    await router.addLiquidity(mim.address, ve_underlying.address, false, mim_1, ve_underlying_1, 0, 0, owner.address, Date.now());

    const pair = await router.pairFor(mim.address, ve_underlying.address, false);

    await ve_underlying.approve(gauge_factory.address, ethers.BigNumber.from("500000000000000000000000"));
    await gauge_factory.createGauge(pair);
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("1000000000000000000"));

    await gauge_factory.vote(1, [pair], [5000]);
  });

  it("initialize veNFT", async function () {
    await minter.initialize([owner.address],[ethers.BigNumber.from("1000000000000000000000000")], ethers.BigNumber.from("1000000000000000000000000"))
    expect(await ve.ownerOf(2)).to.equal(owner.address);
    expect(await ve.ownerOf(3)).to.equal("0x0000000000000000000000000000000000000000");
    await network.provider.send("evm_mine")
    expect(await ve_underlying.balanceOf(minter.address)).to.equal(ethers.BigNumber.from("0"));
  });

  it("minter weekly distribute", async function () {
    await minter.updatePeriod();
    expect(await minter.weekly()).to.equal(ethers.BigNumber.from("5000000000000000000000000"));
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.updatePeriod();
    expect(await ve_dist.claimable(1)).to.equal(0);
    expect(await minter.weekly()).to.equal(ethers.BigNumber.from("5000000000000000000000000"));
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.updatePeriod();
    const claimable = await ve_dist.claimable(1);
    console.log(claimable)
    expect(claimable).to.be.above(ethers.BigNumber.from("140075078022969338"));
    const before = await ve.balanceOfNFT(1);
    await ve_dist.claim(1);
    const after = await ve.balanceOfNFT(1);
    console.log(before,after)
    expect(await ve_dist.claimable(1)).to.equal(0);

    const weekly = await minter.weekly();
    console.log(weekly);
    console.log(await minter.calculateGrowth(weekly));
    console.log(await ve_underlying.totalSupply());
    console.log(await ve.totalSupply());

    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.updatePeriod();
    console.log(await ve_dist.claimable(1));
    await ve_dist.claim(1);
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.updatePeriod();
    console.log(await ve_dist.claimable(1));
    await ve_dist.claim_many([1]);
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.updatePeriod();
    console.log(await ve_dist.claimable(1));
    await ve_dist.claim(1);
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.updatePeriod();
    console.log(await ve_dist.claimable(1));
    await ve_dist.claim_many([1]);
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.updatePeriod();
    console.log(await ve_dist.claimable(1));
    await ve_dist.claim(1);
  });

});
