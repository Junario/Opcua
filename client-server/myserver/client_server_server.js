const { OPCUAServer, Variant, DataType, DataValue, StatusCodes } = require("node-opcua");

(async () => {
    // OPC UA 서버 생성 (History 지원)
    const server = new OPCUAServer({
        port: 4334,
        resourcePath: "/UA/MyLittleServer",
        buildInfo: {
            productName: "4DevicesHistoryServer",
            buildNumber: "2.1.0",
            buildDate: new Date()
        }
    });
    await server.initialize();
    console.log("=== 4개 가상장비 OPC UA 서버 (History 지원) 초기화 완료 ===");

    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();

    // History 데이터 저장소 (메모리 기반)
    const historyStorage = {};

    // 개선된 History Read Service Provider 구현
    server.historyRead = function(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {
        console.log("📊 History Read 요청 받음");
        console.log("📋 요청 상세:", {
            nodesToRead: historyReadDetails.nodesToRead?.length || 0,
            startTime: historyReadDetails.startTime,
            endTime: historyReadDetails.endTime,
            numValuesPerNode: historyReadDetails.numValuesPerNode
        });
        
        try {
            const nodesToRead = historyReadDetails.nodesToRead || [];
            const results = [];
            
            for (const nodeToRead of nodesToRead) {
                const nodeId = nodeToRead.nodeId.toString();
                const historyData = historyStorage[nodeId] || [];
                
                console.log(`📈 ${nodeId}: ${historyData.length}개 히스토리 포인트 처리`);
                
                if (historyData.length === 0) {
                    console.log(`⚠️ ${nodeId}: 히스토리 데이터 없음`);
                    results.push({
                        statusCode: StatusCodes.BadNoData,
                        historyData: {
                            dataValues: []
                        }
                    });
                    continue;
                }
                
                // 시간 범위 필터링
                let filteredData = historyData;
                if (historyReadDetails.startTime && historyReadDetails.endTime) {
                    const startTime = new Date(historyReadDetails.startTime);
                    const endTime = new Date(historyReadDetails.endTime);
                    
                    filteredData = historyData.filter(item => {
                        const timestamp = new Date(item.sourceTimestamp);
                        return timestamp >= startTime && timestamp <= endTime;
                    });
                    
                    console.log(`🕐 시간 필터링 결과: ${filteredData.length}개 포인트`);
                }
                
                // 최대 개수 제한
                const maxValues = historyReadDetails.numValuesPerNode || 100;
                const resultData = filteredData.slice(-maxValues);
                
                console.log(`✅ ${nodeId}: ${resultData.length}개 포인트 반환`);
                
                results.push({
                    statusCode: StatusCodes.Good,
                    historyData: {
                        dataValues: resultData
                    }
                });
            }
            
            // 콜백 방식으로 결과 반환
            if (callback) {
                callback(null, {
                    results: results
                });
            } else {
                return {
                    results: results
                };
            }
            
        } catch (error) {
            console.error("❌ History Read 에러:", error);
            if (callback) {
                callback(error);
            } else {
                return {
                    results: [{
                        statusCode: StatusCodes.BadInternalError,
                        historyData: { dataValues: [] }
                    }]
                };
            }
        }
    };

    // 4개 장비 생성
    const devices = [];
    const deviceData = {
        Device1: { temp: 25.0, power: true, voltage: 220.0, current: 2.5 },
        Device2: { temp: 30.0, power: false, voltage: 220.0, current: 0.0 },
        Device3: { temp: 28.0, power: true, voltage: 380.0, current: 5.2 },
        Device4: { temp: 22.0, power: false, voltage: 110.0, current: 0.0 }
    };

    for (let i = 1; i <= 4; i++) {
        const deviceName = `Device${i}`;
        
        // 장비 객체 생성
        const device = namespace.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: deviceName,
            displayName: `가상장비 ${i}`
        });

        // 온도 변수 (History 완전 지원)
        const temperature = namespace.addVariable({
            componentOf: device,
            nodeId: `ns=1;s=${deviceName}_Temperature`,
            browseName: "Temperature",
            displayName: "온도 (°C)",
            dataType: "Double",
            historizing: true,                          // ✅ History 기능 활성화
            accessLevel: "CurrentRead | HistoryRead",   // ✅ History 읽기 권한
            userAccessLevel: "CurrentRead | HistoryRead", // ✅ 사용자 권한
            minimumSamplingInterval: 100,               // ✅ 최소 100ms 간격
            value: { dataType: DataType.Double, value: deviceData[deviceName].temp }
        });

        // 작동상태 변수 (History 완전 지원)
        const power = namespace.addVariable({
            componentOf: device,
            nodeId: `ns=1;s=${deviceName}_Power`,
            browseName: "Power",
            displayName: "작동상태",
            dataType: "Boolean",
            historizing: true,                          // ✅ History 기능 활성화
            accessLevel: "CurrentRead | CurrentWrite | HistoryRead", // ✅ 모든 권한
            userAccessLevel: "CurrentRead | CurrentWrite | HistoryRead", // ✅ 사용자 권한
            minimumSamplingInterval: 100,               // ✅ 최소 100ms 간격
            value: { dataType: DataType.Boolean, value: deviceData[deviceName].power }
        });

        // 전압 변수 (History 완전 지원)
        const voltage = namespace.addVariable({
            componentOf: device,
            nodeId: `ns=1;s=${deviceName}_Voltage`,
            browseName: "Voltage",
            displayName: "전압 (V)",
            dataType: "Double",
            historizing: true,                          // ✅ History 기능 활성화
            accessLevel: "CurrentRead | HistoryRead",   // ✅ History 읽기 권한
            userAccessLevel: "CurrentRead | HistoryRead", // ✅ 사용자 권한
            minimumSamplingInterval: 100,               // ✅ 최소 100ms 간격
            value: { dataType: DataType.Double, value: deviceData[deviceName].voltage }
        });

        // 전류 변수 (History 완전 지원)
        const current = namespace.addVariable({
            componentOf: device,
            nodeId: `ns=1;s=${deviceName}_Current`,
            browseName: "Current",
            displayName: "전류 (A)",
            dataType: "Double",
            historizing: true,                          // ✅ History 기능 활성화
            accessLevel: "CurrentRead | HistoryRead",   // ✅ History 읽기 권한
            userAccessLevel: "CurrentRead | HistoryRead", // ✅ 사용자 권한
            minimumSamplingInterval: 100,               // ✅ 최소 100ms 간격
            value: { dataType: DataType.Double, value: deviceData[deviceName].current }
        });

        devices.push({
            name: deviceName,
            data: deviceData[deviceName],
            variables: { temperature, power, voltage, current }
        });

        // History 저장소 초기화
        historyStorage[temperature.nodeId.toString()] = [];
        historyStorage[power.nodeId.toString()] = [];
        historyStorage[voltage.nodeId.toString()] = [];
        historyStorage[current.nodeId.toString()] = [];

        console.log(`✅ ${deviceName} 생성 완료 (History 완전 지원)`);
    }

    // 초기 History 데이터 생성 (더 많은 데이터 포인트)
    console.log("🔄 초기 History 데이터 생성 중...");
    const currentTime = new Date();
    for (let i = 0; i < 180; i++) { // 3분 * 60초 = 180개 포인트
        const timestamp = new Date(currentTime.getTime() - (180 - i) * 1000); // 1초 간격으로 과거 데이터
        
        devices.forEach(device => {
            const createHistoryValue = (value, dataType) => ({
                value: { dataType: dataType, value: value },
                statusCode: StatusCodes.Good,
                sourceTimestamp: timestamp,
                serverTimestamp: timestamp
            });

            // 초기 값들로 히스토리 생성 (더 현실적인 패턴)
            const tempBase = device.data.temp;
            const tempVariation = Math.sin(i * 0.1) * 3 + (Math.random() - 0.5) * 2;
            
            historyStorage[device.variables.temperature.nodeId.toString()].push(
                createHistoryValue(tempBase + tempVariation, DataType.Double)
            );
            historyStorage[device.variables.power.nodeId.toString()].push(
                createHistoryValue(device.data.power, DataType.Boolean)
            );
            historyStorage[device.variables.voltage.nodeId.toString()].push(
                createHistoryValue(device.data.voltage + (Math.random() - 0.5) * 10, DataType.Double)
            );
            historyStorage[device.variables.current.nodeId.toString()].push(
                createHistoryValue(device.data.current + (Math.random() - 0.5) * 0.5, DataType.Double)
            );
        });
    }

    // History 데이터 자동 저장 시뮬레이션 타이머 (1초마다 값 업데이트)
    const simulationTimer = setInterval(() => {
        const currentTime = new Date();
        
        devices.forEach((device, index) => {
            const deviceName = device.name;
            const isPowerOn = device.variables.power.readValue().value.value;
            
            // 온도 시뮬레이션 (작동시 온도 상승)
            if (isPowerOn) {
                device.data.temp += (Math.random() - 0.4) * 2; // -0.8 ~ +1.2도 변화
                if (device.data.temp > 80) device.data.temp = 80; // 최대 80도
                if (device.data.temp < 20) device.data.temp = 20; // 최소 20도
            } else {
                // 전원 꺼져있으면 서서히 실온으로
                device.data.temp += (25 - device.data.temp) * 0.02;
            }

            // 전압 시뮬레이션 (약간의 변동)
            const baseVoltage = index < 3 ? 220 : 110; // Device1,2,3: 220V, Device4: 110V
            if (index === 2) device.data.voltage = 380; // Device3: 380V
            device.data.voltage = baseVoltage + (Math.random() - 0.5) * 10;

            // 전류 시뮬레이션 (전원상태에 따라)
            if (isPowerOn) {
                const baseCurrent = [2.5, 3.2, 5.0, 1.8][index];
                device.data.current = baseCurrent + (Math.random() - 0.5) * 0.5;
            } else {
                device.data.current = 0.0;
            }

            // 정밀한 값 계산
            const tempValue = Math.round(device.data.temp * 10) / 10;
            const voltageValue = Math.round(device.data.voltage * 10) / 10;
            const currentValue = Math.round(device.data.current * 100) / 100;
            
            // 현재 값 업데이트
            device.variables.temperature.setValueFromSource(new Variant({ 
                dataType: DataType.Double, 
                value: tempValue 
            }));
            device.variables.power.setValueFromSource(new Variant({
                dataType: DataType.Boolean,
                value: isPowerOn
            }));
            device.variables.voltage.setValueFromSource(new Variant({ 
                dataType: DataType.Double, 
                value: voltageValue 
            }));
            device.variables.current.setValueFromSource(new Variant({ 
                dataType: DataType.Double, 
                value: currentValue 
            }));

            // History 데이터 저장 (완전한 타임스탬프 포함)
            const createHistoryValue = (value, dataType) => ({
                value: { dataType: dataType, value: value },
                statusCode: StatusCodes.Good,
                sourceTimestamp: currentTime,
                serverTimestamp: currentTime
            });

            // 각 변수의 히스토리에 현재 값 추가
            historyStorage[device.variables.temperature.nodeId.toString()].push(
                createHistoryValue(tempValue, DataType.Double)
            );
            historyStorage[device.variables.power.nodeId.toString()].push(
                createHistoryValue(isPowerOn, DataType.Boolean)
            );
            historyStorage[device.variables.voltage.nodeId.toString()].push(
                createHistoryValue(voltageValue, DataType.Double)
            );
            historyStorage[device.variables.current.nodeId.toString()].push(
                createHistoryValue(currentValue, DataType.Double)
            );

            // 메모리 관리: 최대 1000개 히스토리 데이터만 유지
            Object.keys(historyStorage).forEach(nodeId => {
                if (historyStorage[nodeId].length > 1000) {
                    historyStorage[nodeId] = historyStorage[nodeId].slice(-1000);
                }
            });
        });
        
        // 히스토리 상태 로그 (30초마다)
        if (Date.now() % 30000 < 1000) {
            const totalPoints = Object.values(historyStorage).reduce((sum, arr) => sum + arr.length, 0);
            console.log(`📊 히스토리 저장 상태: 총 ${totalPoints}개 데이터 포인트`);
        }
    }, 1000);

    // 서버 종료시 정리
    addressSpace.registerShutdownTask(() => { 
        clearInterval(simulationTimer); 
        console.log("🧹 시뮬레이션 타이머 및 History 저장소 정리 완료");
    });

    server.start(function() {
        console.log("\n🚀 === 4개 가상장비 OPC UA 서버 시작 (History 완전 지원) ===");
        console.log(`📡 포트: ${server.endpoints[0].port}`);
        console.log(`🌐 엔드포인트: ${server.endpoints[0].endpointDescriptions()[0].endpointUrl}`);
        console.log("\n📋 가상장비 목록:");
        console.log("  🏭 Device1: 온도, 작동상태, 전압, 전류 (📊 History 완전 지원)");
        console.log("  🏭 Device2: 온도, 작동상태, 전압, 전류 (📊 History 완전 지원)");
        console.log("  🏭 Device3: 온도, 작동상태, 전압, 전류 (📊 History 완전 지원)");
        console.log("  🏭 Device4: 온도, 작동상태, 전압, 전류 (📊 History 완전 지원)");
        console.log("\n✨ 각 장비마다 총 4개 변수 제공 (총 16개 변수)");
        console.log("⚡ 작동상태(Power)만 제어 가능, 나머지는 모니터링 전용");
        console.log("🔄 실시간 시뮬레이션 실행 중...");
        console.log("📊 History 데이터 자동 저장 중 (UaExpert History Trend View 지원)");
        console.log("🔍 개선된 History Read Service 활성화");
        console.log("📈 초기 History 데이터 180개 포인트 준비됨 (3분간)");
        console.log("\n💡 UaExpert History Trend View 사용법:");
        console.log("   1. Device1~4 확장 → 개별 변수 선택");
        console.log("   2. 변수를 History Trend View로 드래그&드롭");
        console.log("   3. 시간 범위: 최근 3분, Update 실행");
        console.log("\n🛑 서버 중지: Ctrl+C");
    });
})();