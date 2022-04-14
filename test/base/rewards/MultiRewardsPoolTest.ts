import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {TimeUtils} from "../../TimeUtils";
import {MultiRewardsPoolBase, Token} from "../../../typechain";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {parseUnits} from "ethers/lib/utils";


const {expect} = chai;

const FULL_REWARD = parseUnits('100');

describe("multi reward pool tests", function () {

  let snapshotBefore: string;
  let snapshot: string;

  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let rewarder: SignerWithAddress;

  let wmatic: Token;
  let rewardToken: Token;
  let rewardToken2: Token;
  let pool: MultiRewardsPoolBase;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, user, rewarder] = await ethers.getSigners();

    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    await wmatic.mint(owner.address, parseUnits('100'));
    await wmatic.mint(user.address, FULL_REWARD);

    rewardToken = await Deploy.deployContract(owner, 'Token', 'REWARD', 'REWARD', 18, owner.address) as Token;
    await rewardToken.mint(rewarder.address, parseUnits('100'));
    rewardToken2 = await Deploy.deployContract(owner, 'Token', 'REWARD2', 'REWARD2', 18, owner.address) as Token;
    await rewardToken2.mint(rewarder.address, parseUnits('100'));

    pool = await Deploy.deployContract(owner, 'MultiRewardsPoolMock', wmatic.address) as MultiRewardsPoolBase;

    await wmatic.approve(pool.address, parseUnits('999999999'));
    await wmatic.connect(user).approve(pool.address, parseUnits('999999999'));
    await rewardToken.connect(rewarder).approve(pool.address, parseUnits('999999999'));
    await rewardToken2.connect(rewarder).approve(pool.address, parseUnits('999999999'));
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

  it("deposit and get rewards should receive all amount", async function () {
    await pool.deposit(parseUnits('1'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD);
    expect(await rewardToken.balanceOf(pool.address)).is.eq(FULL_REWARD);

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365);

    await pool.getReward(owner.address, [rewardToken.address]);
    expect(await rewardToken.balanceOf(pool.address)).is.below(2);
    expect(await rewardToken.balanceOf(owner.address)).is.above(FULL_REWARD.sub(2));
  });

  it("deposit and multiple get rewards should receive all amount", async function () {
    await pool.deposit(parseUnits('1'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD);
    expect(await rewardToken.balanceOf(pool.address)).is.eq(FULL_REWARD);

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.getReward(owner.address, [rewardToken.address]);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.getReward(owner.address, [rewardToken.address]);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365);
    await pool.getReward(owner.address, [rewardToken.address]);

    expect(await rewardToken.balanceOf(pool.address)).is.below(3);
    expect(await rewardToken.balanceOf(owner.address)).is.above(FULL_REWARD.sub(3));
  });

  it("deposit and get rewards should receive all amount with multiple notify", async function () {
    await pool.deposit(parseUnits('1'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);
    await pool.getReward(owner.address, [rewardToken.address]);

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);
    await pool.getReward(owner.address, [rewardToken.address]);

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 365);
    await pool.getReward(owner.address, [rewardToken.address]);

    expect(await rewardToken.balanceOf(pool.address)).is.below(3);
    expect(await rewardToken.balanceOf(owner.address)).is.above(FULL_REWARD.sub(3));
  });

  it("double deposit and get rewards should receive all amount", async function () {
    await pool.deposit(parseUnits('0.5'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD);
    expect(await rewardToken.balanceOf(pool.address)).is.eq(FULL_REWARD);

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 7 - 100);

    await pool.deposit(parseUnits('0.5'));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);

    await pool.getReward(owner.address, [rewardToken.address]);
    expect(await rewardToken.balanceOf(pool.address)).is.below(2);
    expect(await rewardToken.balanceOf(owner.address)).is.above(FULL_REWARD.sub(2));
  });

  it("multiple deposit/withdraws and get rewards should receive all amount for multiple accounts", async function () {
    await pool.deposit(parseUnits('0.5'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));

    // *** DEPOSITS / WITHDRAWS ***

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);
    await pool.connect(user).deposit(parseUnits('0.2'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken2.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.deposit(parseUnits('0.5'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);
    await pool.connect(user).withdraw(parseUnits('0.2'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken2.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.connect(user).deposit(parseUnits('0.2'));

    // todo batchRewardPerToken


    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.connect(user).deposit(parseUnits('0.2'));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.connect(user).withdraw(parseUnits('0.2'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));
    await TimeUtils.advanceBlocksOnTs(1);
    await pool.connect(rewarder).notifyRewardAmount(rewardToken2.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);
    await pool.connect(user).withdraw(parseUnits('0.2'));

    await TimeUtils.advanceBlocksOnTs(60 * 60);
    await pool.connect(user).deposit(parseUnits('1'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));
    await pool.connect(rewarder).notifyRewardAmount(rewardToken2.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.deposit(parseUnits('0.5'));

    // *** GET REWARDS ***

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365);
    await pool.getReward(owner.address, [rewardToken.address]);
    await pool.getReward(owner.address, [rewardToken2.address]);

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.connect(user).getReward(user.address, [rewardToken.address]);
    await pool.connect(user).getReward(user.address, [rewardToken2.address]);

    // each operation can lead to rounding, a gap depends on deposit/withdraw counts and can not be predicted
    expect(await rewardToken.balanceOf(pool.address)).is.below(14);
    expect((await rewardToken.balanceOf(owner.address)).add(await rewardToken.balanceOf(user.address))).is.above(FULL_REWARD.sub(14));

    expect(await rewardToken2.balanceOf(pool.address)).is.below(14);
    expect((await rewardToken2.balanceOf(owner.address)).add(await rewardToken2.balanceOf(user.address))).is.above(FULL_REWARD.sub(14));
  });

});
