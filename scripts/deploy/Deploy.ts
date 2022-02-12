import {ethers, web3} from "hardhat";
import {Logger} from "tslog";
import logSettings from "../../log_settings";
import {ContractFactory, utils, Wallet} from "ethers";
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
  Ve,
  VeDist
} from "../../typechain";

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
    },
  }).argv;

const libraries = new Map<string, string>([
  ['', '']
]);

export class Deploy {

  readonly signer: Wallet


  constructor(signer: Wallet) {
    this.signer = signer;
  }

  public async deployContract<T extends ContractFactory>(
    name: string,
    // tslint:disable-next-line:no-any
    ...args: any[]
  ) {
    log.info(`Deploying ${name}`);
    log.info("Account balance: " + utils.formatUnits(await this.signer.getBalance(), 18));

    const gasPrice = await web3.eth.getGasPrice();
    log.info("Gas price: " + gasPrice);
    const lib: string | undefined = libraries.get(name);
    let _factory;
    if (lib) {
      log.info('DEPLOY LIBRARY', lib, 'for', name);
      const libAddress = (await this.deployContract(lib)).address;
      const librariesObj: Libraries = {};
      librariesObj[lib] = libAddress;
      _factory = (await ethers.getContractFactory(
        name,
        {
          signer: this.signer,
          libraries: librariesObj
        }
      )) as T;
    } else {
      _factory = (await ethers.getContractFactory(
        name,
        this.signer
      )) as T;
    }
    const instance = await _factory.deploy(...args);
    log.info('Deploy tx:', instance.deployTransaction.hash);
    await instance.deployed();

    const receipt = await ethers.provider.getTransactionReceipt(instance.deployTransaction.hash);
    log.info('Receipt', receipt.contractAddress)
    return _factory.attach(receipt.contractAddress);
  }

  public async deployBaseV1() {
    return (await this.deployContract('BaseV1')) as BaseV1;
  }

  public async deployGaugeFactory() {
    return (await this.deployContract('BaseV1GaugeFactory')) as BaseV1GaugeFactory;
  }

  public async deployBribeFactory() {
    return (await this.deployContract('BaseV1BribeFactory')) as BaseV1BribeFactory;
  }

  public async deployBaseV1Factory() {
    return (await this.deployContract('BaseV1Factory')) as BaseV1Factory;
  }

  public async deployBaseV1Router01(
    factory: string,
    networkToken: string,
  ) {
    return (await this.deployContract('BaseV1Router01', factory, networkToken)) as BaseV1Router01;
  }

  public async deployVe(token: string) {
    return (await this.deployContract('Ve', token)) as Ve;
  }

  public async deployVeDist(ve: string) {
    return (await this.deployContract('VeDist', ve)) as VeDist;
  }

  public async deployBaseV1Voter(
    ve: string,
    factory: string,
    gauges: string,
    bribes: string,
  ) {
    return (await this.deployContract(
      'BaseV1Voter',
      ve,
      factory,
      gauges,
      bribes,
    )) as BaseV1Voter;
  }

  public async deployBaseV1Minter(
    voter: string,
    ve: string,
    veDist: string
  ) {
    return (await this.deployContract(
      'BaseV1Minter',
      voter,
      ve,
      veDist,
    )) as BaseV1Minter;
  }
}
