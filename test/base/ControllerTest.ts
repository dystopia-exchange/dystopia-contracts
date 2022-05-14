import {Controller} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../scripts/deploy/Deploy";
import {TimeUtils} from "../TimeUtils";

const {expect} = chai;

describe("controller tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let controller: Controller;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    controller = await Deploy.deployContract(owner, 'Controller') as Controller;
    ;
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

  it("set governance and accept test", async function () {
    await controller.setGovernance(owner2.address);
    expect(await controller.pendingGovernance()).eq(owner2.address);
    await expect(controller.acceptGovernance()).revertedWith('Not pending gov');
    await controller.connect(owner2).acceptGovernance();
    expect(await controller.governance()).eq(owner2.address);
  });

  it("setVeDist test", async function () {
    await controller.setVeDist(owner2.address);
    expect(await controller.veDist()).eq(owner2.address);
  });

  it("setVoter test", async function () {
    await controller.setVoter(owner2.address);
    expect(await controller.voter()).eq(owner2.address);
  });

  it("setVoter revert test", async function () {
    await expect(controller.connect(owner2).setVoter(owner2.address)).revertedWith('Not gov');
  });

});
