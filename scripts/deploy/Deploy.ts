import {ethers, web3} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {Logger} from "tslog";
import logSettings from "../../log_settings";
import {BigNumber, ContractFactory, utils} from "ethers";
import {Libraries} from "hardhat-deploy/dist/types";
import {
  Dyst,
  BribeFactory,
  DystFactory,
  GaugeFactory,
  DystMinter,
  DystRouter01,
  DystVoter,
  GovernanceTreasury,
  Token,
  Ve,
  VeDist
} from "../../typechain";
import {Misc} from "../Misc";
import {CoreAddresses} from "./CoreAddresses";

const log: Logger = new Logger(logSettings);

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

  public static async deployDyst(signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer, 'Dyst')) as Dyst;
  }

  public static async deployToken(signer: SignerWithAddress, name: string, symbol: string, decimal: number) {
    return (await Deploy.deployContract(signer, 'Token', name, symbol, decimal, signer.address)) as Token;
  }

  public static async deployGaugeFactory(signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer, 'GaugeFactory')) as GaugeFactory;
  }

  public static async deployBribeFactory(signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer, 'BribeFactory')) as BribeFactory;
  }

  public static async deployDystFactory(signer: SignerWithAddress, treasury: string) {
    return (await Deploy.deployContract(signer, 'DystFactory', treasury)) as DystFactory;
  }

  public static async deployGovernanceTreasury(signer: SignerWithAddress) {
    return (await Deploy.deployContract(signer, 'GovernanceTreasury')) as GovernanceTreasury;
  }

  public static async deployDystRouter01(
    signer: SignerWithAddress,
    factory: string,
    networkToken: string,
  ) {
    return (await Deploy.deployContract(signer, 'DystRouter01', factory, networkToken)) as DystRouter01;
  }

  public static async deployVe(signer: SignerWithAddress, token: string) {
    return (await Deploy.deployContract(signer, 'Ve', token)) as Ve;
  }

  public static async deployVeDist(signer: SignerWithAddress, ve: string) {
    return (await Deploy.deployContract(signer, 'VeDist', ve)) as VeDist;
  }

  public static async deployDystVoter(
    signer: SignerWithAddress,
    ve: string,
    factory: string,
    gauges: string,
    bribes: string,
  ) {
    return (await Deploy.deployContract(
      signer,
      'DystVoter',
      ve,
      factory,
      gauges,
      bribes,
    )) as DystVoter;
  }

  public static async deployDystMinter(
    signer: SignerWithAddress,
    voter: string,
    ve: string,
    veDist: string
  ) {
    return (await Deploy.deployContract(
      signer,
      'DystMinter',
      voter,
      ve,
      veDist,
    )) as DystMinter;
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
    const token = await Deploy.deployDyst(signer);
    const gaugesFactory = await Deploy.deployGaugeFactory(signer);
    const bribesFactory = await Deploy.deployBribeFactory(signer);
    const baseFactory = await Deploy.deployDystFactory(signer, treasury.address);

    const router = await Deploy.deployDystRouter01(signer, baseFactory.address, networkToken);
    const ve = await Deploy.deployVe(signer, token.address);
    const veDist = await Deploy.deployVeDist(signer, ve.address);
    const voter = await Deploy.deployDystVoter(signer, ve.address, baseFactory.address, gaugesFactory.address, bribesFactory.address);
    const minter = await Deploy.deployDystMinter(signer, voter.address, ve.address, veDist.address);

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
      minter,
      treasury
    );
  }

}
