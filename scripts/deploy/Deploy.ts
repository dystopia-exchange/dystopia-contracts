import {ethers, web3} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {Logger} from "tslog";
import logSettings from "../../log_settings";
import {ContractFactory, utils} from "ethers";
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
import axios from "axios";

// tslint:disable-next-line:no-var-requires
const hre = require("hardhat");
const log: Logger = new Logger(logSettings);
require("dotenv").config();


dotEnvConfig();
// tslint:disable-next-line:no-var-requires
const argv = require('yargs/yargs')()
  .env('')
  .options({
    networkScanKey: {
      type: "string",
      default:process.env.NETWORK_SCAN_KEY
    },
  }).argv;

const libraries = new Map<string, string>([
  ['', '']
]);

export class Deploy {

  constructor(signer: SignerWithAddress) {
    signer = signer;
  }

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
      const libAddress = (await Deploy.deployContract(signer,lib)).address;
      const librariesObj: Libraries = {};
      librariesObj[lib] = libAddress;
      _factory = (await ethers.getContractFactory(
        name,
        {
          signer: signer,
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

  public static async deployBaseV1( signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer,'BaseV1')) as BaseV1;
  }

  public static async deployGaugeFactory( signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer,'BaseV1GaugeFactory')) as BaseV1GaugeFactory;
  }

  public static async deployBribeFactory( signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer,'BaseV1BribeFactory')) as BaseV1BribeFactory;
  }

  public static async deployBaseV1Factory( signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer,'BaseV1Factory')) as BaseV1Factory;
  }

  public static async deployBaseV1Router01(
    signer: SignerWithAddress,
    factory: string,
    networkToken: string,
  ) {
    return (await Deploy.deployContract(signer,'BaseV1Router01', factory, networkToken)) as BaseV1Router01;
  }

  public static async deployVe( signer: SignerWithAddress,token: string) {
    return (await Deploy.deployContract(signer,'Ve', token)) as Ve;
  }

  public static async deployVeDist( signer: SignerWithAddress,ve: string) {
    return (await Deploy.deployContract(signer,'VeDist', ve)) as VeDist;
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

  // ************** VERIFY **********************

  public static async verify(address: string) {
    try {
      await hre.run("verify:verify", {
        address
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
  }

  // tslint:disable-next-line:no-any
  public static async verifyWithArgs(address: string, args: any[]) {
    try {
      await hre.run("verify:verify", {
        address, constructorArguments: args
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
  }

  // tslint:disable-next-line:no-any
  public static async verifyWithContractName(address: string, contractPath: string, args?: any[]) {
    try {
      await hre.run("verify:verify", {
        address, contract: contractPath, constructorArguments: args
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
  }

  // tslint:disable-next-line:no-any
  public static async verifyWithArgsAndContractName(address: string, args: any[], contractPath: string) {
    try {
      await hre.run("verify:verify", {
        address, constructorArguments: args, contract: contractPath
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
  }


  public static async verifyProxy(adr: string) {
    try {

      const resp =
        await axios.post(
          (await Deploy.getNetworkScanUrl()) +
          `?module=contract&action=verifyproxycontract&apikey=${argv.networkScanKey}`,
          `address=${adr}`);
      // log.info("proxy verify resp", resp.data);
    } catch (e) {
      log.info('error proxy verify ' + adr + e);
    }
  }

    // ************** ADDRESSES **********************

    public static async getNetworkScanUrl(): Promise<string> {
      const net = (await ethers.provider.getNetwork());
      if (net.name === 'ropsten') {
        return 'https://api-ropsten.etherscan.io/api';
      } else if (net.name === 'kovan') {
        return 'https://api-kovan.etherscan.io/api';
      } else if (net.name === 'rinkeby') {
        return 'https://api-rinkeby.etherscan.io/api';
      } else if (net.name === 'ethereum') {
        return 'https://api.etherscan.io/api';
      } else if (net.name === 'matic') {
        return 'https://api.polygonscan.com/api'
      } else if (net.chainId === 80001) {
        return 'https://api-testnet.polygonscan.com/api'
      } else if (net.chainId === 250) {
        return 'https://api.ftmscan.com//api'
      } else {
        throw Error('network not found ' + net);
      }
    }
      // ****************** WAIT ******************

  public static async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

    public static async wait(blocks: number) {
      const start = ethers.provider.blockNumber;
      while (true) {
        log.info('wait 10sec');
        await Deploy.delay(10000);
        if (ethers.provider.blockNumber >= start + blocks) {
          break;
        }
      }
    }
}
