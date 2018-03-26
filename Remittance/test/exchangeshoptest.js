var ExchangeShop = artifacts.require("../contracts/ExchangeShop.sol");
var Remittance = artifacts.require("../contracts/Remittance.sol");
require("../test/assertExtensions");
web3.utils = require('./utils.js');

contract("ExchangeShop", async function(accounts){

    let owner = accounts[0];
    let bob = accounts[1];
    let alice = accounts[2];
    let carol = accounts[3];
    let exchangeShopInstance;
    let commission = 10;
    let fee = 50000;
    let untrustedRemittanceAmount = 990;
    let trustedRemittanceAmount = 992;
    let untrustedPass = { key1: "123", key2: "321" }
    let trustedPass = { key1: "321", key2: "123" }

    async function createRemittance(remittanceOwner, to, pass1, pass2){
        let duration = 4;
        let currency = 'USD';
        
        let remittance = await Remittance.new(to, duration, currency, pass1, pass2, {from: remittanceOwner, value: 1000});
        await remittance.setExchangeShop(exchangeShopInstance.address, {from: remittanceOwner});

        return remittance;
    }

    describe("ExchangeShop in a perfect way", function(){

        before(async function(){
            exchangeShopInstance = await ExchangeShop.new({from: owner});
        });

        it("should be owned by owner", async function(){
            let contractOwner = await exchangeShopInstance.owner({from: owner});
            assert.equal(contractOwner, owner, "Owner is not set correctly");
        });

        it("should add currency", async function(){
            let eventParams = {name: web3.fromAscii("USD") + "00", commission: web3.toBigNumber(commission)};
            await assert.expectEvent(exchangeShopInstance.addCurrency("USD", commission), eventParams, "Currency is not added successfuly");
        });

        it("should add untrusted remittance", async function(){
            let remittanceInstance = await createRemittance(alice, bob, untrustedPass.key1, untrustedPass.key2);
            let remittanceKey = await remittanceInstance.getKey({from: alice});
            let eventParams = {remittanceOwner: alice, remittanceAddress: remittanceInstance.address}

            await assert.expectEvent(
                exchangeShopInstance.addRemittance(remittanceInstance.address, remittanceKey, {from: alice, value: fee}),
                eventParams,
                "Remittance is not added successfuly"
            );
        });

        it("should add trusted remittance", async function(){
            let remittanceInstance = await createRemittance(owner, carol, trustedPass.key1, trustedPass.key2);
            let remittanceKey = await remittanceInstance.getKey({from: owner});
            let eventParams = {remittanceOwner: owner, remittanceAddress: remittanceInstance.address}

            await assert.expectEvent(
                exchangeShopInstance.addRemittance(remittanceInstance.address, remittanceKey, {from: owner}),
                eventParams,
                "Remittance is not added successfuly"
            );
        });

        it("should unlock untrusted remittance", async function(){
            let eventParams = {unlockedAmount: web3.toBigNumber(untrustedRemittanceAmount), feeForGiving: web3.toBigNumber(fee)};
            await assert.expectEvent(
                exchangeShopInstance.unlockUnTrustedRemittance(untrustedPass.key1, untrustedPass.key2, {from: owner}),
                eventParams,
                "Untrusted unlock is not seccessful"
            );
        });

        it("should unlock trusted remittance", async function(){
            let eventParams = {unlockedAmount: web3.toBigNumber(trustedRemittanceAmount)};
            await assert.expectEvent(
                exchangeShopInstance.unlockTrustedRemittance(trustedPass.key1, trustedPass.key2, {from: owner}),
                eventParams,
                "Trusted unlock is not seccessful"
            );
        });

        it("should withdraw exchange shop money", async function(){
            await proceessWithdraw(owner, 18, async function(){
                return await assert.expectEvent(
                    exchangeShopInstance.withdrawExchangeShopMoney({from: owner}),
                    { withdrawnMoney: web3.toBigNumber(18) }
                );
            }, "Owner's balance is incorrect");
        });

        it("should withdraw fee", async function(){
            await proceessWithdraw(alice, fee, async function(){
                return await assert.expectEvent(
                    exchangeShopInstance.withdraw({from: alice}),
                    { withdrawer: alice, withdrawnAmount: web3.toBigNumber(fee) }
                );
            }, "Alice's balance is incorrect");
        });

        it("should withdraw funds", async function(){
            await proceessWithdraw(bob, untrustedRemittanceAmount, async function(){
                return await assert.expectEvent(
                    exchangeShopInstance.withdraw({from: bob}),
                    { withdrawer: bob, withdrawnAmount: web3.toBigNumber(untrustedRemittanceAmount) }
                );
            }, "Bob's balance is incorrect");
        });

        async function proceessWithdraw(personAddress, expectedAmount, withdrawMethod, withdrawErrMsg){
            balanceBeforeWithdraw = await web3.eth.getBalance(personAddress);

            let withdrawTx = await withdrawMethod();
            txCost = await getTransactionGasCost(withdrawTx["tx"]);
            
            balanceAfterWithdraw = await web3.eth.getBalance(personAddress);

            assert(
                balanceBeforeWithdraw.eq(balanceAfterWithdraw.plus(txCost).minus(expectedAmount)), 
                withdrawErrMsg
            );
        }

        async function getTransactionGasCost(tx) {
            let transaction = await web3.eth.getTransactionReceipt(tx);
            let amount = transaction.gasUsed;
            let price = await web3.eth.getTransaction(tx).gasPrice;
          
            return price * amount;
        }

        it("should destroy the contract", async function(){
            await assert.expectEvent(exchangeShopInstance.destroy({from: owner}), {destroyer: owner}); 
        });
    });

    describe("ExchangeShop in a malicious way", function(){
        
        let remittanceInstance;
        let remittanceKey;

        before(async function(){
            exchangeShopInstance = await ExchangeShop.new({from: owner});
            await exchangeShopInstance.addCurrency("USD", commission, {from: owner});
            remittanceInstance = await createRemittance(alice, bob, untrustedPass.key1, untrustedPass.key2);
            remittanceKey = await remittanceInstance.getKey({from: alice});
            // await exchangeShopInstance.addRemittance(remittanceInstance.address, remittanceKey, {from: alice, value: fee});
        });

        describe("Add currency", function(){
            it("should not add currency if method caller is not the owner", async function(){
                await assert.expectRevert(exchangeShopInstance.addCurrency("BG", commission, {from: alice}));
            });

            it("should not add currency if it already exists", async function(){
                await assert.expectRevert(exchangeShopInstance.addCurrency("USD", commission, {from: owner}));
            });
        });

        describe("Add Remittance", function(){

            it("should not add remittance with empty address", async function(){
                let emptyRemittance = 0x0;
                await assert.expectRevert(exchangeShopInstance.addRemittance(emptyRemittance, remittanceKey, {from: alice, value: fee}));
            });

            it("should not add remittance when method caller is not the owner and the fee is not payed", async function(){
                await assert.expectRevert(
                    exchangeShopInstance.addRemittance(remittanceInstance.address, remittanceKey, {from: alice, value: 0})
                );
            });

            it("should not add remittance when it is not related to a certain shop", async function(){
                await remittanceInstance.setExchangeShop(bob, {from: alice});

                await assert.expectRevert(
                    exchangeShopInstance.addRemittance(remittanceInstance.address, remittanceKey, {from: alice, value: fee})
                );

                await remittanceInstance.setExchangeShop(exchangeShopInstance.address, {from: alice});
            });

            it("should not add remittance if it exists", async function(){
                await exchangeShopInstance.addRemittance(remittanceInstance.address, remittanceKey, {from: alice, value: fee});

                await assert.expectRevert(
                    exchangeShopInstance.addRemittance(remittanceInstance.address, remittanceKey, {from: alice, value: fee})
                );
            });

        });

        describe("Unlock Untrusted Remittance", function(){
            it("should not unlock remittance if method caller is not the owner", async function(){
                await assert.expectRevert(
                    exchangeShopInstance.unlockUnTrustedRemittance(untrustedPass.key1, untrustedPass.key2, {from: alice})
                );
            });

            it("should not unlock remittance if it does not exists", async function(){
                await assert.expectRevert(
                    exchangeShopInstance.unlockUnTrustedRemittance(trustedPass.key1, trustedPass.key2, {from: owner})
                );
            });
        });

        describe("Unlock Trusted Remittance", function(){
            it("should not unlock remittance if method caller is not the owner", async function(){
                await assert.expectRevert(
                    exchangeShopInstance.unlockTrustedRemittance(untrustedPass.key1, untrustedPass.key2, {from: alice})
                );
            });

            it("should not unlock remittance if it does not exists", async function(){
                await assert.expectRevert(
                    exchangeShopInstance.unlockTrustedRemittance(trustedPass.key1, trustedPass.key2, {from: owner})
                );
            });
        });

        describe("Withdraw Exchange Shop Money", function(){
            it("should not withdraw shop money if method caller is not the owner", async function(){
                await assert.expectRevert(
                    exchangeShopInstance.withdrawExchangeShopMoney({from: alice})
                );
            });

            it("should not withdraw shop money if there are not", async function(){
                await assert.expectRevert(
                    exchangeShopInstance.withdrawExchangeShopMoney({from: owner})
                );
            });
        });

        describe("Withdraw", function(){
            it("should not withdraw if there are not money for withdraw", async function(){
                await exchangeShopInstance.unlockUnTrustedRemittance(untrustedPass.key1, untrustedPass.key2, {from: owner});
                await exchangeShopInstance.withdraw({from: bob});

                await assert.expectRevert(
                    exchangeShopInstance.withdraw({from: bob})
                );
            });
        });

        describe("Destroy", function(){
            it("should not destroy the contract if method caller is not the owner", async function(){
                await assert.expectRevert(exchangeShopInstance.destroy({from: alice}));
            });
        });
    });

});