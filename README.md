# Moeda fundraiser contracts

To run the tests you need a recent version of node (probably at least 7.7.x) as this project is using async/await, and some ES2015+ syntax.

To run the testsuite:
```
npm install
npm test
```

Note that just running `truffle test` with testrpc normally will not work, because the default balances of the accounts testrpc generates are too low for some of the tests.

Furthermore if you want to run using `truffle test` you need to make sure that your testrpc instance is:

1. Running on port 8945
2. Has at least 4 accounts

### Known issues

* The test suite sometimes crashes due to a snapshot bug in ethereumjs-testrpc.
