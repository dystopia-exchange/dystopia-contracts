import {
  BaseV1,
  BaseV1BribeFactory,
  BaseV1Factory,
  BaseV1GaugeFactory, BaseV1Minter,
  BaseV1Router01, BaseV1Voter, Ve, VeDist
} from "../../typechain";

export class CoreAddresses {

  readonly token: BaseV1;
  readonly gaugesFactory: BaseV1GaugeFactory;
  readonly bribesFactory: BaseV1BribeFactory;
  readonly factory: BaseV1Factory;
  readonly router: BaseV1Router01;
  readonly ve: Ve;
  readonly veDist: VeDist;
  readonly voter: BaseV1Voter;
  readonly minter: BaseV1Minter;


  constructor(token: BaseV1, gaugesFactory: BaseV1GaugeFactory, bribesFactory: BaseV1BribeFactory, factory: BaseV1Factory, router: BaseV1Router01, ve: Ve, veDist: VeDist, voter: BaseV1Voter, minter: BaseV1Minter) {
    this.token = token;
    this.gaugesFactory = gaugesFactory;
    this.bribesFactory = bribesFactory;
    this.factory = factory;
    this.router = router;
    this.ve = ve;
    this.veDist = veDist;
    this.voter = voter;
    this.minter = minter;
  }
}
