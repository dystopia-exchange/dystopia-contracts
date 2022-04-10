import {Deploy} from "../Deploy";
import {ethers} from "hardhat";
import {Verify} from "../../Verify";
import {Misc} from "../../Misc";
import {writeFileSync} from "fs";
import {utils} from "ethers";

async function main() {
  const signer = (await ethers.getSigners())[0];

  const usdc = await Deploy.deployToken(signer, 'Mock USDC', 'MOCK_USDC', 6);
  const mim = await Deploy.deployToken(signer, 'Mock MIM', 'MOCK_MIM', 18);
  const dai = await Deploy.deployToken(signer, 'Mock DAI', 'MOCK_DAI', 18);
  const usdt = await Deploy.deployToken(signer, 'Mock USDT', 'MOCK_USDT', 8);
  const mai = await Deploy.deployToken(signer, 'Mock MAI', 'MOCK_MAI', 18);

  await Misc.runAndWait(() => usdc.mint(signer.address, utils.parseUnits('100000', 6)))
  await Misc.runAndWait(() => mim.mint(signer.address, utils.parseUnits('100000', 18)))
  await Misc.runAndWait(() => dai.mint(signer.address, utils.parseUnits('100000', 18)))
  await Misc.runAndWait(() => usdt.mint(signer.address, utils.parseUnits('100000', 8)))
  await Misc.runAndWait(() => mai.mint(signer.address, utils.parseUnits('100000', 18)))

  const data = ''
    + 'usdc: ' + usdc.address + '\n'
    + 'mim: ' + mim.address + '\n'
    + 'dai: ' + dai.address + '\n'
    + 'usdt: ' + usdt.address + '\n'
    + 'mai: ' + mai.address + '\n';
  console.log(data);
  writeFileSync('tmp/tokens.txt', data);

  await Misc.wait(5);

  await Verify.verifyWithArgs(usdc.address, ['Mock USDC', 'MOCK_USDC', 6, signer.address]);
  await Verify.verifyWithArgs(mim.address, ['Mock MIM', 'MOCK_MIM', 18, signer.address]);
  await Verify.verifyWithArgs(dai.address, ['Mock DAI', 'MOCK_DAI', 18, signer.address]);
  await Verify.verifyWithArgs(usdt.address, ['Mock USDT', 'MOCK_USDT', 8, signer.address]);
  await Verify.verifyWithArgs(mai.address, ['Mock MAI', 'MOCK_MAI', 8, signer.address]);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
