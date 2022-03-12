import {config as dotEnvConfig} from "dotenv";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-solhint";
import '@openzeppelin/hardhat-upgrades';
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-tracer";
import "hardhat-etherscan-abi";
import "solidity-coverage"

dotEnvConfig();
// tslint:disable-next-line:no-var-requires
const argv = require('yargs/yargs')()
  .env('')
  .options({
    hardhatChainId: {
      type: "number",
      default: 80001
    },
    maticRpcUrl: {
      type: "string",
      default: "https://polygon-mumbai.g.alchemy.com/v2/5pRr0lzXltpqOfMV92aaHImC69sKCcub"
    },
    ethRpcUrl: {
      type: "string",
      default: ''
    },
    infuraKey: {
      type: "string",
    },
    networkScanKey: {
      type: "string",
    },
    privateKey: {
      type: "string",
      default: "b55c9fcc2c60993e5c539f37ffd27d2058e7f77014823b461323db5eba817518" // random account
    },
    maticForkBlock: {
      type: "number",
      default: 23945980
    },
  }).argv;


export default {
  defaultNetwork: "mumbai",
  networks: {
    // hardhat: {
    //   allowUnlimitedContractSize: true,
    //   chainId: argv.hardhatChainId,
    //   timeout: 99999 * 2,
    //   gas: argv.hardhatChainId === 137 ? 19_000_000 :
    //       9_000_000,
    //   forking: {
    //     url:
    //       argv.hardhatChainId === 137 ? argv.maticRpcUrl :
    //           undefined,
    //     blockNumber:
    //       argv.hardhatChainId === 137 ? argv.maticForkBlock !== 0 ? argv.maticForkBlock : undefined :
    //           undefined
    //   },
    //   accounts: {
    //     mnemonic: "test test test test test test test test test test test junk",
    //     path: "m/44'/60'/0'/0",
    //     accountsBalance: "100000000000000000000000000000"
    //   },
    // },
    matic: {
      url: argv.maticRpcUrl,
      timeout: 99999,
      chainId: 137,
      // gas: 19_000_000,
      // gasPrice: 100_000_000_000,
      gasMultiplier: 1.3,
      accounts: [argv.privateKey],
    },
    mumbai: {
      url: argv.maticRpcUrl,
      chainId: 80001,
      timeout: 99999,
      gasPrice: 100_000_000_000,
      accounts: [argv.privateKey],
    },
  },
  etherscan: {
    apiKey: argv.networkScanKey
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          }
        }
      },
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 9999999999
  },
  contractSizer: {
    alphaSort: false,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  gasReporter: {
    enabled: false,
    currency: 'USD',
    gasPrice: 21
  },
  typechain: {
    outDir: "typechain",
  },
};
