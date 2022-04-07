import {ethers, web3} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {Logger} from "tslog";
import logSettings from "../../log_settings";
import {BigNumber, ContractFactory, utils} from "ethers";
import {Libraries} from "hardhat-deploy/dist/types";
import {config as dotEnvConfig} from "dotenv";
import {
  BaseV1,
  BaseV1BribeFactory,
  BaseV1Factory,
  BaseV1GaugeFactory,
  BaseV1Minter,
  BaseV1Router01,
  BaseV1Voter,
  Calculation,
  GovernanceTreasury,
  StakingRewards,
  Token,
  Ve,
  VeDist
} from "../../typechain";
import {Misc} from "../Misc";
import {CoreAddresses} from "./CoreAddresses";

// tslint:disable-next-line:no-var-requires
const hre = require("hardhat");
const log: Logger = new Logger(logSettings);


dotEnvConfig();
// tslint:disable-next-line:no-var-requires
const argv = require('yargs/yargs')()
  .env('')
  .options({
    networkScanKey: {
      type: "string",
      default: process.env.NETWORK_SCAN_KEY
    },
  }).argv;

const libraries = new Map<string, string>([
  ['', '']
]);

export class Deploy {

  // ************ CONTRACT CONNECTION **************************

  public static async deployContract<T extends ContractFactory>(
    signer: SignerWithAddress,
    name: string,
    // tslint:disable-next-line:no-any
    ...args: any[]
  ) {
    log.info(`Deploying ${name}`);
    log.info("Account balance: " + utils.formatUnits(await signer.getBalance(), 18));

    const gasPrice = await web3.eth.getGasPrice();
    log.info("Gas price: " + gasPrice);
    const lib: string | undefined = libraries.get(name);
    let _factory;
    if (lib) {
      log.info('DEPLOY LIBRARY', lib, 'for', name);
      const libAddress = (await Deploy.deployContract(signer, lib)).address;
      const librariesObj: Libraries = {};
      librariesObj[lib] = libAddress;
      _factory = (await ethers.getContractFactory(
        name,
        {
          signer,
          libraries: librariesObj
        }
      )) as T;
    } else {
      _factory = (await ethers.getContractFactory(
        name,
        signer
      )) as T;
    }
    const instance = await _factory.deploy(...args);
    log.info('Deploy tx:', instance.deployTransaction.hash);
    await instance.deployed();

    const receipt = await ethers.provider.getTransactionReceipt(instance.deployTransaction.hash);
    log.info('Receipt', receipt.contractAddress)
    return _factory.attach(receipt.contractAddress);
  }

  public static async deployBaseV1(signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer, 'BaseV1')) as BaseV1;
  }

  public static async deployToken(signer: SignerWithAddress, name: string, symbol: string, decimal: number) {
    return (await Deploy.deployContract(signer, 'Token', name, symbol, decimal, signer.address)) as Token;
  }

  public static async deployGaugeFactory(signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer, 'BaseV1GaugeFactory')) as BaseV1GaugeFactory;
  }

  public static async deployBribeFactory(signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer, 'BaseV1BribeFactory')) as BaseV1BribeFactory;
  }

  public static async deployBaseV1Factory(signer: SignerWithAddress, treasury: string) {
    return (await Deploy.deployContract(signer, 'BaseV1Factory', treasury)) as BaseV1Factory;
  }

  public static async deployGovernanceTreasury(signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer, 'GovernanceTreasury')) as GovernanceTreasury;
  }

  public static async deployBaseV1Router01(
    signer: SignerWithAddress,
    factory: string,
    networkToken: string,
  ) {
    return (await Deploy.deployContract(signer, 'BaseV1Router01', factory, networkToken)) as BaseV1Router01;
  }

  public static async deployVe(signer: SignerWithAddress, token: string) {
    return (await Deploy.deployContract(signer, 'Ve', token)) as Ve;
  }

  public static async deployVeDist(signer: SignerWithAddress, ve: string) {
    return (await Deploy.deployContract(signer, 'VeDist', ve)) as VeDist;
  }

  public static async deployBaseV1Voter(
    signer: SignerWithAddress,
    ve: string,
    factory: string,
    gauges: string,
    bribes: string,
  ) {
    return (await Deploy.deployContract(
      signer,
      'BaseV1Voter',
      ve,
      factory,
      gauges,
      bribes,
    )) as BaseV1Voter;
  }

  public static async deployBaseV1Minter(
    signer: SignerWithAddress,
    voter: string,
    ve: string,
    veDist: string
  ) {
    return (await Deploy.deployContract(
      signer,
      'BaseV1Minter',
      voter,
      ve,
      veDist,
    )) as BaseV1Minter;
  }

  public static async deployStakingRewards(
    signer: SignerWithAddress,
    pair: string,
    token: string
  ) {
    return (await Deploy.deployContract(
      signer,
      'StakingRewards',
      pair,
      token,
    )) as StakingRewards;
  }

  public static async deployCalculation(
    signer: SignerWithAddress,
    d0: BigNumber,
    d1: BigNumber,
    st: boolean,
    a1: string,
    a2: string
  ) {
    return (await Deploy.deployContract(
      signer,
      'Calculation',
      d0,
      d1,
      st,
      a1,
      a2
    )) as Calculation;
  }

  public static async deployCore(
    signer: SignerWithAddress,
    networkToken: string,
    voterTokens: string[],
    minterClaimants: string[],
    minterClaimantsAmounts: BigNumber[],
    minterMax: BigNumber
  ) {
    const treasury = await Deploy.deployGovernanceTreasury(signer);
    const token = await Deploy.deployBaseV1(signer);
    const gaugesFactory = await Deploy.deployGaugeFactory(signer);
    const bribesFactory = await Deploy.deployBribeFactory(signer);
    const baseFactory = await Deploy.deployBaseV1Factory(signer, treasury.address);

    const router = await Deploy.deployBaseV1Router01(signer, baseFactory.address, networkToken);
    const ve = await Deploy.deployVe(signer, token.address);
    const veDist = await Deploy.deployVeDist(signer, ve.address);
    const voter = await Deploy.deployBaseV1Voter(signer, ve.address, baseFactory.address, gaugesFactory.address, bribesFactory.address);
    const minter = await Deploy.deployBaseV1Minter(signer, voter.address, ve.address, veDist.address);

    await Misc.runAndWait(() => token.setMinter(minter.address));
    await Misc.runAndWait(() => ve.setVoter(voter.address));
    await Misc.runAndWait(() => veDist.setDepositor(minter.address));

    await Misc.runAndWait(() => voter.initialize(voterTokens, minter.address));
    await Misc.runAndWait(() => minter.initialize(
      minterClaimants,
      minterClaimantsAmounts,
      minterMax
    ));

    return new CoreAddresses(
      token,
      gaugesFactory,
      bribesFactory,
      baseFactory,
      router,
      ve,
      veDist,
      voter,
      minter
    );
  }

}
