import ProjectDescription

let project = Project(
    name: "Video-Streaming-Platform",
    targets: [
        .target(
            name: "Video-Streaming-Platform",
            destinations: .iOS,
            product: .app,
            bundleId: "com.immeenu.VSP",
            infoPlist: .extendingDefault(
                with: [
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
            dependencies: []
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
