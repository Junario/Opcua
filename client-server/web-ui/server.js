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

// OPC UA 클라이언트 설정
const client = OPCUAClient.create({
    applicationName: "SimpleWebUIClient",
    connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false
});

const endpointUrl = "opc.tcp://" + require("os").hostname() + ":4334/UA/MyLittleServer";
let session = null;
let isConnected = false;

// OPC UA 연결 함수
async function connectToOPCUA() {
    try {
        console.log('OPC UA 서버 연결 시도...');
        await client.connect(endpointUrl);
        session = await client.createSession();
        isConnected = true;
        console.log('OPC UA 서버 연결 성공!');
    } catch (error) {
        console.error('OPC UA 연결 실패:', error.message);
        isConnected = false;
        // 10초 후 재시도
        setTimeout(connectToOPCUA, 10000);
    }
}

// API: 연결 상태 확인
app.get('/api/status', (req, res) => {
    res.json({ connected: isConnected });
});

// API: 모든 변수 읽기
app.get('/api/variables', async (req, res) => {
    if (!session || !isConnected) {
        return res.json({
            error: 'OPC UA 서버에 연결되지 않았습니다.',
            variables: []
        });
    }

    try {
        const variables = [
            { nodeId: "ns=1;s=MyVariable1", name: "MyVariable1", type: "Double", writable: false },
            { nodeId: "ns=1;b=1020FFAA", name: "MyVariable2", type: "String", writable: true },
            { nodeId: "ns=1;s=free_memory", name: "FreeMemory", type: "Double", writable: false },
            { nodeId: "ns=1;s=process_name", name: "ProcessName", type: "Float", writable: false }
        ];

        const results = [];
        
        for (const variable of variables) {
            try {
                const dataValue = await session.read({
                    nodeId: variable.nodeId,
                    attributeId: AttributeIds.Value
                });
                
                results.push({
                    ...variable,
                    value: dataValue.value.value,
                    timestamp: new Date().toLocaleString(),
                    quality: dataValue.statusCode.name || 'Good'
                });
            } catch (error) {
                results.push({
                    ...variable,
                    value: 'Error',
                    timestamp: new Date().toLocaleString(),
                    quality: 'Bad'
                });
            }
        }

        res.json({ variables: results });
        
    } catch (error) {
        res.json({
            error: error.message,
            variables: []
        });
    }
});

// API: 변수 쓰기
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
        if (dataType === 'String') {
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
            res.json({ 
                success: true, 
                message: `${nodeId} 값이 ${value}로 변경되었습니다.` 
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
    console.log(`\n=== 간단한 OPC UA 웹 UI ===`);
    console.log(`서버 실행: http://localhost:${PORT}`);
    console.log(`브라우저에서 위 주소로 접속하세요.\n`);
    
    // 2초 후 OPC UA 연결 시도
    setTimeout(connectToOPCUA, 2000);
}); 