import {Deploy} from "../Deploy";
import {ethers} from "hardhat";
import {Verify} from "../../Verify";
import {Misc} from "../../Misc";
import {BigNumber} from "ethers";
import {MaticTestnetAddresses} from "../../addresses/MaticTestnetAddresses";
import {writeFileSync} from "fs";


const voterTokens = [
  "",
];

const claimants = [
  "",
];

const claimantsAmounts = [
  BigNumber.from(""),
];

const FACTORY = '0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9';

async function main() {
  const signer = (await ethers.getSigners())[0];

  let minterMax = BigNumber.from("0");

  for (const c of claimantsAmounts) {
    minterMax = minterMax.add(c);
  }

  const [
    token,
    gaugesFactory,
    bribesFactory,
    ve,
    veDist,
    voter,
    minter,
  ] = await Deploy.deployDystSystem(
    signer,
    MaticTestnetAddresses.WMATIC_TOKEN,
    voterTokens,
    claimants,
    claimantsAmounts,
    minterMax,
    FACTORY
  );

  const data = ''
    + 'token: ' + token.address + '\n'
    + 'gaugesFactory: ' + gaugesFactory.address + '\n'
    + 'bribesFactory: ' + bribesFactory.address + '\n'
    + 've: ' + ve.address + '\n'
    + 'veDist: ' + veDist.address + '\n'
    + 'voter: ' + voter.address + '\n'
    + 'minter: ' + minter.address + '\n'

  console.log(data);
  writeFileSync('tmp/core.txt', data);

  await Misc.wait(5);

  await Verify.verify(token.address);
  await Verify.verify(gaugesFactory.address);
  await Verify.verify(bribesFactory.address);
  await Verify.verifyWithArgs(ve.address, [token.address]);
  await Verify.verifyWithArgs(veDist.address, [ve.address]);
  await Verify.verifyWithArgs(voter.address, [ve.address, FACTORY, gaugesFactory.address, bribesFactory.address]);
  await Verify.verifyWithArgs(minter.address, [voter.address, ve.address, veDist.address]);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
