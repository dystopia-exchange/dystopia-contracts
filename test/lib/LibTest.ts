import {BrokenToken, ContractTestHelper, Token} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../scripts/deploy/Deploy";
import {TimeUtils} from "../TimeUtils";

const {expect} = chai;

describe("lib tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let mim: Token;
  let helper: ContractTestHelper;

  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    mim = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    helper = await Deploy.deployContract(owner, 'ContractTestHelper') as ContractTestHelper;
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


  it("mock token transfer reject without allowance for cover Address lib", async function () {
    await expect(mim.transferFrom(owner2.address, owner.address, 1)).revertedWith('Not enough allowance');
  });

  it("encode empty test", async function () {
    expect(await mim.encode64('0x')).eq('');
  });

  it("sqrt tests", async function () {
    expect(await mim.sqrt(0)).eq(0);
    expect(await mim.sqrt(1)).eq(1);
  });

  it("mock token call wrong2 for cover Address lib", async function () {
    await expect(mim.testWrongCall2()).revertedWith('');
  });

  it("mock token call wrong for cover Address lib", async function () {
    await expect(mim.testWrongCheckpoint()).revertedWith('Empty checkpoints');
  });

  it("mock token test wrong call", async function () {
    await expect(mim.testWrongCall()).revertedWith('Address: call to non-contract');
  });

  it("broken token", async function () {
    const t = await Deploy.deployContract(owner, 'BrokenToken') as BrokenToken;
    await t.testBrokenTransfer();
  });

  it("closeTo test", async function () {
    expect(await helper.closeTo(10,11, 1)).eq(true);
    expect(await helper.closeTo(10,11, 0)).eq(false);
    expect(await helper.closeTo(10,10, 0)).eq(true);
    expect(await helper.closeTo(10,11, 2)).eq(true);
    expect(await helper.closeTo(10,15, 2)).eq(false);
    expect(await helper.closeTo(11, 10, 1)).eq(true);
    expect(await helper.closeTo(11, 10, 0)).eq(false);
    expect(await helper.closeTo(10, 10, 0)).eq(true);
    expect(await helper.closeTo(11, 10, 2)).eq(true);
    expect(await helper.closeTo(15, 10, 2)).eq(false);
  });


});
