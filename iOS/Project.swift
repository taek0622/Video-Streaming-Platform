import ProjectDescription

let project = Project(
    name: "Video-Streaming-Platform",
    targets: [
        .target(
            name: "Video-Streaming-Platform",
            destinations: .iOS,
            product: .app,
            bundleId: "dev.tuist.Video-Streaming-Platform",
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
            bundleId: "dev.tuist.Video-Streaming-PlatformTests",
            infoPlist: .default,
            buildableFolders: [
                "Video-Streaming-Platform/Tests"
            ],
            dependencies: [.target(name: "Video-Streaming-Platform")]
        ),
    ]
)
