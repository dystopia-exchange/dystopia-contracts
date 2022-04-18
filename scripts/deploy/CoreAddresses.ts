import {
  Dyst,
  BribeFactory,
  DystFactory,
  GaugeFactory, DystMinter,
  DystRouter01, DystVoter, GovernanceTreasury, Ve, VeDist
} from "../../typechain";

export class CoreAddresses {

  readonly token: Dyst;
  readonly gaugesFactory: GaugeFactory;
  readonly bribesFactory: BribeFactory;
  readonly factory: DystFactory;
  readonly router: DystRouter01;
  readonly ve: Ve;
  readonly veDist: VeDist;
  readonly voter: DystVoter;
  readonly minter: DystMinter;
  readonly treasury: GovernanceTreasury;


  constructor(token: Dyst, gaugesFactory: GaugeFactory, bribesFactory: BribeFactory, factory: DystFactory, router: DystRouter01, ve: Ve, veDist: VeDist, voter: DystVoter, minter: DystMinter, treasury: GovernanceTreasury) {
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
