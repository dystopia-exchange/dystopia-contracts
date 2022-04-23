## Dystopia
[![codecov](https://codecov.io/gh/dystopia-exchange/dystopia-contracts/branch/master/graph/badge.svg?token=U94WAFLRT7)](https://codecov.io/gh/dystopia-exchange/dystopia-contracts)


Dystopia allows low cost, near 0 slippage trades on uncorrelated or tightly correlated assets. The protocol incentivizes fees instead of liquidity. Liquidity providers (LPs) are given incentives in the form of `token`, the amount received is calculated as follows;

* 100% of weekly distribution weighted on votes from ve-token holders

The above is distributed to the `gauge` (see below), however LPs will earn between 40% and 100% based on their own ve-token balance.

LPs with 0 ve* balance, will earn a maximum of 40%.

## AMM

What differentiates Dystopia's AMM;

Dystopia AMMs are compatible with all the standard features as popularized by Uniswap V2, these include;

* Lazy LP management
* Fungible LP positions
* Chained swaps to route between pairs
* priceCumulativeLast that can be used as external TWAP
* Flashloan proof TWAP
* Direct LP rewards via `skim`
* xy>=k

Dystopia adds on the following features;

* 0 upkeep 30 minute TWAPs. This means no additional upkeep is required, you can quote directly from the pair
* Fee split. Fees do not auto accrue, this allows external protocols to be able to profit from the fee claim
* New curve: x3y+y3x, which allows efficient stable swaps
* Curve quoting: `y = (sqrt((27 a^3 b x^2 + 27 a b^3 x^2)^2 + 108 x^12) + 27 a^3 b x^2 + 27 a b^3 x^2)^(1/3)/(3 2^(1/3) x) - (2^(1/3) x^3)/(sqrt((27 a^3 b x^2 + 27 a b^3 x^2)^2 + 108 x^12) + 27 a^3 b x^2 + 27 a b^3 x^2)^(1/3)`
* Routing through both stable and volatile pairs
* Flashloan proof reserve quoting

## token

**TBD**

## ve-token

Vested Escrow (ve), this is the core voting mechanism of the system, used by `BaseV1Factory` for gauge rewards and gauge voting.

This is based off of ve(3,3)

* `deposit_for` deposits on behalf of
* `emit Transfer` to allow compatibility with third party explorers
* balance is moved to `tokenId` instead of `address`
* Locks are unique as NFTs, and not on a per `address` basis

```
function balanceOfNFT(uint) external returns (uint)
```

## BaseV1Pair

Base V1 pair is the base pair, referred to as a `pool`, it holds two (2) closely correlated assets (example MIM-UST) if a stable pool or two (2) uncorrelated assets (example FTM-SPELL) if not a stable pool, it uses the standard UniswapV2Pair interface for UI & analytics compatibility.

```
function mint(address to) external returns (uint liquidity)
function burn(address to) external returns (uint amount0, uint amount1)
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external
```

Functions should not be referenced directly, should be interacted with via the BaseV1Router

Fees are not accrued in the base pair themselves, but are transfered to `BaseV1Fees` which has a 1:1 relationship with `BaseV1Pair`

### BaseV1Factory

Base V1 factory allows for the creation of `pools` via ```function createPair(address tokenA, address tokenB, bool stable) external returns (address pair)```

Base V1 factory uses an immutable pattern to create pairs, further reducing the gas costs involved in swaps

Anyone can create a pool permissionlessly.

### BaseV1Router

Base V1 router is a wrapper contract and the default entry point into Stable V1 pools.

```

function addLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint amountADesired,
    uint amountBDesired,
    uint amountAMin,
    uint amountBMin,
    address to,
    uint deadline
) external ensure(deadline) returns (uint amountA, uint amountB, uint liquidity)

function removeLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint liquidity,
    uint amountAMin,
    uint amountBMin,
    address to,
    uint deadline
) public ensure(deadline) returns (uint amountA, uint amountB)

function swapExactTokensForTokens(
    uint amountIn,
    uint amountOutMin,
    route[] calldata routes,
    address to,
    uint deadline
) external ensure(deadline) returns (uint[] memory amounts)

```

## Gauge

Gauges distribute arbitrary `token(s)` rewards to BaseV1Pair LPs based on voting weights as defined by `ve` voters.

Arbitrary rewards can be added permissionlessly via ```function notifyRewardAmount(address token, uint amount) external```

Gauges are completely overhauled to separate reward calculations from deposit and withdraw. This further protect LP while allowing for infinite token calculations.

Previous iterations would track rewardPerToken as a shift everytime either totalSupply, rewardRate, or time changed. Instead we track each individually as a checkpoint and then iterate and calculation.

## Bribe

Gauge bribes are natively supported by the protocol, Bribes inherit from Gauges and are automatically adjusted on votes.

Users that voted can claim their bribes via calling ```function getReward(address token) public```

Fees accrued by `Gauges` are distributed to `Bribes`

### BaseV1Voter

Gauge factory permissionlessly creates gauges for `pools` created by `BaseV1Factory`. Further it handles voting for 100% of the incentives to `pools`.

```
function vote(address[] calldata _poolVote, uint[] calldata _weights) external
function distribute(address token) external
```

### veNFT distribution recipients

| Name | Address | Qty |
| :--- | :--- | :--- |


### Mumbai deployment

| Name | Address |
| :--- | :--- |
| wMATIC| [0xe02f20BB33F8Bfb48eB907523435CA886e139A08](https://mumbai.polygonscan.com/address/0xe02f20BB33F8Bfb48eB907523435CA886e139A08#code) |
| USDT| [0x801FC386bd0a7998EE162ffF32b793D0624f3476](https://mumbai.polygonscan.com/address/0x801FC386bd0a7998EE162ffF32b793D0624f3476#code) |
| MIM | [0xe0695CD828B63C0E4b70fdD44d0f066560EE8CfE](https://mumbai.polygonscan.com/address/0xe0695CD828B63C0E4b70fdD44d0f066560EE8CfE#code) |
| DAI | [0x1ac7b60D5dDeB00DF64C992c8c760463250Ca158](https://mumbai.polygonscan.com/address/0x1ac7b60D5dDeB00DF64C992c8c760463250Ca158#code) |
| BaseV1 | [0x8a78e8F5784bD604687478475C59F85f468d35c3](https://mumbai.polygonscan.com/address/0x8a78e8F5784bD604687478475C59F85f468d35c3#code) |

| Name                    | Address |
|:------------------------| :--- |
| DystFactory             | [0xD0692d6C30cd7a383f227Ba1cB28EeCE2F050926](https://mumbai.polygonscan.com/address/0xD0692d6C30cd7a383f227Ba1cB28EeCE2F050926#code) |
| DystRouter01            | [0xe9EdEb5576ea876014e76A496B4c564756ddDAEF](https://mumbai.polygonscan.com/address/0xe9EdEb5576ea876014e76A496B4c564756ddDAEF#code) |
| GovernanceTreasury      | [0x463cA34bC5530819EE1467A18C1c48a1bB306B74](https://mumbai.polygonscan.com/address/0x463cA34bC5530819EE1467A18C1c48a1bB306B74#code) |
| BribeFactory            | [0x9205cd74cB212DE16244674C81B9e508B2e72e39](https://mumbai.polygonscan.com/address/0x9205cd74cB212DE16244674C81B9e508B2e72e39#code) |
| GaugesFactory           | [0xDC5655BF9f0ED15F46376Dc01F9D835705CDb7c5](https://mumbai.polygonscan.com/address/0xDC5655BF9f0ED15F46376Dc01F9D835705CDb7c5#code) |
| DYST                    | [0x6E511b6fAce2c5094163A1F420135a4D70a5ecd7](https://mumbai.polygonscan.com/address/0x6E511b6fAce2c5094163A1F420135a4D70a5ecd7#code) |
| DystMinter              | [0xc3236222E4CA98D3406D9Acc9198A9D4cAc50b30](https://mumbai.polygonscan.com/address/0xc3236222E4CA98D3406D9Acc9198A9D4cAc50b30#code) |
| DystVoter               | [0xECACDAcf3b6c23E180f70cF28b6811652e6808e7](https://mumbai.polygonscan.com/address/0xECACDAcf3b6c23E180f70cF28b6811652e6808e7#code) |
| Ve                      | [0x043074eaAf5DCca960601b7B464FCd2bEC34df1D](https://mumbai.polygonscan.com/address/0x043074eaAf5DCca960601b7B464FCd2bEC34df1D#code) |
| VeDist                  | [0x67fef6a7908Faf1d89B659b9bbE76D82837Ee6E2](https://mumbai.polygonscan.com/address/0x67fef6a7908Faf1d89B659b9bbE76D82837Ee6E2#code) |
| Migrator                | [0x434B01D3E005cce37607D0D029BE72679cdA7521](https://mumbai.polygonscan.com/address/0x434B01D3E005cce37607D0D029BE72679cdA7521#code) |


