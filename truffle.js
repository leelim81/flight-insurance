var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "ladder near session wear prepare ten staff purpose flower coil armor soccer";
// ganache-cli --gasLimit 500000000 --gasPrice 30000000000 --mnemonic "ladder near session wear prepare ten staff purpose flower coil armor soccer"

module.exports = {
  networks: {
    development: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      },
      network_id: '*',
      gas: 99999999
    }
  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};