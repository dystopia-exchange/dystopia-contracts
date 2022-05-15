import {
  Bribe,
  Bribe__factory,
  ContractTestHelper,
  DystPair,
  Gauge,
  Gauge__factory,
  Token
} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {TimeUtils} from "../../TimeUtils";
import {TestHelper} from "../../TestHelper";
import {MaticTestnetAddresses} from "../../../scripts/addresses/MaticTestnetAddresses";
import {parseUnits} from "ethers/lib/utils";
import {CoreAddresses} from "../../../scripts/deploy/CoreAddresses";
import {Misc} from "../../../scripts/Misc";

const {expect} = chai;

const WEEK = 60 * 60 * 24 * 7;

describe("ve tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let core: CoreAddresses;
  let wmatic: Token;
  let ust: Token;
  let mim: Token;
  let dai: Token;
  let pair: DystPair;

  let gauge: Gauge;
  let bribe: Bribe;
  let helper: ContractTestHelper;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, owner2, owner3] = await ethers.getSigners();

    helper = await Deploy.deployContract(owner, 'ContractTestHelper') as ContractTestHelper;

    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    [ust, mim, dai] = await TestHelper.createMockTokensAndMint(owner);

    core = await Deploy.deployCore(
      owner,
      MaticTestnetAddresses.WMATIC_TOKEN,
      [MaticTestnetAddresses.WMATIC_TOKEN, ust.address, mim.address, dai.address],
      [owner.address, owner2.address],
      [parseUnits('100'), parseUnits('100')],
      parseUnits('200')
    );

    // -------------- create pairs ---------------------

    pair = await TestHelper.addLiquidity(
      core.factory,
      core.router,
      owner,
      mim.address,
      ust.address,
      parseUnits('1000'),
      parseUnits('1000', 6),
      true
    );

    // ------------- setup gauges and bribes --------------

    await core.voter.createGauge(pair.address);
    const gaugeMimUstAddress = await core.voter.gauges(pair.address);
    const bribeMimUstAddress = await core.voter.bribes(gaugeMimUstAddress);
    gauge = Gauge__factory.connect(gaugeMimUstAddress, owner);
    bribe = Bribe__factory.connect(bribeMimUstAddress, owner);
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

  it("transferFrom with attached token revert test", async function () {
    await TestHelper.depositToGauge(owner, gauge, pair, parseUnits('0.0001'), 1);
    await expect(core.ve.transferFrom(owner.address, owner2.address, 1)).revertedWith('attached')
  });

  it("transferFrom not owner revert test", async function () {
    await expect(core.ve.transferFrom(owner2.address, owner.address, 1)).revertedWith('!owner')
  });

  it("transferFrom /!owner remove/ revert test", async function () {
    await expect(core.ve.transferFrom(owner2.address, owner.address, 1)).revertedWith('!owner remove')
  });

  it("transferFrom zero dst revert test", async function () {
    await expect(core.ve.transferFrom(owner.address, Misc.ZERO_ADDRESS, 1)).revertedWith('dst is zero')
  });

  it("safeTransferFrom wrong callback revert test", async function () {
    const h = await Deploy.deployContract(owner, 'ContractTestHelper2');
    await expect(core.ve["safeTransferFrom(address,address,uint256)"](owner.address, h.address, 1)).revertedWith('stub revert')
  });

  it("transferFrom reset approves test", async function () {
    await core.ve.approve(owner2.address, 1);
    expect(await core.ve.isApprovedOrOwner(owner2.address, 1)).eq(true);
    await core.ve.transferFrom(owner.address, owner3.address, 1)
    expect(await core.ve.isApprovedOrOwner(owner2.address, 1)).eq(false);
  });

  it("approve invalid id revert test", async function () {
    await expect(core.ve.approve(owner2.address, 99)).revertedWith('invalid id')
  });

  it("approve self approve revert test", async function () {
    await expect(core.ve.approve(owner.address, 1)).revertedWith('self approve')
  });

  it("setApprovalForAll operator is sender revert test", async function () {
    await expect(core.ve.setApprovalForAll(owner.address, true)).revertedWith('operator is sender')
  });

  it("mint to zero dst revert test", async function () {
    await expect(core.ve.createLockFor(1, 60 * 60 * 24 * 365, Misc.ZERO_ADDRESS)).revertedWith('zero dst')
  });

  it("voting revert", async function () {
    await expect(core.ve.voting(1)).revertedWith('!voter')
  });

  it("abstain revert", async function () {
    await expect(core.ve.abstain(1)).revertedWith('!voter')
  });

  it("attach revert", async function () {
    await expect(core.ve.attachToken(1)).revertedWith('!voter')
  });

  it("detach revert", async function () {
    await expect(core.ve.detachToken(1)).revertedWith('!voter')
  });

  it("merge attached revert", async function () {
    await TestHelper.depositToGauge(owner, gauge, pair, parseUnits('0.0001'), 1);
    await expect(core.ve.merge(1, 2)).revertedWith('attached')
  });

  it("merge the same revert", async function () {
    await expect(core.ve.merge(1, 1)).revertedWith('the same')
  });

  it("merge !owner from revert", async function () {
    await expect(core.ve.merge(2, 1)).revertedWith('!owner from')
  });

  it("merge !owner to revert", async function () {
    await expect(core.ve.merge(1, 2)).revertedWith('!owner to')
  });

  it("deposit zero revert", async function () {
    await expect(core.ve.depositFor(1, 0)).revertedWith('zero value')
  });

  it("deposit for not locked revert", async function () {
    await expect(core.ve.depositFor(99, 1)).revertedWith('No existing lock found')
  });

  it("deposit for expired revert", async function () {
    await TestHelper.depositToGauge(owner, gauge, pair, parseUnits('0.0001'), 1);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 5);
    await expect(core.ve.depositFor(1, 1)).revertedWith('Cannot add to expired lock. Withdraw')
  });

  it("create lock zero value revert", async function () {
    await expect(core.ve.createLock(0, 1)).revertedWith('zero value')
  });

  it("create lock zero period revert", async function () {
    await expect(core.ve.createLock(1, 0)).revertedWith('Can only lock until time in the future')
  });

  it("create lock too big period revert", async function () {
    await expect(core.ve.createLock(1, 1e12)).revertedWith('Voting lock can be 4 years max')
  });

  it("increaseAmount not owner revert", async function () {
    await expect(core.ve.increaseAmount(2, 1)).revertedWith('!owner')
  });

  it("increaseAmount zero value revert", async function () {
    await expect(core.ve.increaseAmount(1, 0)).revertedWith('zero value')
  });

  it("increaseAmount not locked revert", async function () {
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 5);
    await core.ve.withdraw(1);
    await expect(core.ve.increaseAmount(1, 1)).revertedWith('No existing lock found')
  });

  it("increaseAmount expired revert", async function () {
    // await TestHelper.depositToGauge(owner, gauge, pair, parseUnits('0.0001'), 1);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 5);
    await expect(core.ve.increaseAmount(1, 1)).revertedWith('Cannot add to expired lock. Withdraw')
  });

  it("increaseUnlockTime not owner revert", async function () {
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365);
    await expect(core.ve.increaseUnlockTime(2, 60 * 60 * 24 * 365 * 4)).revertedWith('!owner')
  });

  it("increaseUnlockTime lock expired revert", async function () {
    await TestHelper.depositToGauge(owner, gauge, pair, parseUnits('0.0001'), 1);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 5);
    await expect(core.ve.increaseUnlockTime(1, 1)).revertedWith('Lock expired')
  });

  it("increaseUnlockTime not locked revert", async function () {
    // await TestHelper.depositToGauge(owner, gauge, pair, BigNumber.from(1), 1);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 5);
    await core.ve.withdraw(1);
    await expect(core.ve.increaseUnlockTime(1, 60 * 60 * 24 * 365 * 4)).revertedWith('Nothing is locked')
  });

  it("increaseUnlockTime zero extend revert", async function () {
    await TestHelper.depositToGauge(owner, gauge, pair, parseUnits('0.0001'), 1);
    await expect(core.ve.increaseUnlockTime(1, 0)).revertedWith('Can only increase lock duration')
  });

  it("increaseUnlockTime too big extend revert", async function () {
    await TestHelper.depositToGauge(owner, gauge, pair, parseUnits('0.0001'), 1);
    await expect(core.ve.increaseUnlockTime(1, 1e12)).revertedWith('Voting lock can be 4 years max')
  });

  it("withdraw not owner revert", async function () {
    await expect(core.ve.withdraw(2)).revertedWith('!owner')
  });

  it("withdraw attached revert", async function () {
    await TestHelper.depositToGauge(owner, gauge, pair, parseUnits('0.0001'), 1);
    await expect(core.ve.withdraw(1)).revertedWith('attached');
  });

  it("withdraw not expired revert", async function () {
    await expect(core.ve.withdraw(1)).revertedWith('The lock did not expire');
  });

  it("balanceOfNFT zero epoch test", async function () {
    expect(await core.ve.balanceOfNFT(99)).eq(0);
  });

  it("balanceOfNFT flash protection test", async function () {
    await core.ve.approve(helper.address, 1);
    await helper.veFlashTransfer(core.ve.address, 1);
    await core.ve.approve(helper.address, 1);
    await helper.veFlashTransfer(core.ve.address, 1);
  });

  it("tokenURI for not exist revert", async function () {
    await expect(core.ve.tokenURI(99)).revertedWith('Query for nonexistent token');
  });

  it("balanceOfNFTAt for new block revert", async function () {
    await expect(core.ve.balanceOfAtNFT(1, Date.now() * 10)).revertedWith('only old block');
  });

  it("totalSupplyAt for new block revert", async function () {
    await expect(core.ve.totalSupplyAt(Date.now() * 10)).revertedWith('only old blocks');
  });

  it("tokenUri for expired lock", async function () {
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 5);
    expect(await core.ve.tokenURI(1)).not.eq('');
  });

  it("totalSupplyAt for not exist epoch", async function () {
    expect(await core.ve.totalSupplyAt(0)).eq(0);
  });

  it("totalSupplyAt for first epoch", async function () {
    const start = (await core.ve.pointHistory(0)).blk;
    expect(await core.ve.totalSupplyAt(start)).eq(0);
    expect(await core.ve.totalSupplyAt(start.add(1))).eq(0);
  });

  it("totalSupplyAt for second epoch", async function () {
    const start = (await core.ve.pointHistory(1)).blk;
    expect(await core.ve.totalSupplyAt(start)).not.eq(0);
    expect(await core.ve.totalSupplyAt(start.add(1))).not.eq(0);
  });

  it("checkpoint for a long period", async function () {
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 3);
    await core.ve.checkpoint();
  });

  it("balanceOfNFTAt loop test", async function () {
    const cp0 = (await core.ve.userPointHistory(2, 0));
    await core.ve.balanceOfAtNFT(2, cp0.blk);
    const cp1 = (await core.ve.userPointHistory(2, 1));
    await core.ve.balanceOfAtNFT(2, cp1.blk.add(1));
  });


  it("supportsInterface test", async function () {
    expect(await core.ve.supportsInterface('0x00000000')).is.eq(false);
  });

  it("get_last_user_slope test", async function () {
    expect(await core.ve.getLastUserSlope(0)).is.eq(0);
  });

  it("user_point_history__ts test", async function () {
    expect(await core.ve.userPointHistoryTs(0, 0)).is.eq(0);
  });

  it("locked__end test", async function () {
    expect(await core.ve.lockedEnd(0)).is.eq(0);
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
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365 * 3);
    await core.ve.increaseUnlockTime(1, 60 * 60 * 24 * 365 * 4);
    await expect(core.ve.increaseUnlockTime(1, 60 * 60 * 24 * 365 * 5)).revertedWith('Voting lock can be 4 years max');
  });

  it("tokenURI test", async function () {
    await core.ve.tokenURI(1);
  });

  it("balanceOfNFTAt test", async function () {
    await core.ve.balanceOfNFTAt(1, 0);
  });

});
