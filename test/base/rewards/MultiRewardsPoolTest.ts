import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import chai from "chai";
import {TimeUtils} from "../../TimeUtils";
import {MultiRewardsPoolMock, Token} from "../../../typechain";
import {Deploy} from "../../../scripts/deploy/Deploy";
import {parseUnits} from "ethers/lib/utils";
import {Misc} from "../../../scripts/Misc";


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
  let pool: MultiRewardsPoolMock;


  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [owner, user, rewarder] = await ethers.getSigners();

    wmatic = await Deploy.deployContract(owner, 'Token', 'WMATIC', 'WMATIC', 18, owner.address) as Token;
    await wmatic.mint(owner.address, parseUnits('100'));
    await wmatic.mint(user.address, FULL_REWARD);

    rewardToken = await Deploy.deployContract(owner, 'Token', 'REWARD', 'REWARD', 18, owner.address) as Token;
    await rewardToken.mint(rewarder.address, Misc.MAX_UINT);
    rewardToken2 = await Deploy.deployContract(owner, 'Token', 'REWARD2', 'REWARD2', 18, owner.address) as Token;
    await rewardToken2.mint(rewarder.address, parseUnits('100'));

    pool = await Deploy.deployContract(owner, 'MultiRewardsPoolMock', wmatic.address) as MultiRewardsPoolMock;

    await wmatic.approve(pool.address, parseUnits('999999999'));
    await wmatic.connect(user).approve(pool.address, parseUnits('999999999'));
    await rewardToken.connect(rewarder).approve(pool.address, Misc.MAX_UINT);
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


  it("rewardTokensLength test", async function () {
    expect(await pool.rewardTokensLength()).is.eq(0);
  });

  it("rewardPerToken test", async function () {
    expect(await pool.rewardPerToken(Misc.ZERO_ADDRESS)).is.eq(0);
  });

  it("derivedBalance test", async function () {
    expect(await pool.derivedBalance(Misc.ZERO_ADDRESS)).is.eq(0);
  });

  it("left for empty token test", async function () {
    expect(await pool.left(Misc.ZERO_ADDRESS)).is.eq(0);
  });

  it("left test", async function () {
    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD);
    expect(await pool.left(rewardToken.address)).is.not.eq(0);
  });

  it("earned test", async function () {
    expect(await pool.earned(Misc.ZERO_ADDRESS, Misc.ZERO_ADDRESS)).is.eq(0);
  });

  it("getPriorBalanceIndex test", async function () {
    expect(await pool.getPriorBalanceIndex(Misc.ZERO_ADDRESS, 0)).is.eq(0);
  });

  it("getPriorSupplyIndex test", async function () {
    expect(await pool.getPriorSupplyIndex(0)).is.eq(0);
  });

  it("getPriorRewardPerToken test", async function () {
    expect((await pool.getPriorRewardPerToken(Misc.ZERO_ADDRESS, 0))[0]).is.eq(0);
  });

  it("batchRewardPerToken for empty tokens test", async function () {
    await pool.batchUpdateRewardPerToken(Misc.ZERO_ADDRESS, 100)
  });

  it("batchRewardPerToken test", async function () {
    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD);
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.deposit(parseUnits('1'));
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.withdraw(parseUnits('1'));
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.deposit(parseUnits('1'));
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.withdraw(parseUnits('1'));
    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.batchUpdateRewardPerToken(Misc.ZERO_ADDRESS, 100)
  });

  it("deposit zero amount should be reverted", async function () {
    await expect(pool.deposit(0)).revertedWith('Zero amount');
  });

  it("get rewards not for the owner should be reverted", async function () {
    await expect(pool.getReward(user.address, [])).revertedWith('Forbidden');
  });

  it("get rewards not for the owner should be reverted", async function () {
    await expect(pool.notifyRewardAmount(Misc.ZERO_ADDRESS, 0)).revertedWith('Zero amount');
  });

  it("not more than MAX REWARDS TOKENS", async function () {
    let lastRt = null;
    for (let i = 0; i < 11; i++) {
      const rt = await Deploy.deployContract(owner, 'Token', 'RT', 'RT', 18, owner.address) as Token;
      await rt.mint(rewarder.address, Misc.MAX_UINT);
      await rt.connect(rewarder).approve(pool.address, Misc.MAX_UINT);
      if (i < 10) {
        await pool.connect(rewarder).notifyRewardAmount(rt.address, 100);
      } else {
        await expect(pool.connect(rewarder).notifyRewardAmount(rt.address, 100)).revertedWith("Too many reward tokens");
      }
      lastRt = rt;
    }
    if (!!lastRt) {
      await expect(pool.connect(rewarder).notifyRewardAmount(lastRt.address, 100)).revertedWith("Too many reward tokens");
    }
    expect(await pool.rewardTokensLength()).is.eq(10);
  });

  it("notify checks", async function () {
    // await expect(pool.connect(rewarder).notifyRewardAmount(rewardToken.address, 1)).revertedWith('Zero reward rate');
    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));
    await expect(pool.connect(rewarder).notifyRewardAmount(rewardToken.address, 10)).revertedWith('Amount should be higher than remaining rewards');
    await expect(pool.connect(rewarder).notifyRewardAmount(wmatic.address, 10)).revertedWith('Wrong token for rewards');
    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, Misc.MAX_UINT.div('10000000000000000000'));
  });

  // ***************** THE MAIN LOGIC TESTS *********************************

  it("update snapshots after full withdraw", async function () {
    await pool.deposit(parseUnits('0.1'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(10));

    await pool.withdraw(await pool.balanceOf(owner.address));

    await pool.deposit(parseUnits('0.1'));

    await pool.batchUpdateRewardPerToken(rewardToken.address, 200);
  });

  it("deposit and get rewards should receive all amount", async function () {
    await pool.deposit(parseUnits('1'));
    await pool.withdraw(parseUnits('1'));
    await pool.deposit(parseUnits('1'));
    await pool.getReward(owner.address, [rewardToken.address]);

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

    expect(await rewardToken.balanceOf(pool.address)).is.below(4);
    expect(await rewardToken.balanceOf(owner.address)).is.above(FULL_REWARD.sub(4));
  });

  it("multiple deposits and get rewards should receive all amount", async function () {
    await pool.deposit(parseUnits('0.1'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD);
    expect(await rewardToken.balanceOf(pool.address)).is.eq(FULL_REWARD);

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 7 - 100);

    for (let i = 0; i < 9; i++) {
      await pool.deposit(parseUnits('0.1'));
      if (i % 3 === 0) {
        await TimeUtils.advanceBlocksOnTs(10);
      }
    }

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);

    await pool.getReward(owner.address, [rewardToken.address]);
    expect(await rewardToken.balanceOf(pool.address)).is.below(10);
    expect(await rewardToken.balanceOf(owner.address)).is.above(FULL_REWARD.sub(10));
  });

  it("multiple deposit/withdraws and get rewards should receive all amount for multiple accounts", async function () {
    await pool.deposit(parseUnits('0.5'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));

    // *** DEPOSITS / WITHDRAWS ***

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);
    await pool.connect(user).deposit(parseUnits('0.2'));

    await pool.batchUpdateRewardPerToken(rewardToken.address, 200);
    await pool.batchUpdateRewardPerToken(rewardToken2.address, 200);

    await pool.connect(rewarder).notifyRewardAmount(rewardToken2.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.testDoubleDeposit(parseUnits('0.5'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);
    await pool.connect(user).testDoubleWithdraw(parseUnits('0.2'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken2.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.connect(user).testDoubleDeposit(parseUnits('0.2'));

    await pool.batchUpdateRewardPerToken(rewardToken.address, 200);

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.connect(user).deposit(parseUnits('0.2'));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.connect(user).testDoubleWithdraw(parseUnits('0.2'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));
    await TimeUtils.advanceBlocksOnTs(1);
    await pool.connect(rewarder).notifyRewardAmount(rewardToken2.address, FULL_REWARD.div(4));

    await pool.batchUpdateRewardPerToken(rewardToken.address, 1);
    await pool.batchUpdateRewardPerToken(rewardToken2.address, 1);

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 6);
    await pool.connect(user).withdraw(parseUnits('0.2'));

    await TimeUtils.advanceBlocksOnTs(60 * 60);
    await pool.connect(user).deposit(parseUnits('1'));

    await pool.connect(rewarder).notifyRewardAmount(rewardToken.address, FULL_REWARD.div(4));
    await pool.connect(rewarder).notifyRewardAmount(rewardToken2.address, FULL_REWARD.div(4));

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 6);
    await pool.deposit(parseUnits('0.5'));

    await pool.batchUpdateRewardPerToken(rewardToken2.address, 0);

    // *** GET REWARDS ***

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 365);
    await pool.getReward(owner.address, [rewardToken.address]);
    await pool.getReward(owner.address, [rewardToken2.address]);

    await TimeUtils.advanceBlocksOnTs(60 * 60 * 24);
    await pool.connect(user).getReward(user.address, [rewardToken.address, rewardToken2.address]);

    // each operation can lead to rounding, a gap depends on deposit/withdraw counts and can not be predicted
    expect(await rewardToken.balanceOf(pool.address)).is.below(14);
    expect((await rewardToken.balanceOf(owner.address)).add(await rewardToken.balanceOf(user.address))).is.above(FULL_REWARD.sub(14));

    expect(await rewardToken2.balanceOf(pool.address)).is.below(14);
    expect((await rewardToken2.balanceOf(owner.address)).add(await rewardToken2.balanceOf(user.address))).is.above(FULL_REWARD.sub(14));

    await pool.withdraw(parseUnits('1'));
    await pool.deposit(parseUnits('1'));

    await pool.batchUpdateRewardPerToken(rewardToken.address, 200);
  });

});
