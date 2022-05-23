import {Deploy} from "../Deploy";
import {ethers} from "hardhat";
import {Verify} from "../../Verify";
import {Misc} from "../../Misc";
import {writeFileSync} from "fs";


async function main() {
  const signer = (await ethers.getSigners())[0];

  const oldUniswapFactory = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32';
  const dystRouter = '0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e';

  const migrator = await Deploy.deployContract(signer, oldUniswapFactory, dystRouter)

  const data = 'migrator quickswap: ' + migrator.address

  console.log(data);
  writeFileSync('tmp/migrator.txt', data);

  await Misc.wait(5);

  await Verify.verifyWithArgs(migrator.address, [oldUniswapFactory, dystRouter]);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
