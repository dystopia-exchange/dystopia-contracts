import {ethers} from "hardhat";
import {Logger} from "tslog";
import Common from "ethereumjs-common";
import logSettings from "../log_settings";
import {BigNumber, ContractTransaction} from "ethers";

// tslint:disable-next-line:no-var-requires
const hre = require("hardhat");
const log: Logger = new Logger(logSettings);

const MATIC_CHAIN = Common.forCustomChain(
  'mainnet', {
    name: 'matic',
    networkId: 137,
    chainId: 137
  },
  'petersburg'
);

export class Misc {
  public static readonly SECONDS_OF_DAY = 60 * 60 * 24;
  public static readonly SECONDS_OF_YEAR = Misc.SECONDS_OF_DAY * 365;
  public static readonly ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  public static printDuration(text: string, start: number) {
    log.info('>>>' + text, ((Date.now() - start) / 1000).toFixed(1), 'sec');
  }

  public static getChainConfig() {
    const net = hre.network.config.chainId;
    switch (net.chainId) {
      case 137:
        return MATIC_CHAIN;
      default:
        throw new Error('Unknown net ' + net.chainId)
    }
  }

  public static async getNetworkScanUrl(): Promise<string> {
    const net = hre.network.config.chainId;
    if (net === 4) {
      return 'https://api-rinkeby.etherscan.io/api';
    } else if (net === 1) {
      return 'https://api.etherscan.io/api';
    } else if (net === 137) {
      return 'https://api.polygonscan.com/api'
    } else if (net === 250) {
      return 'https://api.ftmscan.com//api'
    } else {
      throw Error('network not found ' + net);
    }
  }

  public static async runAndWait(callback: () => Promise<ContractTransaction>, stopOnError = true, wait = true) {
    const start = Date.now();
    const tr = await callback();
    if (!wait) {
      Misc.printDuration('runAndWait completed', start);
      return;
    }
    await Misc.wait(1);

    log.info('tx sent', tr.hash);

    let receipt;
    while (true) {
      receipt = await ethers.provider.getTransactionReceipt(tr.hash);
      if (!!receipt) {
        break;
      }
      log.info('not yet complete', tr.hash);
      await Misc.delay(10000);
    }
    log.info('transaction result', tr.hash, receipt?.status);
    log.info('gas used', receipt.gasUsed.toString());
    if (receipt?.status !== 1 && stopOnError) {
      throw Error("Wrong status!");
    }
    Misc.printDuration('runAndWait completed', start);
  }


  // ****************** WAIT ******************

  public static async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static async wait(blocks: number) {
    if (hre.network.name === 'hardhat' || blocks === 0) {
      return;
    }
    const start = ethers.provider.blockNumber;
    while (true) {
      log.info('wait 10sec');
      await Misc.delay(10000);
      if (ethers.provider.blockNumber >= start + blocks) {
        break;
      }
    }
  }

}

export type Attributes = [
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber
] & {
  strength: BigNumber;
  dexterity: BigNumber;
  vitality: BigNumber;
  energy: BigNumber;
  damageMin: BigNumber;
  damageMax: BigNumber;
  attackRating: BigNumber;
  defense: BigNumber;
  blockRating: BigNumber;
  life: BigNumber;
  mana: BigNumber;
  fireResistance: BigNumber;
  coldResistance: BigNumber;
  lightningResistance: BigNumber;
};

export type Stats = [BigNumber, BigNumber, BigNumber, BigNumber] & {
  level: BigNumber;
  experience: BigNumber;
  life: BigNumber;
  mana: BigNumber;
};

