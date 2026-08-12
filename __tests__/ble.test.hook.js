require("@secux/utility/lib/logger");
const { SecuxWebBLE } = require("@secux/transport-webble");


let webble;
document.getElementById("connect").onclick = async () => {
    webble = await SecuxWebBLE.Create(
        () => console.log('connected'),
        () => console.log('disconnected'),
        ["crypto", "nifty", "shield"]
    );
    await webble.Connect();

    if (webble.DeviceType === "crypto") {
        const otp = prompt('enter otp');
        await webble.SendOTP(otp);
    }

    console.log(webble.DeviceName);

    const id = await webble.getCustomerId();
    console.log(`customer id: ${id}`);

    mocha.run();
};

export function RunTest(testname, test) {
    describe(testname, () => {
        after(async () => {
            await webble.Disconnect();
        });

        test(GetDevice);
    });
}

export const GetDevice = () => webble;