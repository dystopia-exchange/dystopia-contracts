import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../scripts/deploy/Deploy";
import {TimeUtils} from "../TimeUtils";
import {MaticTestnetAddresses} from "../../scripts/addresses/MaticTestnetAddresses";
import {BigNumber, utils} from "ethers";
import {CoreAddresses} from "../../scripts/deploy/CoreAddresses";
import {Token} from "../../typechain";

const {expect} = chai;

describe("minter tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let core: CoreAddresses;
  let wmatic: Token;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    core = await Deploy.deployCore(
      owner,
      wmatic.address,
      [wmatic.address],
      [owner.address, owner2.address],
      [utils.parseUnits('100'), utils.parseUnits('100')],
      utils.parseUnits('200')
    );

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

  it("circulating_supply test", async function () {
    expect(await core.minter.circulating_supply()).is.not.eq(BigNumber.from('0'));
  });

  it("calculate_emission test", async function () {
    expect(await core.minter.calculate_emission()).is.eq(BigNumber.from('980000000000000000000000'));
  });

  it("weekly_emission test", async function () {
    expect(await core.minter.weekly_emission()).is.eq(BigNumber.from('980000000000000000000000'));
  });

  it("circulating_emission test", async function () {
    expect(await core.minter.circulating_emission()).is.not.eq(BigNumber.from('0'));
  });

});
