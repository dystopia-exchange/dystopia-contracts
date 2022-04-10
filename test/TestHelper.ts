import {CoreAddresses} from "../scripts/deploy/CoreAddresses";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber, utils} from "ethers";
import {BaseV1Pair, BaseV1Pair__factory, Gauge, IERC20__factory, Token} from "../typechain";
import chai from "chai";
import {Deploy} from "../scripts/deploy/Deploy";

const {expect} = chai;

export class TestHelper {

  public static async addLiquidity(
    core: CoreAddresses,
    owner: SignerWithAddress,
    tokenA: string,
    tokenB: string,
    tokenAAmount: BigNumber,
    tokenBAmount: BigNumber,
    stable: boolean
  ) {
    TestHelper.gte(await IERC20__factory.connect(tokenA, owner).balanceOf(owner.address), tokenAAmount);
    TestHelper.gte(await IERC20__factory.connect(tokenB, owner).balanceOf(owner.address), tokenBAmount);
    await IERC20__factory.connect(tokenA, owner).approve(core.router.address, tokenAAmount);
    await IERC20__factory.connect(tokenB, owner).approve(core.router.address, tokenBAmount);
    await core.router.connect(owner).addLiquidity(tokenA, tokenB, stable, tokenAAmount, tokenBAmount, 0, 0, owner.address, Date.now());
    const address = await core.factory.getPair(tokenA, tokenB, stable);
    return BaseV1Pair__factory.connect(address, owner);
  }

  public static async depositToGauge(
    owner: SignerWithAddress,
    gauge: Gauge,
    pair: BaseV1Pair,
    amount: BigNumber,
    tokenId: number
  ) {
    TestHelper.gte(await pair.balanceOf(owner.address), amount);
    await pair.connect(owner).approve(gauge.address, amount);
    await gauge.connect(owner).deposit(amount, tokenId);
  }

  public static async createMockTokensAndMint(
    owner: SignerWithAddress
  ) {
    const ust = await Deploy.deployContract(owner, 'Token', 'UST', 'UST', 6, owner.address) as Token;
    await ust.mint(owner.address, utils.parseUnits('1000000000000', 6));

    const mim = await Deploy.deployContract(owner, 'Token', 'MIM', 'MIM', 18, owner.address) as Token;
    await mim.mint(owner.address, utils.parseUnits('1000000000000'));

    const dai = await Deploy.deployContract(owner, 'Token', 'DAI', 'DAI', 18, owner.address) as Token;
    await dai.mint(owner.address, utils.parseUnits('1000000000000'));

    return [ust, mim, dai];
  }

  public static gte(actual: BigNumber, expected: BigNumber) {
    expect(actual.gte(expected)).is.eq(true,
      `Expected: ${expected.toString()}, actual: ${actual.toString()}`);
  }

  public static closer(actual: BigNumber, expected: BigNumber, delta: BigNumber) {
    expect(actual.gte(expected.sub(delta)) && actual.lte(expected.add(delta))).is.eq(true,
      `Expected: ${expected.sub(delta).toString()} - ${expected.add(delta).toString()}, actual: ${actual.toString()}`);
  }

}
