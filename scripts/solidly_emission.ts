import {appendFileSync, writeFileSync} from "fs";
import {ethers, web3} from "hardhat";
import {
  Dyst__factory, DystMinter__factory,
  Ve__factory,
  IOldMinter__factory
} from "../typechain";
import {formatUnits} from "ethers/lib/utils";
import {Misc} from "./Misc";
import {BigNumber} from "ethers";

async function main() {
  const signer = (await ethers.getSigners())[0];

  const file = 'tmp/solidly.txt'
  writeFileSync(file, 'id;date;tokenSupply;veSupply;trueCircSupply;weekly;veDistReceived\n');

  // const week = 30 * 60 * 24 * 7;
  let block = 30_512_600;

  const minter = '0xC4209c19b183e72A037b2D1Fb11fbe522054A90D'
  const token = '0x888EF71766ca594DED1F0FA3AE64eD2941740A20'
  const ve = '0xcBd8fEa77c2452255f59743f55A3Ea9d83b3c72b'
  const veDist = '0xA5CEfAC8966452a78d6692837b2ba83d19b57d07'

  const logs = await parseLogs(
    [minter],
    ['0xb4c03061fb5b7fed76389d5af8f2e0ddb09f8c70d1333abbb62582835e10accb'],
    block,
    await ethers.provider.getBlockNumber()
  );


  for (let i = 0; i < logs.length; i++) {
    const log = IOldMinter__factory.createInterface().parseLog(logs[i]);
    block = logs[i].blockNumber;
    const date = new Date((await ethers.provider.getBlock(block)).timestamp * 1000);
    const tokenSupply = await Dyst__factory.connect(token, signer).totalSupply({blockTag: block});
    const veSupply = await Ve__factory.connect(ve, signer).totalSupply({blockTag: block});

    const transfers = await parseLogs(
      [token],
      [Dyst__factory.createInterface().getEventTopic('Transfer')],
      block - 1,
      block + 1
    );
    let veDistReceived = '-1';
    for (const transfer of transfers) {
      const l = Dyst__factory.createInterface().parseLog(transfer);
      if ((l.args[1] as string).toLowerCase() === veDist.toLowerCase()) {
        veDistReceived = formatUnits(l.args[2]);
      }
    }
    const minterBalance = await Dyst__factory.connect(token, signer).balanceOf(minter, {blockTag: block});
    const trueCircSupply = BigNumber.from(log.args[2]).sub(minterBalance);
    const weekly = log.args[1];

    const data = '' +
      `${i};` +
      `${date};` +
      `${formatUnits(tokenSupply)};` +
      `${formatUnits(veSupply)};` +
      `${formatUnits(trueCircSupply)};` +
      `${formatUnits(weekly)};` +
      `${veDistReceived};` +
      '\n';
    console.log(data);
    appendFileSync(file, data);
    // block += week;
  }


}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });


async function parseLogs(contracts: string[], topics: string[], start: number, end: number, step = 3_000) {
  const logs = [];

  console.log('parseLogs', start, end);
  let from = start;
  let to = start + step;
  while (true) {
    try {
      logs.push(...(await web3.eth.getPastLogs({
        fromBlock: from,
        toBlock: to,
        address: contracts,
        "topics": topics
      })));

      console.log('logs', from, to, logs.length);

      from = to;
      to = Math.min(from + step, end);

      if (from >= end) {
        break;
      }
    } catch (e) {
      console.log('Error fetch logs', e);
      await Misc.delay(1000);
    }
  }

  return logs;
}
