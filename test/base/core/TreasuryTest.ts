import {GovernanceTreasury, Token} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {TimeUtils} from "../../TimeUtils";

const {expect} = chai;

describe("treasury tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let treasury: GovernanceTreasury;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    treasury = await Deploy.deployGovernanceTreasury(owner);
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

  it("set owner", async function () {
    await treasury.setOwner(owner2.address);
    await treasury.connect(owner2).acceptOwner();
    expect(await treasury.owner()).is.eq(owner2.address);
  });

  it("set owner reject", async function () {
    await expect(treasury.connect(owner2).setOwner(owner2.address)).revertedWith('Not owner');
  });

  it("accept owner reject", async function () {
    await expect(treasury.connect(owner2).acceptOwner()).revertedWith('Not pending owner');
  });

  it("claim reject", async function () {
    await expect(treasury.connect(owner2).claim([])).revertedWith('Not owner');
  });

  it("claim zero reject", async function () {
    const wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    await expect(treasury.claim([wmatic.address])).revertedWith('Zero balance');
  });

});
