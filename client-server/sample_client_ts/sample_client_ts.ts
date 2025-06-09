import {
    AttributeIds,
    BrowseDirection,
    ClientMonitoredItem,
    ClientSubscription,
    DataValue,
    makeBrowsePath,
    MessageSecurityMode,
    MonitoringParametersOptions,
    NodeClassMask,
    OPCUAClient,
    ReadValueIdOptions,
    ResultMask,
    SecurityPolicy,
    TimestampsToReturn
} from "node-opcua-client";

const connectionStrategy = {
    initialDelay: 1000,
    maxRetry: 1
};
const client = OPCUAClient.create({
    applicationName: "MyClient",
    connectionStrategy: connectionStrategy,
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false
});
//const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/MyLittleServer";

async function timeout(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    try {
        // step 1 : connect to
        await client.connect(endpointUrl);
        console.log("connected !");

        // step 2 : createSession
        const session = await client.createSession();
        console.log("session created !");

        // step 3 : browse
        //최상위인 RootFolder부터 시작하여, Organizes 관계를 가지고 Object 또는 Variable 타입인 노드만 필터링해서 보여주는 등 훨씬 상세한 조건으로 탐색
        const browseResult = await session.browse({
            nodeId: "RootFolder",
            referenceTypeId: "Organizes",
            includeSubtypes: true,
            nodeClassMask: NodeClassMask.Object | NodeClassMask.Variable,
            browseDirection: BrowseDirection.Forward,
            resultMask: ResultMask.BrowseName | ResultMask.DisplayName | ResultMask.NodeClass | ResultMask.TypeDefinition
        });

        console.log("references of RootFolder :");
        if (browseResult.references) {
            for (const reference of browseResult.references) {
                console.log("   -> ", reference.browseName.toString());
            }
        } else {
            console.log("No references found.");
        }

        // step 4 : read a variable with readVariableValue
        const dataValue2 = await session.read({
            nodeId: "ns=1;s=free_memory",
            attributeId: AttributeIds.Value
        });
        console.log(" value = ", dataValue2.toString());

        // step 4' : read a variable with read
        const maxAge = 0;
        const nodeToRead = {
            nodeId: "ns=3;s=Scalar_Simulation_String",
            attributeId: AttributeIds.Value
        };
        const dataValue = await session.read(nodeToRead, maxAge);
        console.log(" value ", dataValue.toString());

        // step 5: install a subscription and install a monitored item for 10 seconds
        const subscription = ClientSubscription.create(session, {
            requestedPublishingInterval: 1000,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 100,
            publishingEnabled: true,
            priority: 10
        });

        subscription
            .on("started", function () {
                console.log("subscription started for 2 seconds - subscriptionId=", subscription.subscriptionId);
            })
            .on("keepalive", function () {
                console.log("keepalive");
            })
            .on("terminated", function () {
                console.log("terminated");
            });

        // install monitored item

        const itemToMonitor: ReadValueIdOptions = {
            nodeId: "ns=1;s=free_memory",
            attributeId: AttributeIds.Value
        };
        const parameters: MonitoringParametersOptions = {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 10
        };

        const monitoredItem = ClientMonitoredItem.create(subscription, itemToMonitor, parameters, TimestampsToReturn.Both);

        monitoredItem.on("changed", (dataValue: DataValue) => {
            console.log(" value has changed : ", dataValue.value.toString());
        });

        await timeout(10000);

        console.log("now terminating subscription");
        await subscription.terminate();

        // step 6: finding the nodeId of a node by Browse name
        const browsePath = makeBrowsePath("RootFolder", "/Objects/Server.ServerStatus.BuildInfo.ProductName");

        const result = await session.translateBrowsePath(browsePath);
        // result.targets가 null이 아니고, 최소 1개 이상의 target이 있을 때만 접근
        if (result.targets && result.targets.length > 0) {
            const productNameNodeId = result.targets[0].targetId;
            console.log(" Product Name nodeId = ", productNameNodeId.toString());
        } else {
            // targets가 null이거나 비어있을 경우를 처리
            console.log("No targets found for browse path.");
        }

        // close session
        await session.close();

        // disconnecting
        await client.disconnect();
        console.log("done !");
    } catch (err) {
        console.log("An error has occurred : ", err);
    }
}
main();