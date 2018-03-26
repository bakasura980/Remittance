(function() {
    assert.expectRevert = async function(promise) {
        try {
            let result = await promise;
        } catch (error) {
            const revert = error.message.search('revert') >= 0;
            assert(revert, "Expected throw, got '" + error + "' instead");
            return;
        }
        assert.fail('Expected throw not received');
    }

    assert.expectEvent = async function(promise, eventParameters) {
        let tx = await promise;
        assert.equal(tx.logs.length, 1);

        let eventParamsNames = Object.keys(eventParameters);
        eventParamsNames.forEach(function(parameter){
            assert.deepEqual(tx.logs[0].args[parameter], eventParameters[parameter]);
        });

        return tx;
    }
})();

