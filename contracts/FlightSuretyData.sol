pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
    uint256 constant MIN_AIRLINES_TO_VOTE = 4;
    uint256 constant MINIMUM_AIRLINE_FUNDING = 10 ether;
    uint256 constant MAX_INSURED_AMOUNT = 1 ether;

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false


    mapping(address => uint256) authorizedContracts;

    // Airlines
    uint256 public airlineCount = 0; 
    struct Airline {
        uint256 fund;
        uint256 voteCount;
        string airlineName;
        address airlineAddress;
        bool isActive;
        bool isRegistered;
    }
    mapping(address => Airline) private airlines;
    mapping(address => address[]) private airlineVotes;

    //Passengers
    struct Passenger {
        address passengerAddress;
        uint credit;
        mapping(string => uint) insuredFlights;
    }
     mapping(address => Passenger) private passengers;


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        authorizedContracts[msg.sender] = 1;

        airlines[msg.sender] = Airline({
                fund:0,
                voteCount:1,
                airlineName:"Owner Airline",
                airlineAddress: msg.sender,
                isActive: false,
                isRegistered: true
                }); 
        airlineCount = 1;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    modifier requirePaymentInRange()
    {
        require(msg.value > 0, "Caller did not send any funds.");
        require(msg.value <= MAX_INSURED_AMOUNT, "Requested insurance amount is beyond limit");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    function getAirlineVotes(address airline) public view returns (address[]) {
        return (airlineVotes[airline]);
    }

    modifier requireHasNotVoted(address airlineAddress, address voterAddress) 
    {

        bool hasVoted = false;

        address[] voters = airlineVotes[airlineAddress];

        for (uint i = 0; i < voters.length; i++) {
            if(voters[i] == voterAddress){
                hasVoted = true;
            }
        }
        
        require(!hasVoted, "You have already voted for this airline.");  
        _;
    }

    modifier requireNotActive(address account) 
    {
        require(!airlines[account].isActive, "Airline is already active.");  
        _;
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier isCallerAuthorized()
    {
        require(authorizedContracts[msg.sender] == 1, "Caller is not authorized");
        _;
    }

    function authorizeContract(address dataContract) external requireContractOwner{
        authorizedContracts[dataContract] = 1;
    }

    function deauthorizeContract(address dataContract) external requireContractOwner{
        delete authorizedContracts[dataContract];
    }

    function isAirlineActive(address airlineAddress) public view returns(bool){
        return airlines[airlineAddress].isActive;
    }

    function isAirlineRegistered(address airlineAddress) public view returns(bool){
        return airlines[airlineAddress].isRegistered;
    }
    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }

    function isContractAuthorized(address contractAddress) 
                            external 
                            view
                            returns(bool) 
    {
        return (authorizedContracts[contractAddress] == 1);
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (
                                address airlineAddress,
                                string airlineName,
                                address voterAddress
                            )
                            external
                            requireHasNotVoted(airlineAddress, voterAddress)
                            requireNotActive(airlineAddress)
                            isCallerAuthorized
                            returns(bool success)
    {
        airlineVotes[airlineAddress].push(msg.sender);

        // First 4 airlines can register directly
        if(airlineCount < MIN_AIRLINES_TO_VOTE){
            require(airlines[airlineAddress].voteCount == 0, "Airline is already registered but not funded.");
            airlines[airlineAddress] = Airline({
                fund:0,
                voteCount:1,
                airlineName:airlineName,
                airlineAddress:airlineAddress,
                isActive: false,
                isRegistered: true
            });
            airlineCount++;     
        }else{
            // Add vote to this airline
            if(airlines[airlineAddress].voteCount==0){
                airlines[airlineAddress] = Airline({
                fund:0,
                voteCount:1,
                airlineName:airlineName,
                airlineAddress:airlineAddress,
                isActive: false,
                isRegistered: false
            });
            airlineCount++; 
            }else{
                airlines[airlineAddress].voteCount++;
                // Register airline if enough votes
                if(airlines[airlineAddress].voteCount>=airlineCount.div(2) && airlines[airlineAddress].isRegistered==false){
                    airlines[airlineAddress].isRegistered = true;
                }
            }


        }
        return true;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (     
                                string flightId                     
                            )
                            external
                            payable
                            requireIsOperational
                            requirePaymentInRange
    {
        // Create passenger if it does not exist
        if(passengers[msg.sender].passengerAddress != msg.sender){
            passengers[msg.sender] = Passenger({passengerAddress: msg.sender, credit: 0});
        }

        // Store insured value and transfer
        passengers[msg.sender].insuredFlights[flightId] = msg.value;
        msg.sender.transfer(msg.value);
    }

    function getInsuredAmount
                            (     
                                string flightId                     
                            )
                            external
                            view
                            requireIsOperational
                            returns(uint256)
    {
        return passengers[msg.sender].insuredFlights[flightId];
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                )
                                external
                                pure
    {
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund
                            (
                                address payerAddress,
                                uint amount
                            )
                            public
                            payable
                            requireIsOperational
    {
        airlines[payerAddress].fund = airlines[payerAddress].fund.add(amount);
        if(airlines[payerAddress].fund>=MINIMUM_AIRLINE_FUNDING && !airlines[payerAddress].isActive){
            airlines[payerAddress].isActive = true;
        }
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund(msg.sender, msg.value);
    }


}

