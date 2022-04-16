import {BaseV1Factory, Token} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {TimeUtils} from "../../TimeUtils";
import {Misc} from "../../../scripts/Misc";

const {expect} = chai;

describe("factory tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let factory: BaseV1Factory;
  let wmatic: Token;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    factory = await Deploy.deployBaseV1Factory(owner, owner.address);
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

  it("set pauser", async function () {
    await factory.setPauser(owner2.address);
    await factory.connect(owner2).acceptPauser();
    expect(await factory.pauser()).is.eq(owner2.address);
  });

  it("set pauser only from pauser", async function () {
    await expect(factory.connect(owner2).setPauser(owner2.address)).revertedWith("Not pauser");
  });

  it("accept pauser only from pending pauser", async function () {
    await factory.setPauser(owner2.address);
    await expect(factory.connect(owner).acceptPauser()).revertedWith("Not pending pauser");
  });

  it("pause", async function () {
    await factory.setPause(true);
    expect(await factory.isPaused()).is.eq(true);
  });

  it("pause only from pauser", async function () {
    await expect(factory.connect(owner2).setPause(true)).revertedWith("Not pauser");
  });

  it("create pair revert with the same tokens", async function () {
    await expect(factory.createPair(Misc.ZERO_ADDRESS, Misc.ZERO_ADDRESS, true)).revertedWith('IA');
  });

  it("create pair revert with the zero token", async function () {
    await expect(factory.createPair(wmatic.address, Misc.ZERO_ADDRESS, true)).revertedWith('ZA');
  });


});
