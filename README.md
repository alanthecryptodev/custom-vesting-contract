# ruler-vesting

## Development
* run `npm install` to install all node dependencies
* run `npx hardhat compile` to compile

### Run Test With hardhat EVM (as [an independent node](https://hardhat.dev/hardhat-evm/#connecting-to-hardhat-evm-from-wallets-and-other-software))
* Run `npx hardhat node` to setup a local blockchain emulator in one terminal.
* `npx hardhat test --network localhost` run tests in a new terminal.
 **`npx hardhat node` restart required after full test run.** As the blockchain timestamp has changed.

## Deploy to Kovan Testnet
* Run `npx hardhat run scripts/deployCustomVesting.js --network kovan`

## Deploy to Mainnet
* Run `npx hardhat run scripts/deployCustomVesting.js --network mainnet`
