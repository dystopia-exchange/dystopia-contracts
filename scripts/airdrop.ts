import {ethers, web3} from "hardhat";
import {formatUnits} from "ethers/lib/utils";
import {Dyst__factory, DystPair__factory, Ve__factory} from "../typechain";
import {BigNumber} from "ethers";
import {Misc} from "./Misc";

const VE = '0x060fa7aD32C510F12550c7a967999810dafC5697'.toLowerCase();
const DYST = '0x39aB6574c289c3Ae4d88500eEc792AB5B947A5Eb'.toLowerCase();
const ROUTER = '0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e'.toLowerCase();
const ELIGIBLE_TIME = 94608000;

const buySources = new Set<string>([
  '0x11637b94Dfab4f102c21fDe9E34915Bb5F766A8a'.toLowerCase(), // ms2
  '0x1111111254fb6c44bAC0beD2854e76F90643097d'.toLowerCase(), // 1inch
  '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57'.toLowerCase(), // paraswap
  '0xB099ED146fAD4d0dAA31E3810591FC0554aF62bB'.toLowerCase(), // bogged
  '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64'.toLowerCase(), // openocean
  ROUTER, // dystopia router
  // '0x1e08a5b6a1694bc1a65395db6f4c506498daa349'.toLowerCase(), // wmatic/dyst
]);

const EXCLUDE_LOCKERS = new Set<string>([
  '0x58e06181394444fE18C9D794b794c8fBAf3118D9'.toLowerCase(),
])

const MAIN_PAIRS = [
  '0x1e08a5b6a1694bc1a65395db6f4c506498daa349'.toLowerCase(),
  '0xf1ef6f306b2694c706929752b79231e365ee608f'.toLowerCase(),
  '0x370c7feb6fcd9f0804b477e3c807392e59327764'.toLowerCase(),
  '0xfdf8dcd97100a0a5cc36d6b4de12fb90517240b8'.toLowerCase(),
  '0xe3edf1225371afeeeaa11e641b256a7c1c585450'.toLowerCase(),
]

async function main() {

  const START = 33020919;
  // const END = 33051441;
  const END = await ethers.provider.getBlockNumber();

  const dystTransferTopic = Dyst__factory.createInterface().getEventTopic("Transfer");
  const veLockTopic = Ve__factory.createInterface().getEventTopic("Deposit");

  const transferLogs = await parseLogs(
    [DYST],
    [dystTransferTopic],
    START,
    END
  );

  const lockLogs = await parseLogs(
    [VE],
    [veLockTopic],
    START,
    END
  );


  const dystRecievers = new Map<string, BigNumber>();
  const holdersLocked = new Map<string, BigNumber>();

  for (const log of lockLogs) {
    const logParsed = Ve__factory.createInterface().parseLog(log);
    const provider = logParsed.args.provider.toLowerCase();
    const amount = logParsed.args.value;
    const locktime = logParsed.args.locktime.toNumber() - Math.floor(Date.now() / 1000);

    if (locktime > ELIGIBLE_TIME && !EXCLUDE_LOCKERS.has(provider.toLowerCase())) {
      const isEOA = !(await isContract(provider));
      if (isEOA) {
        // console.log("Lock", provider, log.transactionHash, formatUnits(amount), (locktime / 60 / 60 / 24 / 365).toFixed(2));
        const locked = holdersLocked.get(provider.toLowerCase()) ?? BigNumber.from(0)
        holdersLocked.set(provider.toLowerCase(), locked.add(amount));
      }
    }
  }
  console.log('-------------------------')

  for (const log of transferLogs) {
    const logParsed = Dyst__factory.createInterface().parseLog(log);
    const from = logParsed.args.from.toLowerCase();
    const to = logParsed.args.to.toLowerCase();
    const amount = logParsed.args.value;

    const locked = holdersLocked.get(to.toLowerCase()) ?? BigNumber.from(0);

    if (!locked.isZero()) {
      // console.log(from, to, formatUnits(amount), log.transactionHash);
      const tx = await ethers.provider.getTransaction(log.transactionHash);
      const calledContract = (tx.to ?? '').toLowerCase();

      if (buySources.has(calledContract)) {

        if (calledContract === ROUTER) {
          let isBurn = false;
          for (const pair of MAIN_PAIRS) {
            isBurn = await checkBurn(pair, log.blockNumber, to)
            if (isBurn) {
              break;
            }
          }

          if (isBurn) {
            continue;
          }
        }

        const has = dystRecievers.get(to.toLowerCase()) ?? BigNumber.from(0);
        // console.log('Add to exist', from, to, formatUnits(has), formatUnits(amount), log.transactionHash);
        dystRecievers.set(to.toLowerCase(), has.add(amount));
      }
      if (dystRecievers.has(from.toLowerCase()) && to.toLowerCase() !== VE.toLowerCase()) {
        const has = (dystRecievers.get(from.toLowerCase()) ?? BigNumber.from(0));
        // console.log('Substract from exist',from, to, formatUnits(has), formatUnits(amount), log.transactionHash);
        dystRecievers.set(from.toLowerCase(), has.sub(amount))
      }
    }
  }

  console.log('-------------------------')


  for (const locker of Array.from(holdersLocked.keys())) {
    const bought = dystRecievers.get(locker.toLowerCase()) ?? BigNumber.from(0);
    const locked = dystRecievers.get(locker) ?? BigNumber.from(0);
    if (!locked.isZero() && locked.gt(bought)) {
      console.log(`Locked more than bought! Locker: ${locker} Locked: ${formatUnits(locked)}, Bought: ${formatUnits(bought)}`);
    }
  }
  console.log('-------------------------')


  for (const holder of Array.from(dystRecievers.keys())) {
    const bought = dystRecievers.get(holder) ?? BigNumber.from(0);
    const lockAmount = holdersLocked.get(holder.toLowerCase()) ?? BigNumber.from(0);
    // const isEOA = !(await isContract(holder))
    const isEOA = true;
    if (lockAmount.gt(0) && isEOA) {
      // console.log(`Recieved DYST ${holder} Amount: ${formatUnits(bought)} Locked: ${formatUnits(lockAmount)}`);
      console.log(holder, Math.min(+formatUnits(bought), +formatUnits(lockAmount)));
    }
  }


}

async function checkBurn(pair: string, block: number, sender: string) {
  const burnTopic = DystPair__factory.createInterface().getEventTopic("Burn");
  const burn = (await parseLogs([pair], [burnTopic], block, block))
    .map(l => DystPair__factory.createInterface().parseLog(l))
    .filter(l => l.args.to.toLowerCase() === sender.toLowerCase())[0];
  if (burn) {
    // console.log('Remove liquidity', sender, block);
    return true;
  }
  return false
}

async function checkSwap(pair: string, block: number, sender: string) {
  const topic = DystPair__factory.createInterface().getEventTopic("Swap");
  const burn = (await parseLogs([pair], [topic], block, block))
    .map(l => DystPair__factory.createInterface().parseLog(l))
    .filter(l => l.args.to.toLowerCase() === sender.toLowerCase())[0];
  if (burn) {
    console.log('Direct Swap', sender, block);
    return true;
  }
  return false
}

async function isContract(adr: string) {
  try {
    const code = await ethers.provider.getCode(adr);
    if (code !== '0x') return true;
  } catch (error) {
  }
  return false;
}

async function parseLogs(contracts: string[], topics: string[], start: number, end: number, step = 3_000) {
  const logs = [];

  // console.log('parseLogs', start, end);
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

      // console.log('logs', from, to, logs.length);

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


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
