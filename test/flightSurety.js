
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeContract(config.flightSuretyApp.address, {from: config.owner});
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it(`App contract is authorized in data contract`, async function () {

    let result = await config.flightSuretyData.isContractAuthorized.call(config.flightSuretyApp.address);
    assert.equal(result, true, "app contract is not authorized");

});

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, "second airline", {from: config.firstAirline});
    }
    catch(e) {
        console.log(e);
    }
    let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline); 

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });

  it('Funded airline can register another airline directly if there are 4 or less registered airline', async () => {
    
    // ARRANGE
    let newAirline = config.firstAirline;
    await config.flightSuretyData.fund({from: config.owner, value: 10*10**18});

  

    await config.flightSuretyApp.registerAirline(newAirline, "second airline", {from: config.owner});

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, "second airline", {from: config.owner});
    }
    catch(e) {
        console.log(e);
    }
    
    // ASSERT
    let airlinesCount = await config.flightSuretyData.airlineCount.call();
    assert.equal(airlinesCount, 2, "Incorrect number of registered airlines");

    let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline); 
    assert.equal(result, true, "Airline should not be able to register another airline if it hasn't provided funding");

  });

  it('Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines', async () => {
    
    // ACT
    try {
        await config.flightSuretyApp.registerAirline(accounts[3], "third airline", {from: config.owner});
        await config.flightSuretyApp.registerAirline(accounts[4], "fourth airline", {from: config.owner});
        await config.flightSuretyApp.registerAirline(accounts[5], "fifth airline", {from: config.owner});
    }
    catch(e) {
        console.log(e);
    }
    
    // ASSERT
    let airlinesCount = await config.flightSuretyData.airlineCount.call();
    assert.equal(airlinesCount, 5, "Incorrect number of registered airlines");

    let result = await config.flightSuretyData.isAirlineRegistered.call(accounts[5]); 
    assert.equal(result, false, "5th airline should not be registered without consensus");

    // ARRANGE
    // Fund airlines and let them vote for the 5th airline
    await config.flightSuretyData.fund({from: accounts[3], value: 10*10**18});
    await config.flightSuretyData.fund({from: accounts[4], value: 10*10**18});
    await config.flightSuretyApp.registerAirline(accounts[5], "", {from: accounts[3]});
    await config.flightSuretyApp.registerAirline(accounts[5], "", {from: accounts[4]});

    // ASSERT
    let consented_result = await config.flightSuretyData.isAirlineRegistered.call(accounts[5]); 
    assert.equal(consented_result, true, "5th airline should be registered with consensus");
    
  });

  it('Airline can register flight', async () => {
    try {
        await config.flightSuretyApp.registerFlight("SQ123", "Singapore", Math.floor(Date.now() / 1000), {from: config.firstAirline});
    }
    catch(e) {
      console.log(e);
    }
  });

  it("Passenger can pay up to 1 ether for purchasing flight insurance.", async () => {
  
    try {
        await config.flightSuretyData.buy("SQ123", {from: config.firstPassenger, value: 1.0 * 10**18});
    }
    catch(e) {
      console.log(e);
    }

    let insuredAmount = await config.flightSuretyData.getInsuredAmount("SQ123", {from: config.firstPassenger}); 
    assert.equal(insuredAmount, 1.0 * 10**18, "Passenger should have purchased insurnace");
  });

  it("Upon startup, 20 oracles are registered and their assigned indexes are persisted in memory", async () => {

    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for(let a=10; a < 30; a++) {      
        await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee});
      let result = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
    //   console.log(`Oracle Registered ${a}: ${result}`);
      assert.equal(result.length, 3, 'Oracle did not return 3 indexes');
    }
  });


  it("Server will loop through all registered oracles, identify those oracles for which the OracleRequest event applies," +
  "and respond by calling into FlightSuretyApp contract with random status code of Unknown (0), On Time (10) or Late Airline" + 
  "(20), Late Weather (30), Late Technical (40), or Late Other (50)", async () => {
    // ARRANGE
    let flight = 'SQ123';
    let timestamp = Math.floor(Date.now() / 1000); //convert to seconds

    // Generate a request for oracles to fetch flight information
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);

    for(let a=10; a < 30; a++) {
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes({from: accounts[a]});
      for(let idx=0;idx<3;idx++) {
        try {
          // Loop through the oracles until a index match is found
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, 20, { from: accounts[a] });
        } catch(e) {
            // console.log(e);
        }
      }
    }
    let flightStatus = await config.flightSuretyApp.checkFlightStatus(flight, {from: config.firstAirline});
    assert.equal(flightStatus, 20, 'flight status should be Late Airline (20)');
  });

  it("If flight is delayed due to airline fault, passenger receives credit of 1.5X the amount they paid", async () => {
    let passengerCredit = await config.flightSuretyData.getPassengerCredit.call({from: config.firstPassenger}); 
    assert.equal(passengerCredit, 1.5 * 10**18, "Passenger should have 1.5 eth as part of late flight payout");
  });
  
  it("(passenger) can withdraw any funds owed to them as a result of receiving credit for insurance payout", async () => {

    let withdrawStatus = await config.flightSuretyData.withdraw({from: config.firstPassenger});
    assert.equal(withdrawStatus.receipt.status,  true, "Passenger should be able to withdraw credits.");

  });



});
