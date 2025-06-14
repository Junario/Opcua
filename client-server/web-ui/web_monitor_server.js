const express = require('express');
const path = require('path');
const {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    AttributeIds,
    DataType,
    Variant
} = require('node-opcua');

const app = express();

// 정적 파일과 JSON 파싱만 설정
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 히스토리 데이터 저장소 (메모리 기반)
const historyData = new Map(); // 변수별 히스토리 데이터
const MAX_HISTORY_POINTS = 100; // 최대 데이터 포인트 수

// OPC UA 클라이언트 설정
const client = OPCUAClient.create({
    applicationName: "SimpleWebUIClient",
    connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false,
    applicationUri: "urn:pollux-min-acer:MyClient"  // 인증서의 subjectAltName과 일치하도록 설정
});

const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/MyLittleServer";
let session = null;
let isConnected = false;

// OPC UA 연결 함수
async function connectToOPCUA() {
    try {
        await client.connect(endpointUrl);
        session = await client.createSession();
        isConnected = true;
        console.log('OPC UA 서버 연결 성공');
    } catch (error) {
        console.error('OPC UA 연결 실패:', error.message);
        isConnected = false;
        setTimeout(connectToOPCUA, 10000);
    }
}

// 히스토리 데이터 저장 함수
function saveHistoryData(nodeId, value, timestamp) {
    if (!historyData.has(nodeId)) {
        historyData.set(nodeId, []);
    }
    
    const history = historyData.get(nodeId);
    history.push({
        value: value,
        timestamp: timestamp
    });
    
    // 최대 포인트 수 제한
    if (history.length > MAX_HISTORY_POINTS) {
        history.shift(); // 가장 오래된 데이터 제거
    }
}

// API: 연결 상태 확인
app.get('/api/status', (req, res) => {
    res.json({ connected: isConnected });
});

// API: 히스토리 데이터 초기화 (더 구체적인 경로를 먼저 배치)
app.post('/api/history/reset', (req, res) => {
    historyData.clear();
    res.json({ success: true, message: '히스토리 데이터가 초기화되었습니다.' });
});

// API: 특정 노드의 히스토리 데이터 조회
app.get('/api/history/:nodeId', (req, res) => {
    const nodeId = req.params.nodeId;
    const history = historyData.get(nodeId) || [];
    
    res.json({
        nodeId: nodeId,
        data: history
    });
});

// API: 모든 변수의 히스토리 데이터 조회
app.get('/api/history', (req, res) => {
    const allHistory = {};
    historyData.forEach((data, nodeId) => {
        allHistory[nodeId] = data;
    });
    
    res.json(allHistory);
});

