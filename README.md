# Moeda crowdsale contracts

To run the tests you need a recent version of node (probably at least 7.7.x) as this project is using async/await, and some ES2015+ syntax.

To run the testsuite:
```
npm install
npm test
```

Note that just running `truffle test` with testrpc normally will not work, because the default balances of the accounts testrpc generates are too low for some of the tests.

### Known issues

* The test suite sometimes crashes due to a snapshot bug in ethereumjs-testrpc.

### ETH/USD

The ETH/USD rate in the contract will be updated during the sale via a script: https://github.com/erkmos/moeda-usd