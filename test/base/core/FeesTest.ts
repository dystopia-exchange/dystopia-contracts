import {BaseV1Factory, BaseV1Fees, Token} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {TimeUtils} from "../../TimeUtils";
import {Misc} from "../../../scripts/Misc";

const {expect} = chai;

describe("fees tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let fees: BaseV1Fees;
  let wmatic: Token;
  let usdc: Token;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    usdc = await Deploy.deployContract(owner, 'Token', 'USDC', 'USDC', 18, owner.address) as Token;
    fees = await Deploy.deployContract(owner, 'BaseV1Fees', wmatic.address, usdc.address) as BaseV1Fees;
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

  it("only pair allowed test", async function () {
    await expect(fees.connect(owner2).claimFeesFor(owner.address, 0, 0)).revertedWith('Not pair')
  });

});
