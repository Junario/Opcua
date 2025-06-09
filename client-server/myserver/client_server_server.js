const { OPCUAServer, Variant, DataType, DataValue, StatusCodes } = require("node-opcua");

(async () => {
    // OPC UA 서버 생성
    const server = new OPCUAServer({
        port: 4334,
        resourcePath: "/UA/MyLittleServer",
        buildInfo: {
            productName: "4DevicesServer",
            buildNumber: "1.0.0",
            buildDate: new Date()
        }
    });
    await server.initialize();
    console.log("=== 4개 가상장비 OPC UA 서버 초기화 완료 ===");

    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();

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

        // 온도 변수 (읽기전용, 시뮬레이션)
        const temperature = namespace.addVariable({
            componentOf: device,
            nodeId: `ns=1;s=${deviceName}_Temperature`,
            browseName: "Temperature",
            displayName: "온도 (°C)",
            dataType: "Double",
            value: { dataType: DataType.Double, value: deviceData[deviceName].temp }
        });

        // 작동상태 변수 (읽기/쓰기)
        const power = namespace.addVariable({
            componentOf: device,
            nodeId: `ns=1;s=${deviceName}_Power`,
            browseName: "Power",
            displayName: "작동상태",
            dataType: "Boolean",
            accessLevel: "CurrentRead | CurrentWrite",
            value: { dataType: DataType.Boolean, value: deviceData[deviceName].power }
        });

        // 전압 변수 (읽기전용, 시뮬레이션)
        const voltage = namespace.addVariable({
            componentOf: device,
            nodeId: `ns=1;s=${deviceName}_Voltage`,
            browseName: "Voltage",
            displayName: "전압 (V)",
            dataType: "Double",
            value: { dataType: DataType.Double, value: deviceData[deviceName].voltage }
        });

        // 전류 변수 (읽기전용, 시뮬레이션)
        const current = namespace.addVariable({
            componentOf: device,
            nodeId: `ns=1;s=${deviceName}_Current`,
            browseName: "Current",
            displayName: "전류 (A)",
            dataType: "Double",
            value: { dataType: DataType.Double, value: deviceData[deviceName].current }
        });

        devices.push({
            name: deviceName,
            data: deviceData[deviceName],
            variables: { temperature, power, voltage, current }
        });

        console.log(`✅ ${deviceName} 생성 완료`);
    }

    // 시뮬레이션 타이머 (1초마다 값 업데이트)
    const simulationTimer = setInterval(() => {
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

            // 값 업데이트
            device.variables.temperature.setValueFromSource(new Variant({ 
                dataType: DataType.Double, 
                value: Math.round(device.data.temp * 10) / 10 
            }));
            device.variables.voltage.setValueFromSource(new Variant({ 
                dataType: DataType.Double, 
                value: Math.round(device.data.voltage * 10) / 10 
            }));
            device.variables.current.setValueFromSource(new Variant({ 
                dataType: DataType.Double, 
                value: Math.round(device.data.current * 100) / 100 
            }));
        });
    }, 1000);

    // 서버 종료시 타이머 정리
    addressSpace.registerShutdownTask(() => { 
        clearInterval(simulationTimer); 
        console.log("시뮬레이션 타이머 정리 완료");
    });

    server.start(function() {
        console.log("\n🚀 === 4개 가상장비 OPC UA 서버 시작 ===");
        console.log(`📡 포트: ${server.endpoints[0].port}`);
        console.log(`🌐 엔드포인트: ${server.endpoints[0].endpointDescriptions()[0].endpointUrl}`);
        console.log("\n📋 가상장비 목록:");
        console.log("  🏭 Device1: 온도, 작동상태, 전압, 전류");
        console.log("  🏭 Device2: 온도, 작동상태, 전압, 전류");
        console.log("  🏭 Device3: 온도, 작동상태, 전압, 전류");
        console.log("  🏭 Device4: 온도, 작동상태, 전압, 전류");
        console.log("\n✨ 각 장비마다 총 4개 변수 제공 (총 16개 변수)");
        console.log("⚡ 작동상태(Power)만 제어 가능, 나머지는 모니터링 전용");
        console.log("🔄 실시간 시뮬레이션 실행 중...");
        console.log("\n🛑 서버 중지: Ctrl+C");
    });
})();