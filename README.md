# OPC UA 가상장비 모니터링 시스템

4개의 가상장비를 시뮬레이션하고 OPC UA를 통해 모니터링할 수 있는 시스템입니다.

## 시스템 구성

### 1. OPC UA 서버 (client-server/myserver/client_server_server.js)
- 4개의 가상장비 시뮬레이션
- 각 장비별 4개 변수 제공
  - 온도 (°C)
  - 작동상태 (ON/OFF)
  - 전압 (V)
  - 전류 (A)
- History 데이터 지원
- 실시간 데이터 시뮬레이션 (1초 간격)

### 2. 웹 모니터링 UI (client-server/web-ui/web_monitor_server.js)
- 실시간 데이터 모니터링
- 작동상태(Power) 제어 기능
- History 데이터 그래프 표시
- 자동/수동 데이터 업데이트
- 그래프 초기화 기능

## 시스템 요구사항

- Node.js
- npm (Node Package Manager)

## 설치 방법

1. 저장소 클론:
```bash
git clone [repository-url]
cd Opcua
```

2. 필요한 패키지 설치:
```bash
npm install node-opcua express
```

## 실행 방법

1. OPC UA 서버 실행:
```bash
cd client-server/myserver
node client_server_server.js
```

2. 웹 모니터링 UI 실행:
```bash
cd client-server/web-ui
node web_monitor_server.js
```

3. 웹 브라우저에서 접속:
```
http://localhost:3000
```

## 사용 가이드

### 웹 UI 기능

1. 실시간 모니터링
   - 각 장비의 현재 상태 확인
   - 자동 업데이트 간격 조절 (1초~10초)
   - 수동 새로고침 가능

2. 장비 제어
   - Power 버튼으로 장비 작동상태 제어
   - ON/OFF 상태 변경 가능

3. History 그래프
   - 변수별 History 데이터 그래프 표시
   - 그래프 표시/숨기기 기능
   - 그래프 초기화 기능
   - 변수 유형별 필터링

### OPC UA 서버 정보
- 포트: 4334
- 엔드포인트: opc.tcp://[hostname]:4334/UA/MyLittleServer

## 주의사항

1. OPC UA 서버가 먼저 실행되어 있어야 웹 UI가 정상적으로 동작합니다.
2. 웹 UI는 OPC UA 서버에 연결되지 않으면 자동으로 재연결을 시도합니다.
3. History 데이터는 메모리에 저장되며, 서버 재시작 시 초기화됩니다.

## 최근 업데이트

1. 그래프 초기화 기능 개선
   - 서버 측 히스토리 데이터 초기화 API 추가
   - 클라이언트 측 차트 완전 초기화 구현

2. 로그 메시지 정리
   - 불필요한 디버그 로그 제거
   - 필수적인 상태 로그만 유지

3. OPC UA 클라이언트 설정 개선
   - 인증서 관련 경고 메시지 해결
   - applicationUri 설정 추가

## 프로젝트 구조

```
Opcua/
├── client-server/
│   ├── myserver/
│   │   └── client_server_server.js
│   └── web-ui/
│       ├── public/
│       │   └── index.html
│       └── web_monitor_server.js
└── README.md
``` 