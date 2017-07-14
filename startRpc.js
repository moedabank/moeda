const testrpc = require('ethereumjs-testrpc');

const megaBalance = '57896044618658097711785492504343953926634992332820282019728792003956564819968';
const options = {
  port: '8945',
  accounts: [
    {
      secretKey: '0xe044d40b04c0f0e37f55b0300bf902bbc7c531cff159414c8b03fd176ec92425',
      balance: megaBalance
    },
    {
      secretKey: '0xcd1490b7af6ffe446fdc467188de20961d20b046b446e3293a57edc4fb51b941',
      balance: megaBalance
    },
    {
      secretKey: '0x0b51db8774a16e138d18ac73e0bd8551cd9b807ac9b88c4b8ddbbd3fc173be53',
      balance: megaBalance
    },
    {
      secretKey: '0xfc689157bedd55b843c63e2d1d8d725be99a8daaa434f5863405ad70489075cb',
      balance: megaBalance
    },
    {
      secretKey: '0xf286a77b93cef502684d2a2c9cbc1d242ec50b06cf5b2d9f152100a4969abe47',
      balance: megaBalance
    },
  ],
};
const server = testrpc.server(options);

server.listen(options.port, (err, state) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log('TestRPC server started.');
  if (typeof process.send === 'function') {
    process.send('server running');
  }
});
