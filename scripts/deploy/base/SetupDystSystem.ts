import {Deploy} from "../Deploy";
import {ethers} from "hardhat";
import {Verify} from "../../Verify";
import {Misc} from "../../Misc";
import {BigNumber} from "ethers";
import {MaticTestnetAddresses} from "../../addresses/MaticTestnetAddresses";
import {writeFileSync} from "fs";
import {parseUnits} from "ethers/lib/utils";
import {MaticAddresses} from "../../addresses/MaticAddresses";


const voterTokens = [
  MaticAddresses.WMATIC_TOKEN,
  MaticAddresses.WETH_TOKEN,
  MaticAddresses.USDC_TOKEN,
  MaticAddresses.WBTC_TOKEN,
  MaticAddresses.FRAX_TOKEN,
  MaticAddresses.DAI_TOKEN,
  MaticAddresses.USDT_TOKEN,
  MaticAddresses.UST_TOKEN,
  MaticAddresses.MAI_TOKEN,
];

const claimants = [
  "0x342952B86Bea9F2225f14D9f0dddDE070D1d0cC1",
  "0xDCB5A4b6Ee39447D700F4FA3303B1d1c25Ea9cA7",
  "0x342952B86Bea9F2225f14D9f0dddDE070D1d0cC1", // instead of UST guys we temporally sent it to Polygon DAO
  "0x3FEACf904b152b1880bDE8BF04aC9Eb636fEE4d8",
  "0xD4151c984e6CF33E04FFAAF06c3374B2926Ecc64",
  "0x59cbff972fe0c19c881354a9cde52aca704da848",
  "0xe37dD9A535c1D3c9fC33e3295B7e08bD1C42218D",
  "0xa2722e04A1C70756AD297695e3c409507dc01341",
  "0xeEc0974A7DBD8341A0aA07Ea95C61745aa691Cd9",
  "0x3F2c32b452c235218d6e1c3988E4B1F5F74afD4a",
  "0x3f81e3d58ff74B8b692e4936c310D3A5f333cF28",
  "0xe96DAADd5d03F2f067965a466228f6D2CF4b3bD2",
  "0x2709fa6FA31BD336455d4F96DdFC505b3ACA5A68",
  "0x65A5076C0BA74e5f3e069995dc3DAB9D197d995c",
  "0xb26adCEE4aDE6812b036b96d77A7E997Ddd0F611",
  "0xd6f81D154D0532906140ef37268BC8eD2A17e008",
  "0x4A0b0189035D3d710aa9DA8a13174Dd904c77148",
  "0xe0c92587b8b2C1a8Bd069F1f0eB990fD42a2198F",
  "0x6e321232bD0C4A223355B06eB6BeFB9975f5618e",
  "0x3feE50d2888F2F7106fcdC0120295EBA3ae59245",
  "0xB63428448De118A7A6B6622556BaDAcB409eA961",
  "0xC1B43205C21071aF382587f9519d238240d8B4F3",
  "0x20D61737f972EEcB0aF5f0a85ab358Cd083Dd56a",
  "0xaA8B91ba8d78A0dc9a74FaBc54B6c4CC76191B0c",
  "0xBdD38B2eaae34C9FCe187909e81e75CBec0dAA7A",
  "0xcc16d636dD05b52FF1D8B9CE09B09BC62b11412B",
  "0x42B5bb174CfA09012581425EAF62De1d1185ac7C",
  "0x4F64c22FB06ab877Bf63f7064fA21C5c51cc85bf",
  "0xcc7b93e2aa199785ebd57ca563ecea7314afa875",
  "0x929A27c46041196e1a49C7B459d63eC9A20cd879",
];

const claimantsAmounts = [
  parseUnits("10000000"),
  parseUnits("3000000"),
  parseUnits("1000000"),
  parseUnits("1000000"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
  parseUnits("192307.6923"),
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
    FACTORY,
    1
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
