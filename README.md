# Moeda crowdsale contracts

To run the tests you need a recent version of node (probably at least 7.7.x) as we're using
async/await, and some es6 syntax.

To run the testsuite:
```
npm install
npm test
```

Note that just running `truffle test` with testrpc normally will not work, because the default balances of the accounts testrpc generates are too low for some of the tests.