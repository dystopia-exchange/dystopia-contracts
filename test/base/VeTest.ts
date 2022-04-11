import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../scripts/deploy/Deploy";
import {TimeUtils} from "../TimeUtils";
import {MaticTestnetAddresses} from "../../scripts/addresses/MaticTestnetAddresses";
import {utils} from "ethers";
import {CoreAddresses} from "../../scripts/deploy/CoreAddresses";
import {Misc} from "../../scripts/Misc";

const {expect} = chai;

describe("ve tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let core: CoreAddresses;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2] = await ethers.getSigners();
    core = await Deploy.deployCore(
      owner,
      MaticTestnetAddresses.WMATIC_TOKEN,
      [MaticTestnetAddresses.WMATIC_TOKEN],
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

  it("supportsInterface test", async function () {
    expect(await core.ve.supportsInterface('0x00000000')).is.eq(false);
  });

  it("get_last_user_slope test", async function () {
    expect(await core.ve.get_last_user_slope(0)).is.eq(0);
  });

  it("user_point_history__ts test", async function () {
    expect(await core.ve.user_point_history__ts(0, 0)).is.eq(0);
  });

  it("locked__end test", async function () {
    expect(await core.ve.locked__end(0)).is.eq(0);
  });

  it("balanceOf test", async function () {
    expect(await core.ve.balanceOf(owner.address)).is.eq(1);
  });

  it("getApproved test", async function () {
    expect(await core.ve.getApproved(owner.address)).is.eq(Misc.ZERO_ADDRESS);
  });

  it("isApprovedForAll test", async function () {
    expect(await core.ve.isApprovedForAll(owner.address, owner.address)).is.eq(false);
  });

  it("tokenOfOwnerByIndex test", async function () {
    expect(await core.ve.tokenOfOwnerByIndex(owner.address, 0)).is.eq(1);
  });

  it("safeTransferFrom test", async function () {
    await core.ve["safeTransferFrom(address,address,uint256)"](owner.address, owner.address, 1);
  });

  it("safeTransferFrom to wrong contract test", async function () {
    await expect(core.ve["safeTransferFrom(address,address,uint256)"](owner.address, core.token.address, 1))
      .revertedWith('ERC721: transfer to non ERC721Receiver implementer');
  });

  it("setApprovalForAll test", async function () {
    await core.ve.setApprovalForAll(owner2.address, true);
  });

  it("increase_unlock_time test", async function () {
    await core.ve.increase_unlock_time(1, 60 * 60 * 24 * 365 * 4);
    await expect(core.ve.increase_unlock_time(1, 60 * 60 * 24 * 365 * 5)).revertedWith('Voting lock can be 4 years max');
  });

  it("tokenURI test", async function () {
    await core.ve.tokenURI(1);
  });

  it("balanceOfNFTAt test", async function () {
    await core.ve.balanceOfNFTAt(1, 0);
  });


});