// API: 모든 변수 읽기
app.get('/api/variables', async (req, res) => {
    if (!session || !isConnected) {
        return res.json({
            error: 'OPC UA 서버에 연결되지 않았습니다.',
            devices: []
        });
    }

    try {
        // 4개 장비의 16개 변수 정의
        const deviceConfigs = [
            { name: "Device1", displayName: "가상장비 1" },
            { name: "Device2", displayName: "가상장비 2" },
            { name: "Device3", displayName: "가상장비 3" },
            { name: "Device4", displayName: "가상장비 4" }
        ];

        const devices = [];
        
        for (const deviceConfig of deviceConfigs) {
            const deviceName = deviceConfig.name;
            const variables = [
                { 
                    nodeId: `ns=1;s=${deviceName}_Temperature`, 
                    name: "Temperature", 
                    displayName: "온도 (°C)",
                    type: "Double", 
                    writable: false,
                    unit: "°C"
                },
                { 
                    nodeId: `ns=1;s=${deviceName}_Power`, 
                    name: "Power", 
                    displayName: "작동상태",
                    type: "Boolean", 
                    writable: true,
                    unit: ""
                },
                { 
                    nodeId: `ns=1;s=${deviceName}_Voltage`, 
                    name: "Voltage", 
                    displayName: "전압 (V)",
                    type: "Double", 
                    writable: false,
                    unit: "V"
                },
                { 
                    nodeId: `ns=1;s=${deviceName}_Current`, 
                    name: "Current", 
                    displayName: "전류 (A)",
                    type: "Double", 
                    writable: false,
                    unit: "A"
                }
            ];

            const deviceData = {
                name: deviceName,
                displayName: deviceConfig.displayName,
                variables: []
            };

            for (const variable of variables) {
                try {
                    const dataValue = await session.read({
                        nodeId: variable.nodeId,
                        attributeId: AttributeIds.Value
                    });
                    
                    let displayValue = dataValue.value.value;
                    if (variable.type === "Boolean") {
                        displayValue = displayValue ? "ON" : "OFF";
                    } else if (variable.type === "Double") {
                        displayValue = typeof displayValue === 'number' ? displayValue.toFixed(1) : displayValue;
                    }
                    
                    // 히스토리 데이터 저장 (숫자형 데이터만)
                    const timestamp = new Date();
                    if (variable.type === "Double" && typeof dataValue.value.value === 'number') {
                        saveHistoryData(variable.nodeId, dataValue.value.value, timestamp);
                    } else if (variable.type === "Boolean") {
                        saveHistoryData(variable.nodeId, dataValue.value.value ? 1 : 0, timestamp);
                    }
                    
                    deviceData.variables.push({
                        ...variable,
                        value: dataValue.value.value,
                        displayValue: displayValue,
                        timestamp: timestamp.toLocaleString(),
                        quality: dataValue.statusCode.name || 'Good'
                    });
                } catch (error) {
                    deviceData.variables.push({
                        ...variable,
                        value: 'Error',
                        displayValue: 'Error',
                        timestamp: new Date().toLocaleString(),
                        quality: 'Bad'
                    });
                }
            }

            devices.push(deviceData);
        }

        res.json({ devices: devices });
        
    } catch (error) {
        res.json({
            error: error.message,
            devices: []
        });
    }
});

// API: 변수 쓰기 (작동상태 제어)
app.post('/api/write', async (req, res) => {
    if (!session || !isConnected) {
        return res.json({ 
            success: false, 
            message: 'OPC UA 서버에 연결되지 않았습니다.' 
        });
    }

    const { nodeId, value, dataType } = req.body;

    try {
        let variant;
        if (dataType === 'Boolean') {
            // "ON"/"OFF" 문자열 또는 true/false 불린값 처리
            const boolValue = (value === "ON" || value === true || value === "true");
            variant = new Variant({ dataType: DataType.Boolean, value: boolValue });
        } else if (dataType === 'String') {
            variant = new Variant({ dataType: DataType.String, value: String(value) });
        } else if (dataType === 'Double') {
            variant = new Variant({ dataType: DataType.Double, value: Number(value) });
        } else if (dataType === 'Float') {
            variant = new Variant({ dataType: DataType.Float, value: Number(value) });
        } else {
            variant = new Variant({ dataType: DataType.String, value: String(value) });
        }

        const writeValue = {
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: { value: variant }
        };

        const result = await session.write(writeValue);
        
        if (result.name === 'Good') {
            const displayValue = dataType === 'Boolean' ? (variant.value ? "ON" : "OFF") : value;
            res.json({ 
                success: true, 
                message: `장비 ${nodeId.split('_')[0].replace('ns=1;s=', '')}의 작동상태가 ${displayValue}로 변경되었습니다.` 
            });
        } else {
            res.json({ 
                success: false, 
                message: `쓰기 실패: ${result.name}` 
            });
        }
        
    } catch (error) {
        res.json({ 
            success: false, 
            message: `오류: ${error.message}` 
        });
    }
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`\n=== OPC UA 웹 UI 서버 ===`);
    console.log(`서버 실행: http://localhost:${PORT}`);
    
    setTimeout(connectToOPCUA, 2000);
}); 