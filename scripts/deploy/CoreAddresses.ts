import {
  Dyst,
  BaseV1BribeFactory,
  BaseV1Factory,
  BaseV1GaugeFactory, DystMinter,
  BaseV1Router01, BaseV1Voter, GovernanceTreasury, Ve, VeDist
} from "../../typechain";

export class CoreAddresses {

  readonly token: Dyst;
  readonly gaugesFactory: BaseV1GaugeFactory;
  readonly bribesFactory: BaseV1BribeFactory;
  readonly factory: BaseV1Factory;
  readonly router: BaseV1Router01;
  readonly ve: Ve;
  readonly veDist: VeDist;
  readonly voter: BaseV1Voter;
  readonly minter: DystMinter;
  readonly treasury: GovernanceTreasury;


  constructor(token: Dyst, gaugesFactory: BaseV1GaugeFactory, bribesFactory: BaseV1BribeFactory, factory: BaseV1Factory, router: BaseV1Router01, ve: Ve, veDist: VeDist, voter: BaseV1Voter, minter: DystMinter, treasury: GovernanceTreasury) {
    this.token = token;
    this.gaugesFactory = gaugesFactory;
    this.bribesFactory = bribesFactory;
    this.factory = factory;
    this.router = router;
    this.ve = ve;
    this.veDist = veDist;
    this.voter = voter;
    this.minter = minter;
    this.treasury = treasury;
  }
}
