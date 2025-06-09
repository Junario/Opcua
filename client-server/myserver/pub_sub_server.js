const { OPCUAServer, DataType, resolveNodeId, AttributeIds } = require("node-opcua");
const { DataSetFieldContentMask, JsonDataSetMessageContentMask, JsonNetworkMessageContentMask, BrokerTransportQualityOfService, PublishedDataItemsDataType } = require("node-opcua-types");
const { installPubSub, getPubSubConfigurationManager } = require("node-opcua-pubsub-server");
const { PubSubConfigurationDataType } = require("node-opcua-types");
const { MyMqttJsonPubSubConnectionDataType } = require("node-opcua-pubsub-expander");

(async () => {
    try {
        const server = new OPCUAServer({
            port: 26543
        });

        await server.initialize();

        /* add temperature sensor */
        const namespace = server.engine.addressSpace.getOwnNamespace();

        const sensor = namespace.addObject({
            browseName: "MySensor",
            organizedBy: server.engine.addressSpace.rootFolder.objects
        });

        const temperature = namespace.addVariable({
            browseName: "Temperature",
            nodeId: "s=Temperature",
            componentOf: sensor,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 0 }
        });

        /* Simulate the Temperature */
        setInterval(() => {
            const value = 19 + 5 * Math.sin(Date.now() / 10000) + Math.random() * 0.2;
            console.log("Setting Temperature to:", value); // 디버깅 로그
            temperature.setValueFromSource({ dataType: DataType.Double, value });
        }, 100);

        const configuration = getPubSubConfiguration();
        console.log("PubSub Configuration:", configuration.toString());

        const pubsub = await installPubSub(server, { configuration });
        console.log("PubSub Status:", pubsub.getStatus ? pubsub.getStatus() : "Status method not available"); // PubSub 상태 확인

        await server.start();
        console.log("Server started at ", server.getEndpointUrl());
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
})();

function getPubSubConfiguration() {
    const connection = createConnection();
    const publishedDataSet = createPublishedDataSet();

    return new PubSubConfigurationDataType({
        connections: [connection],
        publishedDataSets: [publishedDataSet]
    });
}

function createConnection() {
    const mqttEndpoint = "mqtt://broker.hivemq.com:1883"; // 또는 로컬 브로커: "mqtt://localhost:1883"n
    const dataSetWriter = {
        dataSetFieldContentMask: DataSetFieldContentMask.None,
        dataSetName: "PublishedDataSet1",
        dataSetWriterId: 1,
        enabled: true,
        name: "dataSetWriter1",
        messageSettings: {
            dataSetMessageContentMask: 
                JsonDataSetMessageContentMask.DataSetWriterId |
                JsonDataSetMessageContentMask.MetaDataVersion,
        },
        transportSettings: {
            queueName: "/opcuaovermqttdemo/temperature",
        },
    };

    const writerGroup = {
        dataSetWriters: [dataSetWriter],
        enabled: true,
        publishingInterval: 100, // 100ms로 변경
        name: "WriterGroup1",
        messageSettings: {
            networkMessageContentMask: JsonNetworkMessageContentMask.PublisherId,
        },
        transportSettings: {
            requestedDeliveryGuarantee: BrokerTransportQualityOfService.AtMostOnce,
        },
    };

    const connection = new MyMqttJsonPubSubConnectionDataType({
        enabled: true,
        name: "Connection1",
        transportProfileUri: "http://opcfoundation.org/UA-Profile/Transport/pubsub-mqtt-json",
        address: {
            url: mqttEndpoint,
        },
        writerGroups: [writerGroup],
        readerGroups: []
    });

    console.log("Connection created:", JSON.stringify(connection, null, 2)); // 디버깅 로그
    return connection;
}

function createPublishedDataSet() {
    const publishedDataSet = {
        name: "PublishedDataSet1",
        dataSetMetaData: {
            fields: [
                {
                    name: "SensorTemperature",
                    builtInType: DataType.Double,
                    dataType: resolveNodeId("Double")
                },
            ],
        },
        dataSetSource: new PublishedDataItemsDataType({
            publishedData: [
                {
                    attributeId: AttributeIds.Value, // 오타 수정: attributedId -> attributeId
                    samplingIntervalHint: 100, // 100ms로 변경
                    publishedVariable: resolveNodeId("ns=1;s=Temperature"), // 명확히 지정
                },
            ],
        }),
    };
    console.log("Published DataSet:", JSON.stringify(publishedDataSet, null, 2)); // 디버깅 로그
    return publishedDataSet;
}