import {Deploy} from "../Deploy";
import {ethers} from "hardhat";
import {Verify} from "../../Verify";
import {Misc} from "../../Misc";
import {writeFileSync} from "fs";


async function main() {
  const signer = (await ethers.getSigners())[0];

  const oldUniswapFactory = '0xE7Fb3e833eFE5F9c441105EB65Ef8b261266423B';
  const dystRouter = '0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e';

  const migrator = await Deploy.deployContract(signer, 'Migrator', oldUniswapFactory, dystRouter)

  const data = 'migrator dfyn : ' + migrator.address

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
