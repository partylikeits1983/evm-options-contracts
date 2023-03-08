# on chain options contracts


## To Run Tests

### 1) Fork Mainnet:

```sh
npx hardhat node
```

### 2) Deploy v1-core to mainnet fork:

```sh
npx hardhat --network localhost test test/deploy/newDeploy.test.js
```

#### Code Coverage 

```sh
npx hardhat coverage --testfiles "test/v1_tests.test.js""
```
