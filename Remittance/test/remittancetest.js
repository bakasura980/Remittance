var Remittance = artifacts.require("../contracts/Remittance.sol");
var ExchangeShop = artifacts.require("../contracts/ExchangeShop.sol");
require("../test/assertExtensions");
web3.utils = require('./utils.js');

contract("Remittance", async function(accounts){

    let owner = accounts[0];
    let alice = accounts[1];
    let bob = accounts[2];
    let remittanceInstance; 
    let remittanceAmount = 1000;
    let duration = 5;
    let password = { 
                     key1: "Lyubo",
                     key2: "obuyL" 
                   };
    
    //I need the first remittanceInstance with which i can test owner's withdraw due to duration
    let ownersWithdrawRemittance;
    
    describe("Remittance in a perfect way", function(){

        let remittanceConstructorParams;

        beforeEach(async function(){
            remittanceInstance = await Remittance.new(
                                                    bob, 
                                                    duration, 
                                                    "USD", 
                                                    password.key1, 
                                                    password.key2,
                                                    {from: owner, value: remittanceAmount}
                                                );
        });

        describe("Test constructor", async function(){

            it("should be owned by owner", async function(){
                ownersWithdrawRemittance = remittanceInstance;
                 
                let contractOwner = await remittanceInstance.owner({from: owner});
                assert.equal(contractOwner, owner, "Owner is not set correctly");
            });

            it("should set To correctly", async function(){
                let to = await remittanceInstance.to({from: owner});
                assert.equal(to, bob, "To is not set correctly");
            });

            it("should set balance correctly", async function(){
                let contractBalance = await web3.eth.getBalance(remittanceInstance.address);
                assert.equal(contractBalance, remittanceAmount, "Balance is not set correctly");
            });

            it("should set deadline expiration name correctly", async function(){
                let currentBlockNumber = web3.eth.blockNumber;
                let contractDeadline = await remittanceInstance.deadline({from: owner});
                assert.equal(
                                contractDeadline,
                                currentBlockNumber + duration, 
                                "Deadline expiration is not set correctly"
                            );
            });

            it("should set currency correctly", async function(){
                let contractCurrency = await remittanceInstance.currency({from: owner});
                assert.equal(web3.utils.hexToUtf8(contractCurrency), "USD", "Currency is not set correctly");
            });

        });
       
        describe("Test contract's methods", function(){

            let exchangeShopInstance;
            let currentRemittanceInstance;

            before(async function(){
                exchangeShopInstance = await ExchangeShop.new({from: owner});
                await exchangeShopInstance.addCurrency("USD", 10, {from: owner});
            });

            it("should set exchange shop correcly", async function(){
                currentRemittanceInstance = remittanceInstance;
                await assert.expectEvent( 
                    remittanceInstance.setExchangeShop(exchangeShopInstance.address ,{from: owner}),
                    {exchangeShopAddr: exchangeShopInstance.address},
                    "Exchange shop is not set correctly"
                );
            });

            it("should withdraw secure", async function(){

                // let remittanceKey = await currentRemittanceInstance.getKey({from: owner});
                // await exchangeShopInstance.addRemittance(currentRemittanceInstance.address, remittanceKey, {from: owner});
                
                // let tx = await exchangeShopInstance.unlockTrustedRemittance(password.key1, password.key2, {from: owner});
                // console.log(tx.logs);
               
            });
    
            it("should process owner's withdraw correctly", async function(){
                let currentBlockNumber = web3.eth.blockNumber + 1;
                await proceessWithdraw(owner, async function(){
                    return await assert.expectEvent(
                        ownersWithdrawRemittance.withdrawFunds({from: owner}),
                        { on: web3.toBigNumber(currentBlockNumber) }
                    );
                }, "Owner's balance is incorrect");
            });
    
            async function proceessWithdraw(personAddress, withdrawMethod, withdrawErrMsg){
                balanceBeforeWithdraw = await web3.eth.getBalance(personAddress);

                let withdrawTx = await withdrawMethod();
                txCost = await getTransactionGasCost(withdrawTx["tx"]);
                
                balanceAfterWithdraw = await web3.eth.getBalance(personAddress);
    
                assert(
                    balanceBeforeWithdraw.eq(balanceAfterWithdraw.plus(txCost).minus(remittanceAmount)), 
                    withdrawErrMsg
                );
            }
    
            async function getTransactionGasCost(tx) {
                let transaction = await web3.eth.getTransactionReceipt(tx);
                let amount = transaction.gasUsed;
                let price = await web3.eth.getTransaction(tx).gasPrice;
              
                return price * amount;
            }

            it("should return correct encrypted key", async function(){
                let key = web3.utils.keccak256(password.key1, password.key2);
                let remittanceKey = await remittanceInstance.getKey({from: owner});
                assert.equal(remittanceKey, key, "Key is not encrypted correcly");
            });
    
            it("should destroy the contract", async function(){
                await assert.expectEvent(remittanceInstance.destroy({from: owner}), {destroyer: owner}); 
            });
        });
    });

    describe("Remittance in a malicious way", function(){

        describe("Test constructor with invalid params", function(){

            let remittanceParams;

            before(function(){
                remittanceParams = {
                    to: bob,
                    duration: duration,
                    currency: "USD",
                    pass1: password.key1, 
                    pass2: password.key2
                }
            });    

            it("should not init Remittance if the To is zero", async function(){
                remittanceParams.to = 0x0;
                await expectInvalidRemittance();
                remittanceParams.to = bob;
            });

            it("should not init Remittance if the duration is higher than limit", async function(){
                remittanceParams.duration = 11;
                await expectInvalidRemittance();
                remittanceParams.duration = duration;
            });

            it("should not init Remittance if the duration is negative", async function(){
                remittanceParams.duration = -5;
                await expectInvalidRemittance();
                remittanceParams.duration = duration;
            });

            it("should not init Remittance if the currency is empty", async function(){
                remittanceParams.currency = "";
                await expectInvalidRemittance();
                remittanceParams.currency = "USD";
            });

            it("should not init Remittance if pass1 is empty", async function(){
                remittanceParams.pass1 = "";
                await expectInvalidRemittance();
                remittanceParams.pass1 = password.key1;
            });

            it("should not init Remittance if pass2 is empty", async function(){
                remittanceParams.pass2 = "";
                await expectInvalidRemittance();
                remittanceParams.pass2 = password.key2;
            });

            async function expectInvalidRemittance(params){
                await assert.expectRevert(Remittance.new(
                                                    remittanceParams.to, 
                                                    remittanceParams.duration, 
                                                    remittanceParams.currency, 
                                                    remittanceParams.pass1, 
                                                    remittanceParams.pass2, 
                                                    {from: owner, value: remittanceAmount}
                                                ));
            }
        });

        describe("Test methods with invalid params", function(){
            let remittanceInstance;

            before(async function(){
                remittanceInstance = await Remittance.new(
                    bob, 
                    duration, 
                    "USD", 
                    password.key1, 
                    password.key2, 
                    {from: owner, value: remittanceAmount}
                );
            });

            describe("Set Exchange Shop", function(){
                it("should not set exchange shop if the method caller is not the owner", async function(){
                    await assert.expectRevert(remittanceInstance.setExchangeShop(accounts[3], {from: alice}));
                });
            });
            
            describe("Withdraw Secure", function(){
                it("should not withdraw secure if method caller is not the exchange shop", async function(){
                    await assert.expectRevert(remittanceInstance.withdrawSecure(password.key1, password.key2, {from: owner}));
                });

                it("should not withdraw secure if some pass is wrong", async function(){
                    await assert.expectRevert(remittanceInstance.withdrawSecure(password.key1, "Test", {from: alice}));
                });
            });
            
            describe("Withdraw Funds", function(){
                it("should not withdraw funds if method caller is not the owner", async function(){
                    await assert.expectRevert(remittanceInstance.withdrawFunds({from: alice}));
                });

                it("should not withdraw funds if method call is before deadline ", async function(){
                    await assert.expectRevert(remittanceInstance.withdrawFunds({from: owner}));
                });
            });

            describe("Get Key", function(){
                it("should not get key if method caller is not the owner", async function(){
                    await assert.expectRevert(remittanceInstance.getKey({from: alice}));
                });
            });

            describe("Destroy", function(){
                it("should not process destruction if method caller is not the owner", async function(){
                    await assert.expectRevert(remittanceInstance.destroy({from: alice}));
                });
            });
        });
    });
});