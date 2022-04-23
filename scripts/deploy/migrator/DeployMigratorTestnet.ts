import {Deploy} from "../Deploy";
import {ethers} from "hardhat";
import {Verify} from "../../Verify";
import {Misc} from "../../Misc";
import {writeFileSync} from "fs";


async function main() {
  const signer = (await ethers.getSigners())[0];

  const oldUniswapFactory = '';
  const dystRouter = '';

  const migrator = await Deploy.deployContract(signer, oldUniswapFactory, dystRouter)

  const data = 'migrator: ' + migrator.address

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
