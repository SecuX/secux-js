const { RunTest, GetDevice } = require("../../../__tests__/ble.test.hook.js");
const { assert } = require('chai');


RunTest("@secux/transport-webble", () => {
    describe("SecuxDevice.getVersion()", () => {
        it('query devcie fw version', async () => {
            const { seFwVersion, mcuFwVersion, bootloaderVersion } = await GetDevice().getVersion();

            assert.equal(seFwVersion, '1.87');
            assert.equal(mcuFwVersion, '2.14.9');
            assert.equal(bootloaderVersion, '1.9');
        });
    });

    describe("Device Information", () => {
        it("model", () => {
            const { Model } = GetDevice();
            console.log("model:", Model);
            assert.notEqual(Model, '');
        });

        it("device id", () => {
            const { DeviceId } = GetDevice();
            console.log("device id:", DeviceId);
            assert.notEqual(DeviceId, '');
        });

        it("customer id", () => {
            const { CustomerId } = GetDevice();
            console.log("customer id:", CustomerId);
            assert.notEqual(CustomerId, '');
        });
    });
});
