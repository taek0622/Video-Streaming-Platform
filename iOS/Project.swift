import ProjectDescription

let project = Project(
    name: "Video-Streaming-Platform",
    targets: [
        .target(
            name: "Video-Streaming-Platform",
            destinations: .iOS,
            product: .app,
            bundleId: "com.immeenu.VSP",
            deploymentTargets: .iOS("26.0"),
            infoPlist: .extendingDefault(
                with: [
                    // (실기기) 로컬 네트워크 접근 권한 팝업에 사용
                    "NSLocalNetworkUsageDescription": .string("로컬 개발 서버(동일 Wi-Fi) 연결을 위해 필요합니다."),
                    // ATS 설정
                    "NSAppTransportSecurity": .dictionary([
                        // LAN / IP / .local / unqualified 도메인에 대해 ATS가 로컬 네트워킹을 허용
                        // e.g, http://192.168.x.x 같은 IP 접속 허용
                        "NSAllowsLocalNetworking": .boolean(true),
                        // localhost를 "도메인 예외"로 명시해서 http 허용
                        "NSExceptionDomains": .dictionary([
                            "localhost": .dictionary([
                                "NSTemporaryExceptionAllowsInsecureHTTPLoads": .boolean(true)
                            ]),
                            "127.0.0.1": .dictionary([
                                "NSTemporaryExceptionAllowsInsecureHTTPLoads": .boolean(true)
                            ])
                        ])
                    ]),
                    "UILaunchScreen": [
                        "UIColorName": "",
                        "UIImageName": "",
                    ],
                ]
            ),
            buildableFolders: [
                "Video-Streaming-Platform/Sources",
                "Video-Streaming-Platform/Resources",
            ],
            dependencies: [],
            settings: .settings(
                base: [
                    "INFOPLIST_KEY_LSApplicationCategoryType": "public.app-category.video"
                ]
            )
        ),
        .target(
            name: "Video-Streaming-PlatformTests",
            destinations: .iOS,
            product: .unitTests,
            bundleId: "com.immeenu.VSPTests",
            infoPlist: .default,
            buildableFolders: [
                "Video-Streaming-Platform/Tests"
            ],
            dependencies: [.target(name: "Video-Streaming-Platform")]
        ),
    ]
)
